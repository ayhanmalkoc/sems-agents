import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'bun:test'

function readHtml(path: string) {
  return readFileSync(join(process.cwd(), path), 'utf8')
}

function expectAudioMediaSrc(html: string) {
  expect(html).toContain("media-src 'self' data: file: blob:;")
}

describe('renderer CSP', () => {
  it('allows audio preview data URLs in the main renderer', () => {
    expectAudioMediaSrc(readHtml('apps/electron/src/renderer/index.html'))
  })

  it('keeps playground audio preview CSP in parity', () => {
    expectAudioMediaSrc(readHtml('apps/electron/src/renderer/playground.html'))
  })
})
