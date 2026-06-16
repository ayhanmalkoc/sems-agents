import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { addWorkingMemoryNote, approveMemorySuggestion, clearWorkingMemoryNotes, createMemory, createMemorySuggestion, deleteMemory, findMemoryHygieneItems, getMemoryAutoSuggestSessionState, getMemoryContentHash, hasSimilarMemoryOrSuggestion, loadMemories, loadMemoryAutoSuggestState, loadMemorySuggestions, loadWorkingMemoryNotes, markMemoryStale, mergeMemories, refreshMemory, rejectMemorySuggestion, saveMemorySuggestions, searchMemories, updateMemory, updateMemoryAutoSuggestSessionState } from '../index.ts'

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

  it('rejects secrets in create, update, suggestion, and approve paths', () => {
    const ws = tempWs()
    const error = 'Memory cannot store sensitive credentials or secrets.'
    expect(() => createMemory(ws, { ...base, content: 'api_key=sk_secret_12345678901234567890' })).toThrow(error)
    const memory = createMemory(ws, base)
    expect(() => updateMemory(ws, memory.id, { content: 'password=supersecret123' })).toThrow(error)
    expect(() => createMemorySuggestion(ws, { ...base, reason: 'Bearer abcdefghijklmnop1234567890' })).toThrow(error)
    const suggestion = createMemorySuggestion(ws, { ...base, title: 'Safe suggestion' })
    const suggestions = loadMemorySuggestions(ws)
    suggestions[0] = { ...suggestion, content: '-----BEGIN PRIVATE KEY-----\nabc' }
    // Direct file tampering should still be guarded on approval.
    saveMemorySuggestions(ws, suggestions)
    expect(() => approveMemorySuggestion(ws, suggestion.id, 'test')).toThrow(error)
  })



  it('stores auto-suggest state and stable content hashes', () => {
    const ws = tempWs()
    const hash = getMemoryContentHash({ type: 'workflow_learning', title: 'T', content: 'C', sourceSessionId: 's1' })
    expect(hash).toBe(getMemoryContentHash({ type: 'workflow_learning', title: 'T', content: 'C', sourceSessionId: 's1' }))
    updateMemoryAutoSuggestSessionState(ws, { sessionId: 's1', lastScannedMessageId: 'm1', lastRunAt: '2026-06-16T00:00:00.000Z', contentHashes: [hash, hash] })
    expect(loadMemoryAutoSuggestState(ws)).toHaveLength(1)
    expect(getMemoryAutoSuggestSessionState(ws, 's1')?.contentHashes).toEqual([hash])
  })



  it('supports confidence status supersedes merge stale and refresh', () => {
    const ws = tempWs()
    const target = createMemory(ws, { ...base, id: 'target', confidence: 'high' })
    const source = createMemory(ws, { ...base, id: 'source', title: 'Memory architecture copy' })
    expect(loadMemories(ws).find(item => item.id === target.id)?.status).toBe('active')
    const merged = mergeMemories(ws, target.id, source.id, 'test')
    expect(merged.target.supersedes).toContain(source.id)
    expect(merged.source.status).toBe('stale')
    expect(markMemoryStale(ws, target.id, 'test').status).toBe('stale')
    const refreshed = refreshMemory(ws, target.id, { content: 'Fresh content.', confidence: 'medium' })
    expect(refreshed.status).toBe('active')
    expect(refreshed.confidence).toBe('medium')
  })

  it('finds hygiene issues and similar existing records', () => {
    const ws = tempWs()
    const first = createMemory(ws, { ...base, id: 'm1' })
    const duplicate = createMemory(ws, { ...base, id: 'm2' })
    const stale = markMemoryStale(ws, first.id, 'test')
    const items = findMemoryHygieneItems(loadMemories(ws))
    expect(items.some(item => item.kind === 'duplicate' && item.memoryId === duplicate.id)).toBe(true)
    expect(items.some(item => item.kind === 'stale' && item.memoryId === stale.id)).toBe(true)
    expect(hasSimilarMemoryOrSuggestion(loadMemories(ws), [], { type: base.type, title: base.title, content: base.content, sourceSessionId: base.sourceSessionId })).toBe(true)
  })

  it('supports working memory add list and clear', () => {
    const ws = tempWs()
    const note = addWorkingMemoryNote(ws, { scope: 'session', title: 'Temporary task', content: 'Use this only today.', sourceSessionId: 'session-1', createdBy: 'test', createdAt: base.createdAt, sessionId: 'session-1' })
    expect(note.id).toStartWith('work-')
    expect(loadWorkingMemoryNotes(ws)).toHaveLength(1)
    expect(clearWorkingMemoryNotes(ws, 'session')).toBe(1)
    expect(loadWorkingMemoryNotes(ws)).toHaveLength(0)
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
