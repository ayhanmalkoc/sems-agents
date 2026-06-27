import { describe, expect, it } from 'bun:test'
import { classifyFile, FILE_EXTENSIONS_PATTERN } from './file-classification'

describe('file classification', () => {
  it('previews common audio files in-app', () => {
    expect(classifyFile('C:/tmp/speech.mp3')).toEqual({ type: 'audio', canPreview: true })
    expect(classifyFile('/tmp/speech.wav')).toEqual({ type: 'audio', canPreview: true })
    expect(classifyFile('/tmp/speech.ogg')).toEqual({ type: 'audio', canPreview: true })
  })

  it('keeps audio extensions link-detectable', () => {
    expect(FILE_EXTENSIONS_PATTERN).toContain('mp3')
    expect(FILE_EXTENSIONS_PATTERN).toContain('wav')
  })
})