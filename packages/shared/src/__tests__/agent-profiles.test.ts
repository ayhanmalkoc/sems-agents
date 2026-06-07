import { describe, expect, it } from 'bun:test'
import { mkdtempSync, rmSync } from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import {
  DEFAULT_AGENT_PROFILE_ID,
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

  it('protects the default profile from mutation', () => withWorkspace((dir) => {
    expect(() => updateAgentProfile(dir, DEFAULT_AGENT_PROFILE_ID, { name: 'Other' })).toThrow()
    expect(() => deleteAgentProfile(dir, DEFAULT_AGENT_PROFILE_ID)).toThrow()
  }))
})
