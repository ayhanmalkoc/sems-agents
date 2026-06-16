import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { approveMemorySuggestion, createMemory, createMemorySuggestion, deleteMemory, loadMemories, loadMemorySuggestions, rejectMemorySuggestion, searchMemories, updateMemory } from '../index.ts'

let dirs: string[] = []
function tempWs(): string {
  const dir = mkdtempSync(join(tmpdir(), 'craft-memory-test-'))
  dirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs = []
})

const base = {
  type: 'project_decision' as const,
  scope: 'workspace' as const,
  title: 'Memory architecture',
  content: 'Use candidate approve curated memory flow.',
  sourceSessionId: 'session-1',
  createdBy: 'test',
  createdAt: '2026-06-16T00:00:00.000Z',
}

describe('memory storage', () => {
  it('creates, lists, searches, updates, and deletes memories', () => {
    const ws = tempWs()
    const memory = createMemory(ws, base)
    expect(loadMemories(ws)).toHaveLength(1)
    expect(searchMemories(loadMemories(ws), 'curated')).toEqual([memory])
    const updated = updateMemory(ws, memory.id, { title: 'Updated memory', tags: ['qa'] })
    expect(updated.title).toBe('Updated memory')
    expect(updated.tags).toEqual(['qa'])
    deleteMemory(ws, memory.id)
    expect(loadMemories(ws)).toHaveLength(0)
  })

  it('requires source trace fields', () => {
    const ws = tempWs()
    expect(() => createMemory(ws, { ...base, sourceSessionId: '' })).toThrow('sourceSessionId is required')
  })

  it('approves and rejects suggestions', () => {
    const ws = tempWs()
    const approved = createMemorySuggestion(ws, { ...base, title: 'Approve me' })
    const result = approveMemorySuggestion(ws, approved.id, 'test')
    expect(result.memory.title).toBe('Approve me')
    expect(result.memory.id).toStartWith('mem-')
    expect(result.memory.id).not.toBe(approved.id)
    expect(result.suggestion.memoryId).toBe(result.memory.id)
    expect(loadMemories(ws)).toHaveLength(1)

    const rejected = createMemorySuggestion(ws, { ...base, title: 'Reject me' })
    const next = rejectMemorySuggestion(ws, rejected.id, 'test')
    expect(next.status).toBe('rejected')
    expect(loadMemorySuggestions(ws).filter(item => item.status === 'pending')).toHaveLength(0)
  })
})
