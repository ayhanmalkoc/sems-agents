import { dirname, join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { createHash } from 'crypto'
import { atomicWriteFileSync, readJsonFileSync } from '../utils/files.ts'
import { MEMORY_SCOPES, MEMORY_TYPES, type CreateMemoryInput, type CreateMemorySuggestionInput, type CreateSessionNoteInput, type MemoryBrainActivity, type MemoryBrainActivityJson, type MemoryBrainActivityStatus, type MemoryConfidence, type MemoryHygieneItem, type MemoryRecord, type MemoryRecordStatus, type MemoryScope, type MemoryAutoSuggestSessionState, type MemoryAutoSuggestStateJson, type MemoryStoreJson, type MemorySuggestion, type MemorySuggestionsJson, type MemoryType, type UpdateMemoryInput, type SessionNotesJson, type SessionNote, type SessionNoteScope } from './types.ts'

const MEMORY_DIR = 'memory'
const MEMORIES_FILE = 'memories.json'
const SUGGESTIONS_FILE = 'suggestions.json'
const AUTO_SUGGEST_STATE_FILE = 'auto-suggest-state.json'
const SESSION_NOTES_FILE = 'session-notes.json'
const BRAIN_ACTIVITY_FILE = 'brain-activity.json'
const SECRET_ERROR = 'Memory cannot store sensitive credentials or secrets.'
const ACTIVITY_SECRET_PATTERNS = [/sk[-_][A-Za-z0-9_\-./+=]{8,}/gi, /\b(api[_-]?key|token|password|passwd|secret|bearer)\b\s*(?:[:=]|is)?\s*[^\s,;]{8,}/gi, /-----BEGIN [^-]*PRIVATE KEY-----[\s\S]*?-----END [^-]*PRIVATE KEY-----/gi]

function nowIso(): string { return new Date().toISOString() }
function makeId(prefix: string): string { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}` }
function redactActivityText(value: string | undefined): string | undefined { return value ? ACTIVITY_SECRET_PATTERNS.reduce((text, pattern) => text.replace(pattern, '[REDACTED]'), value).slice(0, 1000) : value }

export function getMemoryDir(workspaceRootPath: string): string { return join(workspaceRootPath, MEMORY_DIR) }
export function getMemoriesPath(workspaceRootPath: string): string { return join(getMemoryDir(workspaceRootPath), MEMORIES_FILE) }
export function getMemorySuggestionsPath(workspaceRootPath: string): string { return join(getMemoryDir(workspaceRootPath), SUGGESTIONS_FILE) }
export function getMemoryAutoSuggestStatePath(workspaceRootPath: string): string { return join(getMemoryDir(workspaceRootPath), AUTO_SUGGEST_STATE_FILE) }
export function getSessionNotesPath(workspaceRootPath: string): string { return join(getMemoryDir(workspaceRootPath), SESSION_NOTES_FILE) }
export function getMemoryBrainActivityPath(workspaceRootPath: string): string { return join(getMemoryDir(workspaceRootPath), BRAIN_ACTIVITY_FILE) }

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
function assertSessionNoteScope(scope: unknown): asserts scope is SessionNoteScope {
  if (scope !== 'session' && scope !== 'day') throw new Error(`Invalid Session Notes scope: ${String(scope)}`)
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

export function validateMemorySuggestionInput(input: CreateMemorySuggestionInput): CreateMemorySuggestionInput {
  assertNoSecrets(input.reason)
  const validated = validateMemoryInput(input)
  return { ...validated, reason: input.reason, agentProfileId: input.agentProfileId, sessionId: input.sessionId }
}


export function getMemoryContentHash(input: { type: MemoryType; title: string; content: string; sourceSessionId?: string }): string {
  return createHash('sha256').update([input.type, input.title.trim(), input.content.trim(), input.sourceSessionId ?? ''].join('\n')).digest('hex')
}

export function loadMemoryAutoSuggestState(workspaceRootPath: string): MemoryAutoSuggestSessionState[] {
  const path = getMemoryAutoSuggestStatePath(workspaceRootPath)
  if (!existsSync(path)) return []
  const data = readJsonFileSync<MemoryAutoSuggestStateJson | MemoryAutoSuggestSessionState[]>(path)
  return Array.isArray(data) ? data : (Array.isArray(data.sessions) ? data.sessions : [])
}

export function saveMemoryAutoSuggestState(workspaceRootPath: string, sessions: MemoryAutoSuggestSessionState[]): void {
  const path = getMemoryAutoSuggestStatePath(workspaceRootPath)
  ensureDir(path)
  atomicWriteFileSync(path, JSON.stringify({ version: 1, sessions }, null, 2) + '\n')
}

export function getMemoryAutoSuggestSessionState(workspaceRootPath: string, sessionId: string): MemoryAutoSuggestSessionState | undefined {
  return loadMemoryAutoSuggestState(workspaceRootPath).find(item => item.sessionId === sessionId)
}

export function updateMemoryAutoSuggestSessionState(workspaceRootPath: string, next: MemoryAutoSuggestSessionState): MemoryAutoSuggestSessionState {
  const sessions = loadMemoryAutoSuggestState(workspaceRootPath)
  const index = sessions.findIndex(item => item.sessionId === next.sessionId)
  const normalized: MemoryAutoSuggestSessionState = { ...next, contentHashes: Array.from(new Set(next.contentHashes)).slice(-100) }
  if (index >= 0) sessions[index] = normalized
  else sessions.push(normalized)
  saveMemoryAutoSuggestState(workspaceRootPath, sessions)
  return normalized
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

export function loadMemorySuggestions(workspaceRootPath: string): MemorySuggestion[] {
  const path = getMemorySuggestionsPath(workspaceRootPath)
  if (!existsSync(path)) return []
  const data = readJsonFileSync<MemorySuggestionsJson | MemorySuggestion[]>(path)
  return Array.isArray(data) ? data : (Array.isArray(data.suggestions) ? data.suggestions : [])
}

export function saveMemorySuggestions(workspaceRootPath: string, suggestions: MemorySuggestion[]): void {
  const path = getMemorySuggestionsPath(workspaceRootPath)
  ensureDir(path)
  atomicWriteFileSync(path, JSON.stringify({ version: 1, suggestions }, null, 2) + '\n')
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

function validateSessionNoteInput(input: CreateSessionNoteInput): CreateSessionNoteInput {
  assertSessionNoteScope(input.scope)
  assertNoSecrets(input.title, input.content, input.tags)
  return {
    ...input,
    title: requireText(input.title, 'title'),
    content: requireText(input.content, 'content'),
    sourceSessionId: requireText(input.sourceSessionId, 'sourceSessionId'),
    createdBy: requireText(input.createdBy, 'createdBy'),
    createdAt: requireText(input.createdAt, 'createdAt'),
    tags: normalizeTags(input.tags),
    sessionId: input.sessionId,
    day: input.day,
  }
}

export function loadSessionNotes(workspaceRootPath: string): SessionNote[] {
  const path = getSessionNotesPath(workspaceRootPath)
  if (!existsSync(path)) return []
  const data = readJsonFileSync<SessionNotesJson | SessionNote[]>(path)
  return Array.isArray(data) ? data : (Array.isArray(data.notes) ? data.notes : [])
}

export function saveSessionNotes(workspaceRootPath: string, notes: SessionNote[]): void {
  const path = getSessionNotesPath(workspaceRootPath)
  ensureDir(path)
  atomicWriteFileSync(path, JSON.stringify({ version: 1, notes }, null, 2) + '\n')
}

export function addSessionNote(workspaceRootPath: string, input: CreateSessionNoteInput): SessionNote {
  const valid = validateSessionNoteInput(input)
  const notes = loadSessionNotes(workspaceRootPath)
  const note: SessionNote = { ...valid, id: valid.id?.trim() || makeId('session-note') }
  if (notes.some(item => item.id === note.id)) throw new Error(`Session Notes note already exists: ${note.id}`)
  notes.push(note)
  saveSessionNotes(workspaceRootPath, notes)
  return note
}

export function clearSessionNotes(workspaceRootPath: string, scope: SessionNoteScope): number {
  assertSessionNoteScope(scope)
  const notes = loadSessionNotes(workspaceRootPath)
  const next = notes.filter(note => note.scope !== scope)
  saveSessionNotes(workspaceRootPath, next)
  return notes.length - next.length
}

export function loadMemoryBrainActivity(workspaceRootPath: string): MemoryBrainActivity[] {
  const path = getMemoryBrainActivityPath(workspaceRootPath)
  if (!existsSync(path)) return []
  const data = readJsonFileSync<MemoryBrainActivityJson | MemoryBrainActivity[]>(path)
  const rows = Array.isArray(data) ? data : (Array.isArray(data.activity) ? data.activity : [])
  return rows
    .filter(item => item && typeof item.id === 'string' && typeof item.reason === 'string')
    .sort((a, b) => (Date.parse(b.startedAt) || 0) - (Date.parse(a.startedAt) || 0))
}

export function saveMemoryBrainActivity(workspaceRootPath: string, activity: MemoryBrainActivity[]): void {
  const path = getMemoryBrainActivityPath(workspaceRootPath)
  ensureDir(path)
  const next = activity
    .map(item => ({ ...item, summary: redactActivityText(item.summary), error: redactActivityText(item.error) }))
    .slice()
    .sort((a, b) => (Date.parse(b.startedAt) || 0) - (Date.parse(a.startedAt) || 0))
    .slice(0, 100)
  atomicWriteFileSync(path, JSON.stringify({ version: 1, activity: next }, null, 2) + '\n')
}

export function startMemoryBrainActivity(workspaceRootPath: string, input: Omit<MemoryBrainActivity, 'id' | 'status' | 'startedAt'> & { id?: string; startedAt?: string; status?: MemoryBrainActivityStatus }): MemoryBrainActivity {
  const activity = loadMemoryBrainActivity(workspaceRootPath)
  const row: MemoryBrainActivity = {
    ...input,
    id: input.id?.trim() || makeId('brain'),
    status: input.status ?? 'running',
    startedAt: input.startedAt ?? nowIso(),
    sourceSessionIds: input.sourceSessionIds.filter(Boolean),
  }
  saveMemoryBrainActivity(workspaceRootPath, [row, ...activity.filter(item => item.id !== row.id)])
  return row
}

export function updateMemoryBrainActivity(workspaceRootPath: string, id: string, updates: Partial<Omit<MemoryBrainActivity, 'id' | 'startedAt'>>): MemoryBrainActivity {
  const activity = loadMemoryBrainActivity(workspaceRootPath)
  const index = activity.findIndex(item => item.id === id)
  if (index < 0) throw new Error(`Memory brain activity not found: ${id}`)
  const next: MemoryBrainActivity = { ...activity[index], ...updates }
  activity[index] = next
  saveMemoryBrainActivity(workspaceRootPath, activity)
  return next
}

export function hasSimilarMemoryOrSuggestion(memories: MemoryRecord[], suggestions: MemorySuggestion[], input: { type: MemoryType; title: string; content: string; sourceSessionId?: string }): boolean {
  const contentKey = memoryContentKey(input)
  const fullKey = memorySimilarityKey(input)
  const memoryMatch = memories.some(memory => memoryContentKey(memory) === contentKey || memorySimilarityKey(memory) === fullKey)
  const suggestionMatch = suggestions.some(suggestion => memoryContentKey(suggestion) === contentKey || memorySimilarityKey(suggestion) === fullKey)
  return memoryMatch || suggestionMatch
}

export function deleteMemory(workspaceRootPath: string, memoryId: string): void {
  const id = requireText(memoryId, 'memoryId')
  const memories = loadMemories(workspaceRootPath)
  const next = memories.filter(item => item.id !== id)
  if (next.length === memories.length) throw new Error(`Memory not found: ${id}`)
  saveMemories(workspaceRootPath, next)
}

export function createMemorySuggestion(workspaceRootPath: string, input: CreateMemorySuggestionInput): MemorySuggestion {
  const valid = validateMemorySuggestionInput(input)
  const suggestions = loadMemorySuggestions(workspaceRootPath)
  const suggestion: MemorySuggestion = { ...valid, id: valid.id?.trim() || makeId('sug'), status: 'pending' }
  if (suggestions.some(item => item.id === suggestion.id)) throw new Error(`Memory suggestion already exists: ${suggestion.id}`)
  suggestions.push(suggestion)
  saveMemorySuggestions(workspaceRootPath, suggestions)
  return suggestion
}

export function approveMemorySuggestion(workspaceRootPath: string, suggestionId: string, decidedBy = 'agent'): { suggestion: MemorySuggestion; memory: MemoryRecord } {
  const id = requireText(suggestionId, 'suggestionId')
  const suggestions = loadMemorySuggestions(workspaceRootPath)
  const index = suggestions.findIndex(item => item.id === id)
  if (index < 0) throw new Error(`Memory suggestion not found: ${id}`)
  const suggestion = suggestions[index]
  if (suggestion.status !== 'pending') throw new Error(`Memory suggestion is already ${suggestion.status}`)
  assertNoSecrets(suggestion.title, suggestion.content, suggestion.reason, suggestion.tags)
  const { id: _suggestionId, status: _status, decidedAt: _decidedAt, decidedBy: _decidedBy, memoryId: _memoryId, ...memoryInput } = suggestion
  const memory = createMemory(workspaceRootPath, memoryInput)
  const decided: MemorySuggestion = { ...suggestion, status: 'approved', decidedAt: nowIso(), decidedBy, memoryId: memory.id }
  suggestions[index] = decided
  saveMemorySuggestions(workspaceRootPath, suggestions)
  return { suggestion: decided, memory }
}

export function rejectMemorySuggestion(workspaceRootPath: string, suggestionId: string, decidedBy = 'agent'): MemorySuggestion {
  const id = requireText(suggestionId, 'suggestionId')
  const suggestions = loadMemorySuggestions(workspaceRootPath)
  const index = suggestions.findIndex(item => item.id === id)
  if (index < 0) throw new Error(`Memory suggestion not found: ${id}`)
  const suggestion = suggestions[index]
  if (suggestion.status !== 'pending') throw new Error(`Memory suggestion is already ${suggestion.status}`)
  const next: MemorySuggestion = { ...suggestion, status: 'rejected', decidedAt: nowIso(), decidedBy }
  suggestions[index] = next
  saveMemorySuggestions(workspaceRootPath, suggestions)
  return next
}
