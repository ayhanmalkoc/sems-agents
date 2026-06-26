import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean };

export type MediaKind = 'image' | 'tts' | 'stt' | 'embedding';

export interface MediaModelInfo {
  id: string;
  name?: string;
  capabilities?: string[];
}

export interface MediaStatus {
  available: boolean;
  connectionSlug?: string;
  baseUrl?: string;
  models: Record<MediaKind, MediaModelInfo[]>;
}

export interface MediaVoiceInfo {
  id: string;
  name?: string;
  model?: string;
}

export interface MediaGenerateImageInput {
  prompt: string;
  model?: string;
  size?: string;
  quality?: string;
  format?: 'png' | 'jpg' | 'jpeg' | 'webp';
  outputId?: string;
  assetId?: string;
}

export interface MediaSpeechInput {
  text: string;
  model?: string;
  voice?: string;
  format?: 'mp3' | 'wav' | 'ogg' | 'opus';
  outputId?: string;
  assetId?: string;
}

export interface MediaTranscribeInput {
  path: string;
  model?: string;
  language?: string;
}

export interface MediaEmbedInput {
  input: string | string[];
  model?: string;
}

export interface MediaFileResult {
  id: string;
  path: string;
  mimeType: string;
  model: string;
  previewBlock?: string;
  studioOutputId?: string;
}

export interface MediaEmbeddingResult {
  model: string;
  dimensions?: number;
  count: number;
  path: string;
}

export interface MediaFns {
  status(): Promise<MediaStatus>;
  models(kind: MediaKind): Promise<MediaModelInfo[]>;
  voices(): Promise<MediaVoiceInfo[]>;
  generateImage(input: MediaGenerateImageInput): Promise<MediaFileResult>;
  speech(input: MediaSpeechInput): Promise<MediaFileResult>;
  transcribe(input: MediaTranscribeInput): Promise<{ text: string; model: string }>;
  embed(input: MediaEmbedInput): Promise<MediaEmbeddingResult>;
}

export const MediaSchema = z.object({
  command: z.string().describe('Media command, e.g. status, models image, voices, generate-image {json}, speech {json}, transcribe {json}, embed {json}'),
});

function success(text: string): ToolResult {
  return { content: [{ type: 'text', text }] };
}

function failure(text: string): ToolResult {
  return { content: [{ type: 'text', text: `Error: ${text}` }], isError: true };
}

function parseJsonPayload<T>(payload: string, command: string): T {
  if (!payload.trim()) throw new Error(`${command} requires a JSON payload`);
  try {
    return JSON.parse(payload) as T;
  } catch (error) {
    throw new Error(`${command} JSON parse failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function formatModel(model: MediaModelInfo): string {
  const caps = model.capabilities?.length ? ` [${model.capabilities.join(', ')}]` : '';
  return `- ${model.id}${model.name && model.name !== model.id ? ` (${model.name})` : ''}${caps}`;
}

function formatStatus(status: MediaStatus): string {
  const lines = [
    `Media: ${status.available ? 'available' : 'unavailable'}`,
    status.connectionSlug ? `connection: ${status.connectionSlug}` : undefined,
    status.baseUrl ? `baseUrl: ${status.baseUrl}` : undefined,
  ].filter(Boolean) as string[];
  for (const kind of ['image', 'tts', 'stt', 'embedding'] as MediaKind[]) {
    lines.push(`${kind}: ${status.models[kind]?.length ?? 0}`);
  }
  return lines.join('\n');
}

export async function executeMediaCommand(command: string, fns: MediaFns): Promise<ToolResult> {
  const trimmed = command.trim() || 'status';
  const [rawVerb, ...rest] = trimmed.split(/\s+/);
  const verb = rawVerb.toLowerCase();
  try {
    if (verb === 'status') return success(formatStatus(await fns.status()));
    if (verb === 'models') {
      const kind = (rest[0] || 'image') as MediaKind;
      if (!['image', 'tts', 'stt', 'embedding'].includes(kind)) return failure('models requires one of image, tts, stt, embedding');
      const models = await fns.models(kind);
      return success(models.length ? [`Media ${kind} models:`, ...models.map(formatModel)].join('\n') : `Media ${kind} models: none`);
    }
    if (verb === 'voices') {
      const voices = await fns.voices();
      return success(voices.length ? ['Media voices:', ...voices.map(v => `- ${v.id}${v.name ? ` (${v.name})` : ''}${v.model ? ` model=${v.model}` : ''}`)].join('\n') : 'Media voices: none');
    }
    if (verb === 'generate-image') {
      const payload = trimmed.slice(rawVerb.length).trim();
      const result = await fns.generateImage(parseJsonPayload<MediaGenerateImageInput>(payload, 'generate-image'));
      return success([`Generated image ${result.id}`, `model: ${result.model}`, `path: ${result.path}`, result.studioOutputId ? `studioOutputId: ${result.studioOutputId}` : undefined, result.previewBlock].filter(Boolean).join('\n'));
    }
    if (verb === 'speech') {
      const payload = trimmed.slice(rawVerb.length).trim();
      const result = await fns.speech(parseJsonPayload<MediaSpeechInput>(payload, 'speech'));
      return success([`Generated speech ${result.id}`, `model: ${result.model}`, `path: ${result.path}`].join('\n'));
    }
    if (verb === 'transcribe') {
      const payload = trimmed.slice(rawVerb.length).trim();
      const result = await fns.transcribe(parseJsonPayload<MediaTranscribeInput>(payload, 'transcribe'));
      return success(`Transcription (${result.model}):\n${result.text}`);
    }
    if (verb === 'embed') {
      const payload = trimmed.slice(rawVerb.length).trim();
      const result = await fns.embed(parseJsonPayload<MediaEmbedInput>(payload, 'embed'));
      return success(`Embedding (${result.model}): count=${result.count}${result.dimensions ? ` dimensions=${result.dimensions}` : ''}\npath: ${result.path}`);
    }
    return failure(`Unknown media command: ${verb}`);
  } catch (error) {
    return failure(error instanceof Error ? error.message : String(error));
  }
}

export function createMediaTool(options: { getMediaFns: () => MediaFns | undefined }) {
  return tool('media', 'Generate and inspect media through configured 9router media endpoints: image, speech, transcription, embeddings. Read media-tools.md before use.', MediaSchema.shape, async (args) => {
    const fns = options.getMediaFns();
    if (!fns) return failure('Media controls are not available. This tool requires the desktop app.');
    return executeMediaCommand(String(args.command ?? 'status'), fns);
  });
}
