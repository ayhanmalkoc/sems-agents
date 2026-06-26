import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, extname, join, resolve } from 'node:path';
import { getDefaultLlmConnection, getLlmConnection, getLlmConnections, type LlmConnection, type ModelDefinition } from '@craft-agent/shared/config';
import { getCredentialManager } from '@craft-agent/shared/credentials';
import type { MediaEmbedInput, MediaEmbeddingResult, MediaFileResult, MediaGenerateImageInput, MediaKind, MediaModelInfo, MediaSpeechInput, MediaStatus, MediaTranscribeInput, MediaVoiceInfo } from '@craft-agent/shared/agent/media-tools';

const DEFAULT_9ROUTER_BASE_URL = 'http://localhost:20128/v1';
const MAX_MEDIA_BYTES = 50_000_000;

export interface NineRouterMediaContext {
  sessionPath: string;
  workspaceRootPath: string;
}

function normalizeBaseUrl(baseUrl?: string): string {
  return (baseUrl?.trim() || DEFAULT_9ROUTER_BASE_URL).replace(/\/+$/, '').replace(/\/v1\/v1$/i, '/v1');
}

function safeId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}`;
}

function ensureInside(parent: string, target: string): string {
  const root = resolve(parent);
  const resolved = resolve(target);
  if (resolved !== root && !resolved.startsWith(`${root}\\`) && !resolved.startsWith(`${root}/`)) {
    throw new Error('Path is outside allowed session boundary');
  }
  return resolved;
}

function mediaDir(sessionPath: string): string {
  const dir = join(sessionPath, 'data', 'media');
  mkdirSync(dir, { recursive: true });
  return dir;
}

function modelId(model: ModelDefinition | string): string {
  return typeof model === 'string' ? model : model.id;
}

function modelCapabilities(model: ModelDefinition | string): string[] {
  if (typeof model === 'string') return inferCapabilities(model);
  return model.capabilities?.length ? model.capabilities : inferCapabilities(model.id);
}

function inferCapabilities(id: string): string[] {
  const lower = id.toLowerCase();
  if (/gpt-image|dall-e|dalle|image|flux|recraft|stable|sdxl|midjourney/.test(lower)) return ['image'];
  if (/tts|speech|voice/.test(lower)) return ['tts'];
  if (/whisper|transcribe|transcription|stt/.test(lower)) return ['stt'];
  if (/embed|embedding|voyage|jina/.test(lower)) return ['embedding'];
  return ['chat'];
}

function mediaKindMatches(kind: MediaKind, capabilities: string[]): boolean {
  if (kind === 'image') return capabilities.includes('image');
  if (kind === 'tts') return capabilities.includes('tts');
  if (kind === 'stt') return capabilities.includes('stt');
  return capabilities.includes('embedding') || capabilities.includes('embeddings');
}

function get9routerConnection(): { slug: string; connection: LlmConnection } {
  const defaultSlug = getDefaultLlmConnection();
  const defaultConnection = defaultSlug ? getLlmConnection(defaultSlug) : undefined;
  if (defaultSlug && defaultConnection?.providerType === '9router') return { slug: defaultSlug, connection: defaultConnection };
  const connection = getLlmConnections().find(item => item.providerType === '9router');
  if (!connection) throw new Error('No 9router connection configured');
  return { slug: connection.slug, connection };
}

async function getAuth(): Promise<{ slug: string; connection: LlmConnection; apiKey: string; baseUrl: string }> {
  const { slug, connection } = get9routerConnection();
  const apiKey = await getCredentialManager().getLlmApiKey(slug);
  if (!apiKey) throw new Error(`No API key configured for 9router connection: ${slug}`);
  return { slug, connection, apiKey, baseUrl: normalizeBaseUrl(connection.baseUrl) };
}

async function requestJson(url: string, init: RequestInit): Promise<unknown> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 404 || res.status === 405) throw new Error(`Unsupported 9router endpoint: ${url}`);
    throw new Error(`9router request failed: ${res.status} ${text}`.slice(0, 800));
  }
  return res.json();
}

async function requestBytes(url: string, init: RequestInit): Promise<{ bytes: Buffer; mimeType: string }> {
  const res = await fetch(url, init);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    if (res.status === 404 || res.status === 405) throw new Error(`Unsupported 9router endpoint: ${url}`);
    throw new Error(`9router request failed: ${res.status} ${text}`.slice(0, 800));
  }
  const mimeType = res.headers.get('content-type')?.split(';')[0] || 'application/octet-stream';
  const bytes = Buffer.from(await res.arrayBuffer());
  if (!bytes.length) throw new Error('9router returned empty media response');
  if (bytes.byteLength > MAX_MEDIA_BYTES) throw new Error('9router media response exceeds 50MB');
  return { bytes, mimeType };
}

function dataUrlToBytes(value: string): { bytes: Buffer; mimeType: string } | null {
  const match = value.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  return { mimeType: match[1]!, bytes: Buffer.from(match[2]!, 'base64') };
}

async function imageBytesFromResponse(data: unknown): Promise<{ bytes: Buffer; mimeType: string }> {
  const rows = (data as { data?: unknown[] }).data;
  const first = Array.isArray(rows) ? rows[0] as Record<string, unknown> | undefined : undefined;
  const b64 = first && (typeof first.b64_json === 'string' ? first.b64_json : typeof first.base64 === 'string' ? first.base64 : undefined);
  if (b64) return { bytes: Buffer.from(b64, 'base64'), mimeType: 'image/png' };
  const url = first && (typeof first.url === 'string' ? first.url : undefined);
  if (url) {
    const dataUrl = dataUrlToBytes(url);
    if (dataUrl) return dataUrl;
    return requestBytes(url, { method: 'GET' });
  }
  throw new Error('9router image response did not include base64 or url data');
}

function writeMediaFile(ctx: NineRouterMediaContext, id: string, bytes: Buffer, ext: string): string {
  if (!bytes.length) throw new Error('Media output is empty');
  if (bytes.byteLength > MAX_MEDIA_BYTES) throw new Error('Media output exceeds 50MB');
  const path = ensureInside(mediaDir(ctx.sessionPath), join(mediaDir(ctx.sessionPath), `${id}.${ext}`));
  writeFileSync(path, bytes);
  return path;
}

function extForMime(mimeType: string, fallback: string): string {
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/webp') return 'webp';
  if (mimeType === 'image/png') return 'png';
  if (mimeType === 'audio/wav' || mimeType === 'audio/x-wav') return 'wav';
  if (mimeType === 'audio/ogg') return 'ogg';
  if (mimeType === 'audio/opus') return 'opus';
  if (mimeType === 'audio/mpeg' || mimeType === 'audio/mp3') return 'mp3';
  return fallback;
}

function toMediaModelInfo(model: ModelDefinition | string): MediaModelInfo {
  if (typeof model === 'string') return { id: model, capabilities: inferCapabilities(model) };
  return { id: model.id, name: model.name, capabilities: modelCapabilities(model) };
}

export function listMediaModels(kind: MediaKind): MediaModelInfo[] {
  const { connection } = get9routerConnection();
  return (connection.models ?? [])
    .map(toMediaModelInfo)
    .filter(model => mediaKindMatches(kind, model.capabilities ?? []));
}

function pickModel(kind: MediaKind, requested?: string): string {
  if (requested?.trim()) return requested.trim();
  const model = listMediaModels(kind)[0];
  if (!model) throw new Error(`No 9router ${kind} model configured`);
  return model.id;
}

export async function getMediaStatus(): Promise<MediaStatus> {
  const { slug, connection } = get9routerConnection();
  return {
    available: true,
    connectionSlug: slug,
    baseUrl: normalizeBaseUrl(connection.baseUrl),
    models: {
      image: listMediaModels('image'),
      tts: listMediaModels('tts'),
      stt: listMediaModels('stt'),
      embedding: listMediaModels('embedding'),
    },
  };
}

export async function listVoices(): Promise<MediaVoiceInfo[]> {
  const { apiKey, baseUrl } = await getAuth();
  const data = await requestJson(`${baseUrl}/audio/voices`, { headers: { authorization: `Bearer ${apiKey}` } });
  const rows = Array.isArray(data) ? data : ((data as { data?: unknown[]; voices?: unknown[] }).data ?? (data as { voices?: unknown[] }).voices ?? []);
  return rows.map(row => {
    const record = row as Record<string, unknown>;
    const id = String(record.id ?? record.voice ?? record.name ?? 'voice');
    return { id, name: typeof record.name === 'string' ? record.name : undefined, model: typeof record.model === 'string' ? record.model : undefined };
  });
}

export async function generateImage(ctx: NineRouterMediaContext, input: MediaGenerateImageInput): Promise<MediaFileResult & { bytesBase64: string }> {
  if (!input.prompt?.trim()) throw new Error('generate-image requires prompt');
  const { apiKey, baseUrl } = await getAuth();
  const model = pickModel('image', input.model);
  const data = await requestJson(`${baseUrl}/images/generations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, prompt: input.prompt, size: input.size, quality: input.quality, n: 1 }),
  });
  const { bytes, mimeType } = await imageBytesFromResponse(data);
  const id = input.assetId || safeId('image');
  const path = writeMediaFile(ctx, id, bytes, extForMime(mimeType, input.format ?? 'png'));
  return {
    id,
    path,
    mimeType,
    model,
    previewBlock: '```image-preview\n' + JSON.stringify({ src: path, title: id }, null, 2) + '\n```',
    studioOutputId: input.outputId,
    bytesBase64: bytes.toString('base64'),
  };
}

