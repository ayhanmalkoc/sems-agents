import { dirname, join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { createHash } from 'crypto'
import { atomicWriteFileSync, readJsonFileSync } from '../utils/files.ts'
import { MEMORY_SCOPES, MEMORY_TYPES, type CreateMemoryInput, type MemoryConfidence, type MemoryHygieneItem, type MemoryRecord, type MemoryRecordStatus, type MemoryScope, type MemoryStoreJson, type MemoryType, type MemoryWorkspaceIndexJson, type MemoryWorkspaceSessionIndexEntry, type UpdateMemoryInput } from './types.ts'

const MEMORY_DIR = 'memory'
const MEMORIES_FILE = 'memories.json'
const WORKSPACE_INDEX_FILE = 'workspace-index.json'
const SECRET_ERROR = 'Memory cannot store sensitive credentials or secrets.'

function nowIso(): string { return new Date().toISOString() }
function makeId(prefix: string): string { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}` }

export function getMemoryDir(workspaceRootPath: string): string { return join(workspaceRootPath, MEMORY_DIR) }
export function getMemoriesPath(workspaceRootPath: string): string { return join(getMemoryDir(workspaceRootPath), MEMORIES_FILE) }
export function getMemoryWorkspaceIndexPath(workspaceRootPath: string): string { return join(getMemoryDir(workspaceRootPath), WORKSPACE_INDEX_FILE) }

function ensureDir(path: string): void { mkdirSync(dirname(path), { recursive: true }) }
function assertType(type: unknown): asserts type is MemoryType {
  if (!MEMORY_TYPES.includes(type as MemoryType)) throw new Error(`Invalid memory type: ${String(type)}`)
}
function assertScope(scope: unknown): asserts scope is MemoryScope {
  if (!MEMORY_SCOPES.includes(scope as MemoryScope)) throw new Error(`Invalid memory scope: ${String(scope)}`)
}
function requireText(value: unknown, field: string): string {
  const text = typeof value === 'string' ? value.trim() : ''
  if (!text) throw new Error(`${field} is required`)
  return text
}
function assertConfidence(confidence: unknown): asserts confidence is MemoryConfidence {
  if (confidence !== undefined && confidence !== 'medium' && confidence !== 'high') throw new Error(`Invalid memory confidence: ${String(confidence)}`)
}
function assertRecordStatus(status: unknown): asserts status is MemoryRecordStatus {
  if (status !== undefined && status !== 'active' && status !== 'stale') throw new Error(`Invalid memory status: ${String(status)}`)
}
function normalizeStringList(value: unknown, field: string): string[] | undefined {
  if (value == null) return undefined
  if (!Array.isArray(value)) throw new Error(`${field} must be an array`)
  return Array.from(new Set(value.map(item => requireText(item, field))))
}
function normalizeTags(tags: unknown): string[] | undefined {
  if (tags == null) return undefined
  if (!Array.isArray(tags)) throw new Error('tags must be an array')
  return tags.map(tag => requireText(tag, 'tag'))
}

function normalizeMemoryComparable(text: string): string { return text.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 280) }
function memorySimilarityKey(input: { type: MemoryType; title?: string; content: string }): string { return `${input.type}:${normalizeMemoryComparable(input.title ?? '')}:${normalizeMemoryComparable(input.content)}` }
function memoryContentKey(input: { type: MemoryType; content: string }): string { return `${input.type}:${normalizeMemoryComparable(input.content)}` }

function assertNoSecrets(...values: unknown[]): void {
  const text = values.flatMap(value => Array.isArray(value) ? value : [value]).filter(value => typeof value === 'string').join('\n')
  if (!text) return
  const patterns = [
    /-----BEGIN\s+(?:RSA\s+|EC\s+|OPENSSH\s+)?PRIVATE KEY-----/i,
    /\bBearer\s+[A-Za-z0-9._~+/=-]{16,}/i,
    /\b(?:api[_-]?key|token|password|passwd|secret)\b\s*[:=]\s*['"]?[^\s'",]{8,}/i,
    /\b(?:sk|pk|rk|ghp|github_pat)_[A-Za-z0-9_\-]{16,}/i,
  ]
  if (patterns.some(pattern => pattern.test(text))) throw new Error(SECRET_ERROR)
}

export function validateMemoryInput(input: CreateMemoryInput): CreateMemoryInput {
  assertType(input.type); assertScope(input.scope); assertConfidence(input.confidence); assertRecordStatus(input.status)
  assertNoSecrets(input.title, input.content, input.tags)
  return {
    ...input,
    title: requireText(input.title, 'title'),
    content: requireText(input.content, 'content'),
    sourceSessionId: requireText(input.sourceSessionId, 'sourceSessionId'),
    createdBy: requireText(input.createdBy, 'createdBy'),
    createdAt: requireText(input.createdAt, 'createdAt'),
    tags: normalizeTags(input.tags),
    status: input.status ?? 'active',
    supersedes: normalizeStringList(input.supersedes, 'supersedes'),
  }
}

export function getMemoryContentHash(input: { type: MemoryType; title: string; content: string; sourceSessionId?: string }): string {
  return createHash('sha256').update([input.type, input.title.trim(), input.content.trim(), input.sourceSessionId ?? ''].join('\n')).digest('hex')
}



export function loadMemoryWorkspaceIndex(workspaceRootPath: string): MemoryWorkspaceIndexJson {
  const path = getMemoryWorkspaceIndexPath(workspaceRootPath)
  if (!existsSync(path)) return { version: 1, sessions: [] }
  const data = readJsonFileSync<MemoryWorkspaceIndexJson>(path)
  return { version: 1, lastRefreshAt: data.lastRefreshAt, sessions: Array.isArray(data.sessions) ? data.sessions : [] }
}

export function saveMemoryWorkspaceIndex(workspaceRootPath: string, index: MemoryWorkspaceIndexJson): void {
  const path = getMemoryWorkspaceIndexPath(workspaceRootPath)
  ensureDir(path)
  const sessions = Array.from(new Map(index.sessions.map(item => [item.sessionId, item])).values())
    .sort((a, b) => (Date.parse(b.processedAt) || 0) - (Date.parse(a.processedAt) || 0))
  atomicWriteFileSync(path, JSON.stringify({ version: 1, lastRefreshAt: index.lastRefreshAt, sessions }, null, 2) + '\n')
}

export function updateMemoryWorkspaceIndex(workspaceRootPath: string, entries: MemoryWorkspaceSessionIndexEntry[], refreshedAt = nowIso()): MemoryWorkspaceIndexJson {
  const current = loadMemoryWorkspaceIndex(workspaceRootPath)
  const byId = new Map(current.sessions.map(item => [item.sessionId, item]))
  for (const entry of entries) byId.set(entry.sessionId, entry)
  const next = { version: 1 as const, lastRefreshAt: refreshedAt, sessions: Array.from(byId.values()) }
  saveMemoryWorkspaceIndex(workspaceRootPath, next)
  return next
}

export function loadMemories(workspaceRootPath: string): MemoryRecord[] {
  const path = getMemoriesPath(workspaceRootPath)
  if (!existsSync(path)) return []
  const data = readJsonFileSync<MemoryStoreJson | MemoryRecord[]>(path)
  return Array.isArray(data) ? data : (Array.isArray(data.memories) ? data.memories : [])
}

export function saveMemories(workspaceRootPath: string, memories: MemoryRecord[]): void {
  const path = getMemoriesPath(workspaceRootPath)
  ensureDir(path)
  atomicWriteFileSync(path, JSON.stringify({ version: 1, memories }, null, 2) + '\n')
}

export function createMemory(workspaceRootPath: string, input: CreateMemoryInput): MemoryRecord {
  const valid = validateMemoryInput(input)
  const memories = loadMemories(workspaceRootPath)
  const memory: MemoryRecord = { ...valid, id: valid.id?.trim() || makeId('mem') }
  if (memories.some(item => item.id === memory.id)) throw new Error(`Memory already exists: ${memory.id}`)
  memories.push(memory)
  saveMemories(workspaceRootPath, memories)
  return memory
}

export function updateMemory(workspaceRootPath: string, memoryId: string, updates: UpdateMemoryInput): MemoryRecord {
  const id = requireText(memoryId, 'memoryId')
  assertNoSecrets(updates.title, updates.content, updates.tags)
  const memories = loadMemories(workspaceRootPath)
  const index = memories.findIndex(item => item.id === id)
  if (index < 0) throw new Error(`Memory not found: ${id}`)
  if (updates.type) assertType(updates.type)
  if (updates.scope) assertScope(updates.scope)
  assertConfidence(updates.confidence)
  assertRecordStatus(updates.status)
  const next: MemoryRecord = {
    ...memories[index],
    ...updates,
    title: updates.title === undefined ? memories[index].title : requireText(updates.title, 'title'),
    content: updates.content === undefined ? memories[index].content : requireText(updates.content, 'content'),
    tags: updates.tags === undefined ? memories[index].tags : normalizeTags(updates.tags),
    supersedes: updates.supersedes === undefined ? memories[index].supersedes : normalizeStringList(updates.supersedes, 'supersedes'),
    updatedAt: nowIso(),
  }
  memories[index] = next
  saveMemories(workspaceRootPath, memories)
  return next
}


export function refreshMemory(workspaceRootPath: string, memoryId: string, updates: UpdateMemoryInput): MemoryRecord {
  return updateMemory(workspaceRootPath, memoryId, { ...updates, status: 'active' })
}

export function markMemoryStale(workspaceRootPath: string, memoryId: string, updatedBy = 'memory tool'): MemoryRecord {
  return updateMemory(workspaceRootPath, memoryId, { status: 'stale', updatedBy })
}

export function mergeMemories(workspaceRootPath: string, targetId: string, sourceId: string, updatedBy = 'memory tool'): { target: MemoryRecord; source: MemoryRecord } {
  const target = loadMemories(workspaceRootPath).find(item => item.id === requireText(targetId, 'targetId'))
  const source = loadMemories(workspaceRootPath).find(item => item.id === requireText(sourceId, 'sourceId'))
  if (!target) throw new Error(`Memory not found: ${targetId}`)
  if (!source) throw new Error(`Memory not found: ${sourceId}`)
  if (target.id === source.id) throw new Error('targetId and sourceId must differ')
  const nextTarget = updateMemory(workspaceRootPath, target.id, { supersedes: [...(target.supersedes ?? []), source.id], updatedBy })
  const nextSource = updateMemory(workspaceRootPath, source.id, { status: 'stale', updatedBy })
  return { target: nextTarget, source: nextSource }
}

export function findMemoryHygieneItems(memories: MemoryRecord[]): MemoryHygieneItem[] {
  const items: MemoryHygieneItem[] = []
  const seen = new Map<string, MemoryRecord>()
  for (const memory of memories) {
    const status = memory.status ?? 'active'
    if (status === 'stale') items.push({ kind: 'stale', memoryId: memory.id, reason: 'Memory is marked stale.' })
    const key = memorySimilarityKey(memory)
    const existing = seen.get(key)
    if (existing) items.push({ kind: 'duplicate', memoryId: memory.id, relatedMemoryId: existing.id, reason: 'Same type/title/content/source hash.' })
    else seen.set(key, memory)
  }
  return items
}


export function hasSimilarMemory(memories: MemoryRecord[], input: { type: MemoryType; title: string; content: string; sourceSessionId?: string }): boolean {
  const contentKey = memoryContentKey(input)
  const fullKey = memorySimilarityKey(input)
  return memories.some(memory => memoryContentKey(memory) === contentKey || memorySimilarityKey(memory) === fullKey)
}

export function deleteMemory(workspaceRootPath: string, memoryId: string): void {
  const id = requireText(memoryId, 'memoryId')
  const memories = loadMemories(workspaceRootPath)
  const next = memories.filter(item => item.id !== id)
  if (next.length === memories.length) throw new Error(`Memory not found: ${id}`)
  saveMemories(workspaceRootPath, next)
}

