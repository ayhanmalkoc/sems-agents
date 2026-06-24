import { getLlmConnection } from '@craft-agent/shared/config'
import { resolveModelForTask, type LlmConnection } from '@craft-agent/shared/config'
import { getCredentialManager } from '@craft-agent/shared/credentials'
import type { ModelDefinition } from '@craft-agent/shared/config'

export interface GenerateImageInput {
  connectionSlug?: string
  model?: string
  prompt: string
  size?: string
  format?: 'png' | 'webp' | 'jpeg'
}

export interface GeneratedImageResult {
  bytesBase64: string
  mimeType: string
  provider: string
  model: string
  size?: string
  format: 'png' | 'webp' | 'jpeg'
}

export interface ProviderAdapterGenerateImageInput {
  apiKey: string
  baseUrl?: string
  model: string
  prompt: string
  size?: string
  format: 'png' | 'webp' | 'jpeg'
}

export interface ProviderAdapterContext {
  connection: LlmConnection
  model: ModelDefinition
}

export interface ProviderAdapter {
  id: string
  supportsImageGeneration(context: ProviderAdapterContext): boolean
  generateImage(input: ProviderAdapterGenerateImageInput): Promise<GeneratedImageResult>
}

export interface GenerateImageOptions {
  registry?: ProviderAdapterRegistry
  getApiKey?: (connection: LlmConnection) => Promise<string>
}

function normalizeFormat(format?: string): 'png' | 'webp' | 'jpeg' {
  if (format === 'webp' || format === 'jpeg' || format === 'png') return format
  return 'png'
}

function mimeForFormat(format: 'png' | 'webp' | 'jpeg'): string {
  if (format === 'webp') return 'image/webp'
  if (format === 'jpeg') return 'image/jpeg'
  return 'image/png'
}

async function getApiKey(connection: LlmConnection): Promise<string> {
  const credential = await getCredentialManager().get({ type: 'llm_api_key', connectionSlug: connection.slug })
  const key = credential?.value?.trim()
  if (!key) throw new Error(`Missing API key for image generation connection: ${connection.slug}`)
  return key
}

export class UnsupportedProviderAdapter implements ProviderAdapter {
  constructor(public readonly id: string) {}
  supportsImageGeneration(): boolean { return false }
  async generateImage(): Promise<GeneratedImageResult> {
    throw new Error(`Media provider type ${this.id} is not implemented yet`)
  }
}

export class OpenAiCompatibleImageAdapter implements ProviderAdapter {
  readonly id = 'openai-compatible'

  supportsImageGeneration(context: ProviderAdapterContext): boolean {
    const connection = context.connection
    if (connection.providerType === 'pi' && connection.piAuthProvider === 'openai') return true
    if (connection.providerType === 'pi_compat' && connection.customEndpoint?.api === 'openai-completions') return true
    return false
  }

  async generateImage(input: ProviderAdapterGenerateImageInput): Promise<GeneratedImageResult> {
    const endpoint = `${(input.baseUrl || 'https://api.openai.com/v1').replace(/\/$/, '')}/images/generations`
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: input.model,
        prompt: input.prompt,
        size: input.size || '1024x1024',
        output_format: input.format,
      }),
    })
    const json = await response.json().catch(() => ({})) as { data?: Array<{ b64_json?: string; url?: string }>; error?: { message?: string } }
    if (!response.ok) throw new Error(json.error?.message || `OpenAI-compatible image generation failed (${response.status})`)
    const b64 = json.data?.[0]?.b64_json
    if (!b64) throw new Error('OpenAI-compatible image generation returned no image data')
    return { bytesBase64: b64, mimeType: mimeForFormat(input.format), provider: this.id, model: input.model, size: input.size, format: input.format }
  }
}

export class ProviderAdapterRegistry {
  constructor(private readonly adapters: ProviderAdapter[] = [
    new OpenAiCompatibleImageAdapter(),
    new UnsupportedProviderAdapter('gemini'),
    new UnsupportedProviderAdapter('stability'),
    new UnsupportedProviderAdapter('replicate'),
    new UnsupportedProviderAdapter('fal'),
    new UnsupportedProviderAdapter('custom-http'),
  ]) {}

  resolveImageAdapter(context: ProviderAdapterContext): ProviderAdapter {
    const adapter = this.adapters.find(item => item.supportsImageGeneration(context))
    if (adapter) return adapter
    const provider = context.connection.piAuthProvider ?? context.connection.providerType
    throw new Error(`Media provider type ${provider} is not implemented yet`)
  }
}

export async function generateImage(input: GenerateImageInput & { defaultConnectionSlug?: string }, options: GenerateImageOptions = {}): Promise<GeneratedImageResult> {
  if (!input.prompt.trim()) throw new Error('Image generation prompt is required')
  const slug = input.connectionSlug ?? input.defaultConnectionSlug
  if (!slug) throw new Error('No image generation connection configured')
  const connection = getLlmConnection(slug)
  if (!connection) throw new Error(`Image generation connection not found: ${slug}`)
  const resolved = resolveModelForTask({ connection, task: 'imageGeneration', model: input.model }) as { connection: LlmConnection; model: ModelDefinition }
  const adapter = (options.registry ?? new ProviderAdapterRegistry()).resolveImageAdapter({ connection: resolved.connection, model: resolved.model })
  const apiKey = await (options.getApiKey ?? getApiKey)(resolved.connection)
  return adapter.generateImage({ apiKey, baseUrl: resolved.connection.baseUrl, model: resolved.model.id, prompt: input.prompt, size: input.size, format: normalizeFormat(input.format) })
}
