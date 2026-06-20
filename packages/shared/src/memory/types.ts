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

export type CreateMemoryInput = Omit<MemoryRecord, 'id' | 'updatedAt' | 'updatedBy'> & { id?: string }
export type UpdateMemoryInput = Partial<Pick<MemoryRecord, 'type' | 'scope' | 'title' | 'content' | 'tags' | 'agentProfileId' | 'sessionId' | 'confidence' | 'status' | 'supersedes' | 'updatedBy'>>

export interface MemoryStoreJson {
  version: 1
  memories: MemoryRecord[]
}

export interface MemoryStatusSnapshot {
  available: boolean
  memories: number
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


export type MemoryBrainActivityStatus = 'running' | 'done' | 'failed' | 'skipped'

export interface MemoryBrainActivity {
  id: string
  status: MemoryBrainActivityStatus
  reason: string
  mode: 'auto' | 'review' | 'off-as-review'
  sourceSessionIds: string[]
  startedAt: string
  completedAt?: string
  summary?: string
  error?: string
}

export interface MemoryBrainActivityJson {
  version: 1
  activity: MemoryBrainActivity[]
}

export interface MemoryHygieneItem {
  kind: 'duplicate' | 'stale'
  memoryId: string
  relatedMemoryId?: string
  reason: string
}
