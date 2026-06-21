import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createStudioOutput, exportStudioOutput, listStudioOutputsForSession, readStudioOutput, updateStudioOutput } from '../index.ts'

let dirs: string[] = []
function tempSession(): string {
  const dir = mkdtempSync(join(tmpdir(), 'craft-studio-test-'))
  dirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs = []
})

describe('studio storage', () => {
  it('creates, lists, reads, updates, and exports Studio outputs', () => {
    const sessionPath = tempSession()
    const created = createStudioOutput(sessionPath, {
      title: 'QA Landing Page',
      type: 'landing-page',
      skill: 'studio-prototype',
      sourcePrompt: 'Create a QA page',
      html: '<!doctype html><html><body>QA</body></html>',
    }, 'session-1')

    expect(created.metadata.id).toBe('qa-landing-page')
    expect(existsSync(created.entryPath)).toBe(true)
    expect(listStudioOutputsForSession(sessionPath)).toHaveLength(1)
    expect(readStudioOutput(created.outputDir)?.metadata.title).toBe('QA Landing Page')

    const updated = updateStudioOutput(sessionPath, created.metadata.id, { title: 'Updated QA', html: '<!doctype html><html><body>Updated</body></html>' })
    expect(updated.metadata.title).toBe('Updated QA')

    const exported = exportStudioOutput(sessionPath, created.metadata.id, 'zip')
    expect(exported.metadata.status).toBe('exported')
    expect(exported.metadata.exports.at(-1)?.format).toBe('zip')
    expect(existsSync(join(exported.outputDir, exported.metadata.exports.at(-1)!.path))).toBe(true)
  })

  it('blocks unsafe paths and unsupported types', () => {
    const sessionPath = tempSession()
    expect(() => createStudioOutput(sessionPath, { id: '../bad', title: '../bad', type: 'landing-page' }, 'session-1')).not.toThrow()
    expect(() => createStudioOutput(sessionPath, { title: 'Bad type', type: 'unknown' as any }, 'session-1')).toThrow('Unsupported Studio output type')
    expect(() => updateStudioOutput(sessionPath, '../bad', { title: 'Nope' })).toThrow('output id must be a safe path segment')
  })
})
