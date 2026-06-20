import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { createMemory, deleteMemory, findMemoryHygieneItems, getMemoryAutoSuggestSessionState, getMemoryContentHash, hasSimilarMemory, loadMemories, loadMemoryAutoSuggestState, loadMemoryBrainActivity, markMemoryStale, mergeMemories, refreshMemory, searchMemories, startMemoryBrainActivity, updateMemory, updateMemoryAutoSuggestSessionState, updateMemoryBrainActivity } from '../index.ts'

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

  it('rejects secrets in create and update paths', () => {
    const ws = tempWs()
    const error = 'Memory cannot store sensitive credentials or secrets.'
    expect(() => createMemory(ws, { ...base, content: 'api_key=sk_secret_12345678901234567890' })).toThrow(error)
    const memory = createMemory(ws, base)
    expect(() => updateMemory(ws, memory.id, { content: 'password=supersecret123' })).toThrow(error)
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
    expect(hasSimilarMemory(loadMemories(ws), { type: base.type, title: base.title, content: base.content, sourceSessionId: base.sourceSessionId })).toBe(true)
  })


  it('tracks memory brain activity', () => {
    const ws = tempWs()
    const activity = startMemoryBrainActivity(ws, { mode: 'review', reason: 'manual refresh', sourceSessionIds: ['s1'], summary: 'Starting token=abcdef1234567890' })
    expect(activity.status).toBe('running')
    expect(loadMemoryBrainActivity(ws)[0]?.id).toBe(activity.id)
    expect(loadMemoryBrainActivity(ws)[0]?.summary).toContain('[REDACTED]')
    const done = updateMemoryBrainActivity(ws, activity.id, { status: 'done', completedAt: '2026-06-16T00:01:00.000Z', summary: 'Done' })
    expect(done.status).toBe('done')
    expect(loadMemoryBrainActivity(ws)[0]?.summary).toBe('Done')
  })



})
