import type { ThinkingLevel } from '../agent/thinking-levels.ts'
import type { PermissionMode } from '../agent/mode-types.ts'

export type AgentProfileVisibility = 'user-selectable' | 'internal'
export type AgentProfileKind = 'system' | 'user'
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
    ?? (profile.id === DEFAULT_AGENT_PROFILE_ID ? 'system' : 'user')
}


export function cloneAgentProfileInput(agent: AgentProfile, name: string): CreateAgentProfileInput {
  return {
    kind: 'user',
    name,
    description: agent.description,
    icon: agent.icon,
    color: agent.color,
    llmConnection: agent.llmConnection,
    model: agent.model,
    thinkingLevel: agent.thinkingLevel,
    enabledSourceSlugs: agent.enabledSourceSlugs,
    skillSlugs: agent.skillSlugs,
    systemPrompt: agent.systemPrompt,
    delegationAllowedAgentIds: agent.delegationAllowedAgentIds,
    delegationMode: agent.delegationMode,
    visibility: 'user-selectable',
    permissionMode: agent.permissionMode,
  }
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
  ]
}
