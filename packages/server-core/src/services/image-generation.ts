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

export interface ImageGenerationAdapter {
  generate(input: { apiKey: string; baseUrl?: string; model: string; prompt: string; size?: string; format: 'png' | 'webp' | 'jpeg' }): Promise<GeneratedImageResult>
}

export interface GenerateImageOptions {
  adapter?: ImageGenerationAdapter
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

function assertOpenAiCapable(connection: LlmConnection): void {
  if (connection.providerType === 'pi' && connection.piAuthProvider === 'openai') return
  if (connection.providerType === 'pi_compat' && connection.customEndpoint?.api === 'openai-completions') return
  throw new Error(`Image generation is not supported for provider ${connection.providerType}${connection.piAuthProvider ? `/${connection.piAuthProvider}` : ''}`)
}

async function getApiKey(connection: LlmConnection): Promise<string> {
  const credential = await getCredentialManager().get({ type: 'llm_api_key', connectionSlug: connection.slug })
  const key = credential?.value?.trim()
  if (!key) throw new Error(`Missing API key for image generation connection: ${connection.slug}`)
  return key
}

export class OpenAiImageGenerationAdapter implements ImageGenerationAdapter {
  async generate(input: { apiKey: string; baseUrl?: string; model: string; prompt: string; size?: string; format: 'png' | 'webp' | 'jpeg' }): Promise<GeneratedImageResult> {
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
    if (!response.ok) throw new Error(json.error?.message || `OpenAI image generation failed (${response.status})`)
    const b64 = json.data?.[0]?.b64_json
    if (!b64) throw new Error('OpenAI image generation returned no image data')
    return { bytesBase64: b64, mimeType: mimeForFormat(input.format), provider: 'openai', model: input.model, size: input.size, format: input.format }
  }
}

export async function generateImage(input: GenerateImageInput & { defaultConnectionSlug?: string }, options: GenerateImageOptions = {}): Promise<GeneratedImageResult> {
  if (!input.prompt.trim()) throw new Error('Image generation prompt is required')
  const slug = input.connectionSlug ?? input.defaultConnectionSlug
  if (!slug) throw new Error('No image generation connection configured')
  const connection = getLlmConnection(slug)
  if (!connection) throw new Error(`Image generation connection not found: ${slug}`)
  assertOpenAiCapable(connection)
  const resolved = resolveModelForTask({ connection, task: 'imageGeneration', model: input.model }) as { connection: LlmConnection; model: ModelDefinition }
  const apiKey = await (options.getApiKey ?? getApiKey)(resolved.connection)
  return (options.adapter ?? new OpenAiImageGenerationAdapter()).generate({ apiKey, baseUrl: resolved.connection.baseUrl, model: resolved.model.id, prompt: input.prompt, size: input.size, format: normalizeFormat(input.format) })
}
