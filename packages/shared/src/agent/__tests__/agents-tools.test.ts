import { beforeEach, describe, expect, it } from 'bun:test'
import { createAgentsTool, executeAgentsCommand, type AgentsFns, type AgentsStatusSnapshot } from '../agents-tools'
import type { AgentProfile } from '../../agent-profiles/types'

function profile(overrides: Partial<AgentProfile> = {}): AgentProfile {
  return {
    id: 'researcher',
    name: 'Researcher',
    description: 'Finds evidence',
    kind: 'user',
    visibility: 'user-selectable',
    delegationMode: 'disabled',
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  }
}

function status(overrides: Partial<AgentsStatusSnapshot> = {}): AgentsStatusSnapshot {
  return {
    available: true,
    profiles: [profile({ id: 'default', name: 'Default Agent', kind: 'system' }), profile()],
    ...overrides,
  }
}

function createMockFns(): AgentsFns & { calls: string[] } {
  const calls: string[] = []
  const profiles = new Map<string, AgentProfile>(status().profiles.map((item) => [item.id, item]))
  return {
    calls,
    status: async () => { calls.push('status'); return { available: true, profiles: [...profiles.values()] } },
    list: async () => { calls.push('list'); return [...profiles.values()] },
    show: async (agentId) => { calls.push(`show:${agentId}`); return profiles.get(agentId) },
    create: async (input) => {
      calls.push(`create:${input.name}`)
      const next = profile({ ...input, id: input.id ?? input.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), createdAt: 2, updatedAt: 2 })
      profiles.set(next.id, next)
      return next
    },
    update: async (agentId, updates) => {
      calls.push(`update:${agentId}`)
      const existing = profiles.get(agentId)
      if (!existing) throw new Error(`Agent profile "${agentId}" not found`)
      if (existing.kind === 'system') throw new Error('System agents cannot be edited')
      const next = { ...existing, ...updates, id: agentId, kind: existing.kind, updatedAt: 3 }
      profiles.set(agentId, next)
      return next
    },
    duplicate: async (agentId, name) => {
      calls.push(`duplicate:${agentId}:${name}`)
      const existing = profiles.get(agentId)
      if (!existing) throw new Error(`Agent profile "${agentId}" not found`)
      const next = profile({ id: name.toLowerCase().replace(/[^a-z0-9]+/g, '-'), name, kind: 'user', description: existing.description, createdAt: 4, updatedAt: 4 })
      profiles.set(next.id, next)
      return next
    },
    delete: async (agentId) => {
      calls.push(`delete:${agentId}`)
      const existing = profiles.get(agentId)
      if (existing?.kind === 'system') throw new Error('Only user agents can be deleted')
      profiles.delete(agentId)
    },
  }
}

async function executeTool(tool: any, command: string) {
  return tool.handler({ command })
}

describe('agents tool', () => {
  let fns: ReturnType<typeof createMockFns>

  beforeEach(() => {
    fns = createMockFns()
  })

  it('formats status and list', async () => {
    const statusResult = await executeAgentsCommand('status', fns)
    expect(statusResult.isError).toBeUndefined()
    expect(statusResult.content[0].text).toContain('Agents: available')
    expect(statusResult.content[0].text).toContain('Profiles: 2')

    const listResult = await executeAgentsCommand('list', fns)
    expect(listResult.content[0].text).toContain('default kind=system name="Default Agent"')
    expect(listResult.content[0].text).toContain('researcher kind=user name="Researcher"')
  })

  it('shows one profile', async () => {
    const result = await executeAgentsCommand('show researcher', fns)
    expect(result.content[0].text).toContain('researcher kind=user name="Researcher"')
    expect(fns.calls).toEqual(['show:researcher'])
  })

  it('creates and updates user profiles with JSON payloads', async () => {
    const created = await executeAgentsCommand('create {"name":"Debugger","kind":"user","description":"Finds bugs"}', fns)
    expect(created.content[0].text).toContain('Created agent profile debugger')

    const updated = await executeAgentsCommand('update debugger {"description":"Finds root causes"}', fns)
    expect(updated.content[0].text).toContain('Updated agent profile debugger')
    expect(updated.content[0].text).toContain('Finds root causes')
  })

  it('duplicates and deletes profiles', async () => {
    const duplicated = await executeAgentsCommand('duplicate default Research Helper', fns)
    expect(duplicated.content[0].text).toContain('Duplicated agent profile default as research-helper')

    const deleted = await executeAgentsCommand('delete research-helper', fns)
    expect(deleted.content[0].text).toContain('Deleted agent profile research-helper')
  })

  it('protects system profiles through callbacks', async () => {
    const updateResult = await executeAgentsCommand('update default {"name":"Other"}', fns)
    expect(updateResult.isError).toBe(true)
    expect(updateResult.content[0].text).toContain('System agents cannot be edited')

    const deleteResult = await executeAgentsCommand('delete default', fns)
    expect(deleteResult.isError).toBe(true)
    expect(deleteResult.content[0].text).toContain('Only user agents can be deleted')
  })

  it('returns actionable parser errors', async () => {
    expect((await executeAgentsCommand('show', fns)).content[0].text).toContain('show requires an agent id')
    expect((await executeAgentsCommand('create', fns)).content[0].text).toContain('create requires a JSON payload')
    expect((await executeAgentsCommand('create {bad', fns)).content[0].text).toContain('Invalid JSON payload')
    expect((await executeAgentsCommand('update researcher', fns)).content[0].text).toContain('update requires a JSON payload')
    expect((await executeAgentsCommand('update researcher {"kind":"system"}', fns)).content[0].text).toContain('update only supports kind "user"')
    expect((await executeAgentsCommand('duplicate researcher', fns)).content[0].text).toContain('duplicate requires a new name')
    expect((await executeAgentsCommand('delete', fns)).content[0].text).toContain('delete requires an agent id')
    expect((await executeAgentsCommand('wat', fns)).content[0].text).toContain('Unknown agents command: wat')
  })

  it('creates agents SDK tool', async () => {
    const tool = createAgentsTool({ getAgentsFns: () => fns }) as any
    expect(tool.name).toBe('agents')
    const result = await executeTool(tool, 'status')
    expect(result.content[0].text).toContain('Agents: available')
  })

  it('reports unavailable callbacks', async () => {
    const tool = createAgentsTool({ getAgentsFns: () => undefined }) as any
    const result = await executeTool(tool, 'status')
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('requires the desktop app')
  })
})
