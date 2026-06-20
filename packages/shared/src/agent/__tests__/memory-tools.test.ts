import { describe, expect, it } from 'bun:test'
import { executeMemoryCommand, type MemoryFns } from '../memory-tools.ts'
import type { MemoryRecord } from '../../memory/index.ts'

const memory: MemoryRecord = {
  id: 'mem-1',
  type: 'project_decision',
  scope: 'workspace',
  title: 'Decision',
  content: 'Keep memory curated.',
  sourceSessionId: 'session-1',
  createdBy: 'test',
  createdAt: '2026-06-16T00:00:00.000Z',
}

function fns(): MemoryFns {
  return {
    status: async () => ({ available: true, memories: 1 }),
    list: async () => [memory],
    show: async (id) => id === memory.id ? memory : undefined,
    search: async () => [memory],
    create: async (input) => ({ ...memory, ...input, id: input.id ?? 'mem-created' }),
    update: async (_id, updates) => ({ ...memory, ...updates }),
    delete: async () => {},
    hygiene: async () => [{ kind: 'stale', memoryId: 'mem-1', reason: 'Old decision' }],
    merge: async () => ({ target: { ...memory, supersedes: ['mem-2'] }, source: { ...memory, id: 'mem-2', status: 'stale' } }),
    markStale: async () => ({ ...memory, status: 'stale' }),
    refresh: async (_id, updates) => ({ ...memory, ...updates, status: 'active' }),
    learn: async () => ({ mode: 'review', processed: 1, created: [memory], skipped: 0, reasons: [], taskId: 'brain-1', taskStatus: 'running' }),
  }
}

describe('memory tool', () => {
  it('handles read commands', async () => {
    expect((await executeMemoryCommand('status', fns())).content[0].text).toContain('Memory: available')
    expect((await executeMemoryCommand('list', fns())).content[0].text).toContain('mem-1')
    expect((await executeMemoryCommand('show mem-1', fns())).content[0].text).toContain('Decision')
    const search = (await executeMemoryCommand('search curated', fns())).content[0].text
    expect(search).toContain('Memory search results:')
    expect(search).toContain('id=mem-1')
    expect(search).toContain('type=project_decision')
    expect(search).toContain('sourceSessionId=session-1')
  })

  it('handles mutations and brain learning', async () => {
    expect((await executeMemoryCommand('create {"type":"project_decision","scope":"workspace","title":"T","content":"C","sourceSessionId":"s","createdBy":"t","createdAt":"now"}', fns())).content[0].text).toContain('Created memory')
    expect((await executeMemoryCommand('update mem-1 {"title":"Next"}', fns())).content[0].text).toContain('Next')
    expect((await executeMemoryCommand('delete mem-1', fns())).content[0].text).toContain('Deleted memory mem-1')
    expect((await executeMemoryCommand('hygiene', fns())).content[0].text).toContain('Memory hygiene: needs cleanup')
    expect((await executeMemoryCommand('merge mem-1 mem-2', fns())).content[0].text).toContain('Merged source')
    expect((await executeMemoryCommand('mark-stale mem-1', fns())).content[0].text).toContain('stale')
    expect((await executeMemoryCommand('refresh mem-1 {"content":"Fresh"}', fns())).content[0].text).toContain('Refreshed memory')
    const learn = (await executeMemoryCommand('learn current', fns())).content[0].text
    expect(learn).toContain('Memory learn summary: delegated to Memory Brain mode=review processed=1 created=1 skipped=0')
    expect(learn).toContain('Task: brain-1 status=running')
    expect(learn).toContain('Created ids: mem-1')
  })

  it('returns clear errors', async () => {
    const result = await executeMemoryCommand('show', fns())
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('show requires a memory id')

    const noLearn = fns()
    delete noLearn.learn
    const learnResult = await executeMemoryCommand('learn current', noLearn)
    expect(learnResult.isError).toBe(true)
    expect(learnResult.content[0].text).toContain('learn is not available')
  })

  it('rejects removed suggestion commands', async () => {
    expect((await executeMemoryCommand('suggestions', fns())).isError).toBe(true)
    expect((await executeMemoryCommand('suggest-from-session session-1', fns())).isError).toBe(true)
    expect((await executeMemoryCommand('approve sug-1', fns())).isError).toBe(true)
    expect((await executeMemoryCommand('reject sug-1', fns())).isError).toBe(true)
  })
})
