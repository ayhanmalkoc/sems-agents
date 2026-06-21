import { afterEach, describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { createMemory, deleteMemory, findMemoryHygieneItems, getMemoryContentHash, hasSimilarMemory, loadMemories, loadMemoryWorkspaceIndex, markMemoryStale, mergeMemories, refreshMemory, searchMemories, updateMemory, updateMemoryWorkspaceIndex } from '../index.ts'

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



  it('creates stable content hashes', () => {
    const hash = getMemoryContentHash({ type: 'workflow_learning', title: 'T', content: 'C', sourceSessionId: 's1' })
    expect(hash).toBe(getMemoryContentHash({ type: 'workflow_learning', title: 'T', content: 'C', sourceSessionId: 's1' }))
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





  it('tracks incremental workspace memory index', () => {
    const ws = tempWs()
    expect(loadMemoryWorkspaceIndex(ws).sessions).toEqual([])
    updateMemoryWorkspaceIndex(ws, [{ sessionId: 's1', messageCount: 2, contentHash: 'hash-1', processedAt: '2026-06-16T00:00:00.000Z', status: 'processed' }], '2026-06-16T00:00:00.000Z')
    expect(loadMemoryWorkspaceIndex(ws).lastRefreshAt).toBe('2026-06-16T00:00:00.000Z')
    expect(loadMemoryWorkspaceIndex(ws).sessions[0]?.sessionId).toBe('s1')
    updateMemoryWorkspaceIndex(ws, [{ sessionId: 's1', messageCount: 3, contentHash: 'hash-2', processedAt: '2026-06-16T00:01:00.000Z', status: 'processed' }], '2026-06-16T00:01:00.000Z')
    expect(loadMemoryWorkspaceIndex(ws).sessions).toHaveLength(1)
    expect(loadMemoryWorkspaceIndex(ws).sessions[0]?.contentHash).toBe('hash-2')
  })

})
