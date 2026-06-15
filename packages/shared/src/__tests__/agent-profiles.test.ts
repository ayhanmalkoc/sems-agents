import { describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  DEFAULT_AGENT_PROFILE_ID,
  cloneAgentProfileInput,
  deleteAgentProfile,
  getAgentProfile,
  listAgentProfiles,
  saveAgentProfile,
  updateAgentProfile,
} from '../agent-profiles/index.ts'

function withWorkspace<T>(fn: (dir: string) => T): T {
  const dir = mkdtempSync(join(tmpdir(), 'agent-profiles-'))
  try {
    return fn(dir)
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

describe('agent profiles storage', () => {
  it('provides an implicit default profile', () => withWorkspace((dir) => {
    const profiles = listAgentProfiles(dir)
    expect(profiles[0]?.id).toBe(DEFAULT_AGENT_PROFILE_ID)
    expect(profiles).toHaveLength(1)
    expect(profiles[0]?.kind).toBe('system')
  }))


  it('filters legacy template seed profiles', () => withWorkspace((dir) => {
    const filePath = join(dir, 'agent-profiles.json')
    const now = Date.now()
    const file = {
      version: 1,
      profiles: [
        { id: DEFAULT_AGENT_PROFILE_ID, name: 'Default Agent', kind: 'system', createdAt: now, updatedAt: now },
        { id: 'code-reviewer', name: 'Code Reviewer', kind: 'template', createdAt: now, updatedAt: now },
        { id: 'researcher', name: 'Researcher', kind: 'template', createdAt: now, updatedAt: now },
        { id: 'custom-agent', name: 'Custom Agent', kind: 'user', createdAt: now, updatedAt: now },
        { id: 'researcher-user', name: 'Researcher User', kind: 'user', createdAt: now, updatedAt: now },
      ],
    }
    writeFileSync(filePath, JSON.stringify(file), 'utf8')

    const profiles = listAgentProfiles(dir)
    expect(profiles.map(profile => profile.id)).toEqual([DEFAULT_AGENT_PROFILE_ID, 'custom-agent', 'researcher-user'])
  }))


  it('creates, updates, and deletes workspace profiles', () => withWorkspace((dir) => {
    const created = saveAgentProfile(dir, {
      name: 'Security Auditor',
      model: 'claude-sonnet-4-6',
      thinkingLevel: 'high',
      enabledSourceSlugs: ['github'],
    })

    expect(created.id).toBe('security-auditor')
    expect(getAgentProfile(dir, created.id)?.model).toBe('claude-sonnet-4-6')

    const updated = updateAgentProfile(dir, created.id, { color: '#6d5dfc' })
    expect(updated.color).toBe('#6d5dfc')

    deleteAgentProfile(dir, created.id)
    expect(getAgentProfile(dir, created.id)).toBeUndefined()
  }))


  it('builds clean duplicate create input', () => {
    const input = cloneAgentProfileInput({
      id: 'source-agent',
      name: 'Source Agent',
      description: 'desc',
      icon: 'SA',
      color: '#123456',
      systemPrompt: 'prompt',
      model: 'model-a',
      thinkingLevel: 'high',
      permissionMode: 'ask',
      enabledSourceSlugs: ['github'],
      skillSlugs: ['review'],
      delegationMode: 'ask',
      delegationAllowedAgentIds: ['helper'],
      visibility: 'internal',
      kind: 'system',
      createdAt: 1,
      updatedAt: 2,
    }, 'Source Agent Copy')

    expect(input).not.toHaveProperty('id')
    expect(input).not.toHaveProperty('createdAt')
    expect(input).not.toHaveProperty('updatedAt')
    expect(input.name).toBe('Source Agent Copy')
    expect(input.kind).toBe('user')
    expect(input.visibility).toBe('user-selectable')
    expect(input.systemPrompt).toBe('prompt')
    expect(input.enabledSourceSlugs).toEqual(['github'])
  })


  it('protects the default profile from mutation', () => withWorkspace((dir) => {
    expect(() => updateAgentProfile(dir, DEFAULT_AGENT_PROFILE_ID, { name: 'Other' })).toThrow()
    expect(() => deleteAgentProfile(dir, DEFAULT_AGENT_PROFILE_ID)).toThrow()
  }))
})