export async function textToSpeech(ctx: NineRouterMediaContext, input: MediaSpeechInput): Promise<MediaFileResult> {
  if (!input.text?.trim()) throw new Error('speech requires text');
  const { apiKey, baseUrl } = await getAuth();
  const model = pickModel('tts', input.model);
  const { bytes, mimeType } = await requestBytes(`${baseUrl}/audio/speech`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input: input.text, voice: input.voice, format: input.format }),
  });
  const id = input.assetId || safeId('speech');
  const path = writeMediaFile(ctx, id, bytes, extForMime(mimeType, input.format ?? 'mp3'));
  return { id, path, mimeType, model, studioOutputId: input.outputId };
}

export async function speechToText(ctx: NineRouterMediaContext, input: MediaTranscribeInput): Promise<{ text: string; model: string }> {
  if (!input.path?.trim()) throw new Error('transcribe requires path');
  const filePath = ensureInside(ctx.sessionPath, input.path);
  if (!existsSync(filePath)) throw new Error(`Audio file not found: ${filePath}`);
  const { apiKey, baseUrl } = await getAuth();
  const model = pickModel('stt', input.model);
  const form = new FormData();
  form.set('model', model);
  if (input.language) form.set('language', input.language);
  const bytes = readFileSync(filePath);
  form.set('file', new Blob([bytes]), basename(filePath));
  const data = await requestJson(`${baseUrl}/audio/transcriptions`, {
    method: 'POST',
    headers: { authorization: `Bearer ${apiKey}` },
    body: form,
  });
  const text = typeof (data as { text?: unknown }).text === 'string' ? (data as { text: string }).text : JSON.stringify(data);
  return { text, model };
}

export async function createEmbedding(ctx: NineRouterMediaContext, input: MediaEmbedInput): Promise<MediaEmbeddingResult> {
  const { apiKey, baseUrl } = await getAuth();
  const model = pickModel('embedding', input.model);
  const data = await requestJson(`${baseUrl}/embeddings`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, input: input.input }),
  });
  const rows = (data as { data?: Array<{ embedding?: number[] }> }).data ?? [];
  const count = rows.length;
  const dimensions = rows[0]?.embedding?.length;
  const id = safeId('embedding');
  const path = ensureInside(mediaDir(ctx.sessionPath), join(mediaDir(ctx.sessionPath), `${id}.json`));
  writeFileSync(path, JSON.stringify(data, null, 2), 'utf-8');
  return { model, dimensions, count, path };
}
