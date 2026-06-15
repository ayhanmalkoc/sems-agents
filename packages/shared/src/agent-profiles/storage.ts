import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  DEFAULT_AGENT_PROFILE_ID,
  createDefaultAgentProfile,
  getAgentProfileKind,
  createSeedAgentProfiles,
  type AgentProfile,
  type CreateAgentProfileInput,
  type UpdateAgentProfileInput,
} from './types.ts'

const FILE_NAME = 'agent-profiles.json'

interface AgentProfilesFile {
  version: 1
  profiles: AgentProfile[]
}

function getProfilesPath(workspaceRootPath: string): string {
  return join(workspaceRootPath, FILE_NAME)
}

function slugifyId(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'agent'
}

function uniqueId(existing: Set<string>, base: string): string {
  let id = slugifyId(base)
  let suffix = 2
  while (existing.has(id)) {
    id = `${slugifyId(base)}-${suffix}`
    suffix++
  }
  return id
}

function isLegacyTemplateProfile(profile: Partial<AgentProfile>): boolean {
  return String(profile.kind) === 'template' || profile.id === 'code-reviewer' || profile.id === 'researcher'
}

function normalizeProfile(profile: AgentProfile): AgentProfile {
  const kind = getAgentProfileKind(profile)
  return {
    ...profile,
    kind,
    delegationMode: profile.delegationMode ?? 'disabled',
    visibility: profile.visibility ?? 'user-selectable',
  }
}

function readProfilesFile(workspaceRootPath: string): AgentProfilesFile {
  const path = getProfilesPath(workspaceRootPath)
  if (!existsSync(path)) {
    return { version: 1, profiles: createSeedAgentProfiles() }
  }

  try {
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as Partial<AgentProfilesFile>
    const profiles = Array.isArray(parsed.profiles)
      ? parsed.profiles.filter(profile => !isLegacyTemplateProfile(profile)).map(normalizeProfile)
      : []
    const existingIds = new Set(profiles.map(p => p.id))
    for (const seed of createSeedAgentProfiles()) {
      if (!existingIds.has(seed.id)) profiles.push(seed)
    }
    return { version: 1, profiles }
  } catch {
    return { version: 1, profiles: createSeedAgentProfiles() }
  }
}

function writeProfilesFile(workspaceRootPath: string, file: AgentProfilesFile): void {
  mkdirSync(workspaceRootPath, { recursive: true })
  writeFileSync(getProfilesPath(workspaceRootPath), `${JSON.stringify(file, null, 2)}\n`, 'utf-8')
}

export function listAgentProfiles(workspaceRootPath: string): AgentProfile[] {
  return readProfilesFile(workspaceRootPath).profiles
}

export function getAgentProfile(workspaceRootPath: string, id: string | undefined): AgentProfile | undefined {
  if (!id) return undefined
  return listAgentProfiles(workspaceRootPath).find(profile => profile.id === id)
}

export function saveAgentProfile(workspaceRootPath: string, input: CreateAgentProfileInput): AgentProfile {
  const file = readProfilesFile(workspaceRootPath)
  const existingIds = new Set(file.profiles.map(p => p.id))
  const now = Date.now()
  const id = input.id ? slugifyId(input.id) : uniqueId(existingIds, input.name)
  if (existingIds.has(id)) {
    throw new Error(`Agent profile "${id}" already exists`)
  }
  const profile = normalizeProfile({ ...input, kind: input.kind ?? 'user', id, createdAt: now, updatedAt: now })
  file.profiles.push(profile)
  writeProfilesFile(workspaceRootPath, file)
  return profile
}

export function updateAgentProfile(workspaceRootPath: string, id: string, updates: UpdateAgentProfileInput): AgentProfile {
  const file = readProfilesFile(workspaceRootPath)
  const index = file.profiles.findIndex(profile => profile.id === id)
  if (index === -1) throw new Error(`Agent profile "${id}" not found`)
  const existing = normalizeProfile(file.profiles[index])
  if (existing.kind === 'system') {
    throw new Error('System agents cannot be edited')
  }
  const profile = normalizeProfile({ ...existing, ...updates, kind: existing.kind, id, updatedAt: Date.now() })
  file.profiles[index] = profile
  writeProfilesFile(workspaceRootPath, file)
  return profile
}

export function deleteAgentProfile(workspaceRootPath: string, id: string): void {
  const file = readProfilesFile(workspaceRootPath)
  const existing = file.profiles.find(profile => profile.id === id)
  if (!existing) return
  if (normalizeProfile(existing).kind !== 'user') {
    throw new Error('Only user agents can be deleted')
  }
  file.profiles = file.profiles.filter(profile => profile.id !== id)
  writeProfilesFile(workspaceRootPath, file)
}
