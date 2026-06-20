import { describe, expect, it } from 'bun:test'
import { executeMemoryCommand, type MemoryFns } from '../memory-tools.ts'
import type { MemoryRecord, MemorySuggestion } from '../../memory/index.ts'

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

const suggestion: MemorySuggestion = {
  ...memory,
  id: 'sug-1',
  status: 'pending',
}


function fns(): MemoryFns {
  return {
    status: async () => ({ available: true, memories: 1, suggestions: 1, pendingSuggestions: 1 }),
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
    suggestFromSession: async () => suggestion,
    approve: async () => ({ suggestion: { ...suggestion, status: 'approved', memoryId: memory.id }, memory }),
    reject: async () => ({ ...suggestion, status: 'rejected' }),
    listSuggestions: async () => [suggestion],
    learn: async () => ({ mode: 'review', processed: 1, created: [], suggested: [suggestion], skipped: 0, reasons: [], taskId: 'brain-1', taskStatus: 'running' }),
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
    expect((await executeMemoryCommand('suggest-from-session session-1', fns())).content[0].text).toContain('Created 1 memory suggestion')
    const learn = (await executeMemoryCommand('learn current', fns())).content[0].text
    expect(learn).toContain('Memory learn summary: delegated to Memory Brain mode=review processed=1 created=0 suggested=1 skipped=0')
    expect(learn).toContain('Task: brain-1 status=running')
    expect(learn).toContain('Suggested ids: sug-1')
    expect((await executeMemoryCommand('approve sug-1', fns())).content[0].text).toContain('Approved suggestion')
    expect((await executeMemoryCommand('reject sug-1', fns())).content[0].text).toContain('Rejected suggestion')
  })

  it('returns clear errors', async () => {
    const result = await executeMemoryCommand('show', fns())
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('show requires a memory id')

    const noScan = fns()
    delete noScan.learn
    const scanResult = await executeMemoryCommand('learn current', noScan)
    expect(scanResult.isError).toBe(true)
    expect(scanResult.content[0].text).toContain('learn is not available')
  })

  it('formats multiple and empty brain suggestion results', async () => {
    const multiple = fns()
    multiple.suggestFromSession = async () => [suggestion, { ...suggestion, id: 'sug-2', title: 'Second' }]
    expect((await executeMemoryCommand('suggest-from-session session-1', multiple)).content[0].text).toContain('Created 2 memory suggestions')

    const empty = fns()
    empty.suggestFromSession = async () => []
    expect((await executeMemoryCommand('suggest-from-session session-1', empty)).content[0].text).toContain('Memory Brain returned no pending suggestions yet')
  })
})
