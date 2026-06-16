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
    suggestFromSession: async () => suggestion,
    approve: async () => ({ suggestion: { ...suggestion, status: 'approved', memoryId: memory.id }, memory }),
    reject: async () => ({ ...suggestion, status: 'rejected' }),
    listSuggestions: async () => [suggestion],
  }
}

describe('memory tool', () => {
  it('handles read commands', async () => {
    expect((await executeMemoryCommand('status', fns())).content[0].text).toContain('Memory: available')
    expect((await executeMemoryCommand('list', fns())).content[0].text).toContain('mem-1')
    expect((await executeMemoryCommand('show mem-1', fns())).content[0].text).toContain('Decision')
    expect((await executeMemoryCommand('search curated', fns())).content[0].text).toContain('Keep memory curated')
  })

  it('handles mutations and candidates', async () => {
    expect((await executeMemoryCommand('create {"type":"project_decision","scope":"workspace","title":"T","content":"C","sourceSessionId":"s","createdBy":"t","createdAt":"now"}', fns())).content[0].text).toContain('Created memory')
    expect((await executeMemoryCommand('update mem-1 {"title":"Next"}', fns())).content[0].text).toContain('Next')
    expect((await executeMemoryCommand('delete mem-1', fns())).content[0].text).toContain('Deleted memory mem-1')
    expect((await executeMemoryCommand('suggest-from-session session-1', fns())).content[0].text).toContain('Created 1 memory suggestion')
    expect((await executeMemoryCommand('approve sug-1', fns())).content[0].text).toContain('Approved suggestion')
    expect((await executeMemoryCommand('reject sug-1', fns())).content[0].text).toContain('Rejected suggestion')
  })

  it('returns clear errors', async () => {
    const result = await executeMemoryCommand('show', fns())
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('show requires a memory id')
  })

  it('formats multiple and empty suggestion results', async () => {
    const multiple = fns()
    multiple.suggestFromSession = async () => [suggestion, { ...suggestion, id: 'sug-2', title: 'Second' }]
    expect((await executeMemoryCommand('suggest-from-session session-1', multiple)).content[0].text).toContain('Created 2 memory suggestions')

    const empty = fns()
    empty.suggestFromSession = async () => []
    expect((await executeMemoryCommand('suggest-from-session session-1', empty)).content[0].text).toBe('No strong memory candidates found')
  })
})
