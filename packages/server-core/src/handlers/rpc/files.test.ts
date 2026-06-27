import { describe, expect, it } from 'bun:test'
import { getPreviewDataUrlMime } from './files'

describe('file RPC preview MIME mapping', () => {
  it('maps audio extensions to playable MIME types', () => {
    expect(getPreviewDataUrlMime('wav')).toBe('audio/wav')
    expect(getPreviewDataUrlMime('.mp3')).toBe('audio/mpeg')
    expect(getPreviewDataUrlMime('m4a')).toBe('audio/mp4')
    expect(getPreviewDataUrlMime('ogg')).toBe('audio/ogg')
  })

  it('falls back for unknown extensions', () => {
    expect(getPreviewDataUrlMime('bin')).toBe('application/octet-stream')
  })
})