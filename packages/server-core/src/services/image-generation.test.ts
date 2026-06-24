import { afterEach, describe, expect, it, mock } from 'bun:test'
import { OpenAiImageGenerationAdapter, generateImage } from './image-generation'

const originalFetch = globalThis.fetch

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('image generation service', () => {
  it('normalizes OpenAI image bytes', async () => {
    const calls: unknown[] = []
    globalThis.fetch = mock(async (url: string, init: RequestInit) => {
      calls.push({ url, init })
      return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from('image').toString('base64') }] }), { status: 200, headers: { 'content-type': 'application/json' } })
    }) as typeof fetch

    const result = await new OpenAiImageGenerationAdapter().generate({
      apiKey: 'sk-test',
      model: 'gpt-image-1',
      prompt: 'Hero image',
      size: '1024x1024',
      format: 'png',
    })

    expect(result.bytesBase64).toBe(Buffer.from('image').toString('base64'))
    expect(result.mimeType).toBe('image/png')
    const body = JSON.parse((calls[0] as { init: RequestInit }).init.body as string)
    expect(body.output_format).toBe('png')
    expect(body.response_format).toBeUndefined()
  })

  it('returns clear provider errors', async () => {
    globalThis.fetch = mock(async () => new Response(JSON.stringify({ error: { message: 'bad model' } }), { status: 400 })) as typeof fetch
    await expect(new OpenAiImageGenerationAdapter().generate({ apiKey: 'sk-test', model: 'bad', prompt: 'x', format: 'png' })).rejects.toThrow('bad model')
  })

  it('fails clearly without a configured connection', async () => {
    await expect(generateImage({ prompt: 'Hero image' }, { getApiKey: async () => 'sk-test' })).rejects.toThrow('No image generation connection configured')
  })
})
