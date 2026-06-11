import type { ThinkingLevel } from '../agent/thinking-levels.ts'
import type { PermissionMode } from '../agent/mode-types.ts'

export type AgentProfileVisibility = 'user-selectable' | 'internal'
export type AgentProfileKind = 'system' | 'template' | 'user'
export type AgentDelegationMode = 'disabled' | 'ask' | 'auto'

export interface AgentProfile {
  id: string
  name: string
  description?: string
  icon?: string
  color?: string
  llmConnection?: string
  model?: string
  thinkingLevel?: ThinkingLevel
  enabledSourceSlugs?: string[]
  skillSlugs?: string[]
  systemPrompt?: string
  delegationAllowedAgentIds?: string[]
  delegationMode?: AgentDelegationMode
  visibility?: AgentProfileVisibility
  kind?: AgentProfileKind
  permissionMode?: PermissionMode
  createdAt: number
  updatedAt: number
}

export type CreateAgentProfileInput = Omit<AgentProfile, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }
export type UpdateAgentProfileInput = Partial<Omit<AgentProfile, 'id' | 'createdAt' | 'updatedAt'>>

export const DEFAULT_AGENT_PROFILE_ID = 'default'

export function getAgentProfileKind(profile: Pick<AgentProfile, 'id' | 'kind'>): AgentProfileKind {
  return profile.kind
    ?? (profile.id === DEFAULT_AGENT_PROFILE_ID
      ? 'system'
      : (profile.id === 'code-reviewer' || profile.id === 'researcher') ? 'template' : 'user')
}

export function createDefaultAgentProfile(now = Date.now()): AgentProfile {
  return {
    id: DEFAULT_AGENT_PROFILE_ID,
    name: 'Default Agent',
    description: 'Default session agent using workspace settings.',
    delegationMode: 'disabled',
    visibility: 'user-selectable',
    kind: 'system',
    createdAt: now,
    updatedAt: now,
  }
}

export function createSeedAgentProfiles(now = Date.now()): AgentProfile[] {
  return [
    createDefaultAgentProfile(now),
    {
      id: 'code-reviewer',
      name: 'Code Reviewer',
      description: 'Reviews code for correctness, maintainability, risks, and actionable improvements.',
      icon: 'CR',
      color: '#6366f1',
      thinkingLevel: 'high',
      systemPrompt: 'You are Code Reviewer Agent. Focus on code quality, regressions, security risks, maintainability, tests, and concise actionable review notes. Do not make broad unrelated changes.',
      delegationMode: 'disabled',
      visibility: 'user-selectable',
      kind: 'template',
      createdAt: now,
      updatedAt: now,
    },
    {
      id: 'researcher',
      name: 'Researcher',
      description: 'Explores context, compares options, and produces concise findings before implementation.',
      icon: 'R',
      color: '#0ea5e9',
      thinkingLevel: 'medium',
      systemPrompt: 'You are Researcher Agent. Explore context first, cite concrete repo evidence, compare options, identify risks, and avoid implementation unless explicitly asked.',
      delegationMode: 'disabled',
      visibility: 'user-selectable',
      kind: 'template',
      createdAt: now,
      updatedAt: now,
    },
  ]
}
