import { afterEach, describe, expect, it, mock } from 'bun:test'
import { OpenAiCompatibleImageAdapter, ProviderAdapterRegistry, generateImage } from './image-generation'
import type { LlmConnection } from '@craft-agent/shared/config'
import type { ModelDefinition } from '@craft-agent/shared/config'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

const imageModel: ModelDefinition = {
  id: 'gpt-image-1',
  name: 'GPT Image',
  shortName: 'Image',
  description: 'Image model',
  provider: 'pi',
  contextWindow: 1,
  capabilities: { input: { text: true }, output: { image: true } },
}

const openAiConnection: LlmConnection = {
  slug: 'openai',
  name: 'OpenAI',
  providerType: 'pi',
  authType: 'api_key',
  piAuthProvider: 'openai',
  models: [imageModel],
  defaultModels: { imageGeneration: 'gpt-image-1' },
  createdAt: 1,
}

describe('image generation service', () => {
  it('normalizes OpenAI-compatible image bytes', async () => {
    const calls: unknown[] = []
    globalThis.fetch = mock(async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from('image').toString('base64') }] }), { status: 200, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch

    const result = await new OpenAiCompatibleImageAdapter().generateImage({
      apiKey: 'sk-test',
      model: 'gpt-image-1',
      prompt: 'Hero image',
      size: '1024x1024',
      format: 'png',
    })

    expect(result.provider).toBe('openai-compatible')
    expect(result.bytesBase64).toBe(Buffer.from('image').toString('base64'))
    expect(result.mimeType).toBe('image/png')
    const body = JSON.parse((calls[0] as { init: RequestInit }).init.body as string)
    expect(body.output_format).toBe('png')
    expect(body.response_format).toBeUndefined()
  })

  it('returns clear provider errors', async () => {
    globalThis.fetch = mock(async () => new Response(JSON.stringify({ error: { message: 'bad model' } }), { status: 400 })) as typeof fetch
    await expect(new OpenAiCompatibleImageAdapter().generateImage({ apiKey: 'sk-test', model: 'bad', prompt: 'x', format: 'png' })).rejects.toThrow('bad model')
  })

  it('selects the OpenAI-compatible adapter through registry', () => {
    const adapter = new ProviderAdapterRegistry().resolveImageAdapter({ connection: openAiConnection, model: imageModel })
    expect(adapter.id).toBe('openai-compatible')
  })

  it('fails clearly for unsupported providers', () => {
    const connection: LlmConnection = { ...openAiConnection, slug: 'google', providerType: 'pi', piAuthProvider: 'google' }
    expect(() => new ProviderAdapterRegistry().resolveImageAdapter({ connection, model: imageModel })).toThrow('Media provider type google is not implemented yet')
  })

  it('fails clearly without a configured connection', async () => {
    await expect(generateImage({ prompt: 'Hero image' }, { getApiKey: async () => 'sk-test' })).rejects.toThrow('No image generation connection configured')
  })
})
