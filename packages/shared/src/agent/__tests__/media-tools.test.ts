import { describe, expect, it } from 'bun:test'
import { executeMediaCommand, type MediaFns } from '../media-tools'

const fns: MediaFns = {
  status: async () => ({ available: true, models: { image: [], tts: [], stt: [], embedding: [] } }),
  models: async () => [],
  voices: async () => [],
  generateImage: async () => ({ id: 'image-1', path: '/tmp/image.png', mimeType: 'image/png', model: 'image-model' }),
  speech: async () => ({ id: 'speech-1', path: 'C:/tmp/speech.mp3', mimeType: 'audio/mpeg', model: 'tts-model' }),
  transcribe: async () => ({ text: 'hello', model: 'stt-model' }),
  embed: async () => ({ model: 'embed-model', count: 1, path: '/tmp/embed.json' }),
}

describe('media tool formatting', () => {
  it('returns audio-preview for generated speech', async () => {
    const result = await executeMediaCommand('speech {"text":"hello"}', fns)
    expect(result.isError).toBeUndefined()
    const text = result.content[0]?.type === 'text' ? result.content[0].text : ''
    expect(text).toContain('Generated speech speech-1')
    expect(text).toContain('```audio-preview')
    expect(text).toContain('C:/tmp/speech.mp3')
  })
})