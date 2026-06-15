import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import type { AgentProfile, CreateAgentProfileInput, UpdateAgentProfileInput } from '../agent-profiles/types.ts'

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

export interface AgentsStatusSnapshot {
  available: boolean
  profiles: AgentProfile[]
  reason?: string
}

export interface AgentsFns {
  status: () => Promise<AgentsStatusSnapshot>
  list: () => Promise<AgentProfile[]>
  show: (agentId: string) => Promise<AgentProfile | undefined>
  create: (input: CreateAgentProfileInput) => Promise<AgentProfile>
  update: (agentId: string, updates: UpdateAgentProfileInput) => Promise<AgentProfile>
  duplicate: (agentId: string, name: string) => Promise<AgentProfile>
  delete: (agentId: string) => Promise<void>
}

const AgentsSchema = z.object({
  command: z.string().describe('Agents command: status, list, show <agentId>, create <json>, update <agentId> <json>, duplicate <agentId> <name>, delete <agentId>.'),
})

function success(text: string): ToolResult {
  return { content: [{ type: 'text', text }] }
}

function failure(text: string): ToolResult {
  return { content: [{ type: 'text', text: `Error: ${text}` }], isError: true }
}

function formatProfile(profile: AgentProfile): string {
  const parts = [
    `${profile.id}`,
    `kind=${profile.kind ?? (profile.id === 'default' ? 'system' : 'user')}`,
    `name=${JSON.stringify(profile.name)}`,
  ]
  if (profile.description) parts.push(`description=${JSON.stringify(profile.description)}`)
  if (profile.model) parts.push(`model=${profile.model}`)
  if (profile.llmConnection) parts.push(`llmConnection=${profile.llmConnection}`)
  if (profile.permissionMode) parts.push(`permissionMode=${profile.permissionMode}`)
  return `- ${parts.join(' ')}`
}

function formatList(profiles: AgentProfile[]): string {
  if (profiles.length === 0) return 'Agents: none'
  return ['Agents:', ...profiles.map(formatProfile)].join('\n')
}

function formatStatus(status: AgentsStatusSnapshot): string {
  const lines = [
    `Agents: ${status.available ? 'available' : 'unavailable'}`,
    `Profiles: ${status.profiles.length}`,
  ]
  if (status.reason) lines.push(`Reason: ${status.reason}`)
  lines.push(...formatList(status.profiles).split('\n'))
  return lines.join('\n')
}

function parseJsonPayload<T>(value: string, label: string): T {
  if (!value.trim()) throw new Error(`${label} requires a JSON payload`)
  try {
    return JSON.parse(value) as T
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid JSON payload: ${message}`)
  }
}

function requireUserKind(input: CreateAgentProfileInput | UpdateAgentProfileInput, action: string): void {
  if (input.kind && input.kind !== 'user') {
    throw new Error(`${action} only supports kind "user"`)
  }
}

export async function executeAgentsCommand(command: string, fns: AgentsFns): Promise<ToolResult> {
  const trimmed = command.trim()
  const [rawVerb = 'status', ...rest] = trimmed.split(/\s+/)
  const verb = rawVerb.toLowerCase()

  try {
    if (verb === 'status') return success(formatStatus(await fns.status()))
    if (verb === 'list') return success(formatList(await fns.list()))
    if (verb === 'show') {
      const agentId = rest[0]
      if (!agentId) return failure('show requires an agent id')
      const profile = await fns.show(agentId)
      if (!profile) return failure(`Agent profile "${agentId}" not found`)
      return success(formatProfile(profile))
    }
    if (verb === 'create') {
      const payload = trimmed.slice(rawVerb.length).trim()
      const input = parseJsonPayload<CreateAgentProfileInput>(payload, 'create')
      requireUserKind(input, 'create')
      const profile = await fns.create({ ...input, kind: 'user' })
      return success(`Created agent profile ${profile.id}\n${formatProfile(profile)}`)
    }
    if (verb === 'update') {
      const agentId = rest[0]
      if (!agentId) return failure('update requires an agent id')
      const payload = trimmed.slice(rawVerb.length).trim().slice(agentId.length).trim()
      const updates = parseJsonPayload<UpdateAgentProfileInput>(payload, 'update')
      requireUserKind(updates, 'update')
      const profile = await fns.update(agentId, updates)
      return success(`Updated agent profile ${profile.id}\n${formatProfile(profile)}`)
    }
    if (verb === 'duplicate') {
      const agentId = rest[0]
      if (!agentId) return failure('duplicate requires an agent id')
      const name = trimmed.slice(rawVerb.length).trim().slice(agentId.length).trim()
      if (!name) return failure('duplicate requires a new name')
      const profile = await fns.duplicate(agentId, name)
      return success(`Duplicated agent profile ${agentId} as ${profile.id}\n${formatProfile(profile)}`)
    }
    if (verb === 'delete') {
      const agentId = rest[0]
      if (!agentId) return failure('delete requires an agent id')
      await fns.delete(agentId)
      return success(`Deleted agent profile ${agentId}`)
    }
    return failure(`Unknown agents command: ${verb}`)
  } catch (error) {
    return failure(error instanceof Error ? error.message : String(error))
  }
}

export function createAgentsTool(options: { getAgentsFns: () => AgentsFns | undefined }) {
  return tool('agents', 'Manage workspace agent profiles: list, inspect, create, update, duplicate, and delete.', AgentsSchema.shape, async (args) => {
    const fns = options.getAgentsFns()
    if (!fns) return failure('Agent profile controls are not available. This tool requires the desktop app.')
    return executeAgentsCommand(String(args.command ?? 'status'), fns)
  })
}
