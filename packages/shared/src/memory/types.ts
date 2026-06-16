export const MEMORY_TYPES = [
  'user_preference',
  'project_decision',
  'workflow_learning',
  'error_resolution',
  'agent_instruction',
  'skill_candidate',
] as const

export const MEMORY_SCOPES = ['global_user', 'workspace', 'agent_profile', 'session'] as const

export type MemoryType = typeof MEMORY_TYPES[number]
export type MemoryScope = typeof MEMORY_SCOPES[number]
export type MemoryConfidence = 'medium' | 'high'
export type MemoryRecordStatus = 'active' | 'stale'
export type WorkingMemoryScope = 'session' | 'day'

export interface MemorySourceTrace {
  sourceSessionId: string
  createdBy: string
  createdAt: string
}

export interface MemoryRecord extends MemorySourceTrace {
  id: string
  type: MemoryType
  scope: MemoryScope
  title: string
  content: string
  tags?: string[]
  agentProfileId?: string
  sessionId?: string
  confidence?: MemoryConfidence
  status?: MemoryRecordStatus
  supersedes?: string[]
  updatedAt?: string
  updatedBy?: string
}

export type MemorySuggestionStatus = 'pending' | 'approved' | 'rejected'

export interface MemorySuggestion extends MemorySourceTrace {
  id: string
  type: MemoryType
  scope: MemoryScope
  title: string
  content: string
  reason?: string
  tags?: string[]
  agentProfileId?: string
  sessionId?: string
  confidence?: MemoryConfidence
  status: MemorySuggestionStatus
  decidedAt?: string
  decidedBy?: string
  memoryId?: string
}

export type CreateMemoryInput = Omit<MemoryRecord, 'id' | 'updatedAt' | 'updatedBy'> & { id?: string }
export type UpdateMemoryInput = Partial<Pick<MemoryRecord, 'type' | 'scope' | 'title' | 'content' | 'tags' | 'agentProfileId' | 'sessionId' | 'confidence' | 'status' | 'supersedes' | 'updatedBy'>>
export type CreateMemorySuggestionInput = Omit<MemorySuggestion, 'id' | 'status' | 'decidedAt' | 'decidedBy' | 'memoryId'> & { id?: string }

export interface MemoryStoreJson {
  version: 1
  memories: MemoryRecord[]
}

export interface MemorySuggestionsJson {
  version: 1
  suggestions: MemorySuggestion[]
}

export interface MemoryStatusSnapshot {
  available: boolean
  memories: number
  suggestions: number
  pendingSuggestions: number
  reason?: string
}


export interface MemoryAutoSuggestSessionState {
  sessionId: string
  lastScannedMessageId?: string
  lastRunAt?: string
  contentHashes: string[]
}

export interface MemoryAutoSuggestStateJson {
  version: 1
  sessions: MemoryAutoSuggestSessionState[]
}


export interface WorkingMemoryNote extends MemorySourceTrace {
  id: string
  scope: WorkingMemoryScope
  title: string
  content: string
  tags?: string[]
  sessionId?: string
  day?: string
}

export type CreateWorkingMemoryInput = Omit<WorkingMemoryNote, 'id'> & { id?: string }

export interface WorkingMemoryJson {
  version: 1
  notes: WorkingMemoryNote[]
}

export interface MemoryHygieneItem {
  kind: 'duplicate' | 'stale'
  memoryId: string
  relatedMemoryId?: string
  reason: string
}
