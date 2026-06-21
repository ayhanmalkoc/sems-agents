import { describe, expect, it } from 'bun:test'
import { executeStudioCommand, type StudioFns } from '../studio-tools.ts'
import type { StudioOutputRecord } from '../../studio/types.ts'

function record(id = 'studio-1'): StudioOutputRecord {
  return {
    outputDir: `/workspace/session/data/studio/${id}`,
    entryPath: `/workspace/session/data/studio/${id}/index.html`,
    metadata: {
      schema: 'craft-studio-output/v1',
      id,
      title: 'Studio One',
      type: 'landing-page',
      entryFile: 'index.html',
      skill: 'studio-prototype',
      status: 'ready',
      sourcePrompt: 'Create Studio One',
      createdAt: '2026-06-21T00:00:00.000Z',
      updatedAt: '2026-06-21T00:00:00.000Z',
      exports: [],
      sessionId: 'session-1',
    },
  }
}

function fns(): StudioFns & { outputs: Map<string, StudioOutputRecord> } {
  const outputs = new Map<string, StudioOutputRecord>([['studio-1', record()]])
  return {
    outputs,
    status: async () => ({ available: true, outputs: outputs.size }),
    list: async () => [...outputs.values()],
    show: async id => outputs.get(id),
    create: async input => {
      const next = record(input.id ?? 'created')
      next.metadata.title = input.title
      next.metadata.type = input.type
      outputs.set(next.metadata.id, next)
      return next
    },
    update: async (id, input) => {
      const next = outputs.get(id) ?? record(id)
      next.metadata = { ...next.metadata, ...input, updatedAt: '2026-06-21T01:00:00.000Z' }
      outputs.set(id, next)
      return next
    },
    exportOutput: async (id, format) => {
      const next = outputs.get(id) ?? record(id)
      next.metadata.exports.push({ format, path: `/workspace/session/data/studio/${id}/exports/${id}.${format}`, createdAt: '2026-06-21T01:00:00.000Z' })
      next.metadata.status = 'exported'
      return next
    },
  }
}

describe('studio tool', () => {
  it('formats status, list, show, create, update, and export', async () => {
    const mock = fns()
    expect((await executeStudioCommand('status', mock)).content[0].text).toContain('Studio: available')
    expect((await executeStudioCommand('list', mock)).content[0].text).toContain('studio-1')
    expect((await executeStudioCommand('show studio-1', mock)).content[0].text).toContain('Studio One')

    const created = await executeStudioCommand('create {"id":"created","title":"Created","type":"dashboard"}', mock)
    expect(created.content[0].text).toContain('Created')

    const updated = await executeStudioCommand('update created {"title":"Updated"}', mock)
    expect(updated.content[0].text).toContain('Updated')

    const exported = await executeStudioCommand('export created zip', mock)
    expect(exported.content[0].text).toContain('Exported Studio output created')
  })

  it('rejects malformed commands', async () => {
    const mock = fns()
    expect((await executeStudioCommand('', mock)).content[0].text).toContain('Studio: available')
    expect((await executeStudioCommand('show', mock)).content[0].text).toContain('show requires an output id')
    expect((await executeStudioCommand('create not-json', mock)).content[0].text).toContain('Invalid JSON')
    expect((await executeStudioCommand('export studio-1 pdf', mock)).content[0].text).toContain('Export format must be html or zip')
  })
})
