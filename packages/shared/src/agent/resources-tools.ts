import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import type { LoadedSource, CreateSourceInput } from '../sources/types.ts'
import type { LoadedSkill } from '../skills/types.ts'

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

export interface ResourcesStatusSnapshot {
  available: boolean
  sources: LoadedSource[]
  skills: LoadedSkill[]
  reason?: string
}

export interface ResourceToolSourceToolsResult {
  success: boolean
  tools?: Array<{ name: string; description?: string; allowed?: boolean }>
  error?: string
}

export interface ResourceToolTestResult {
  success: boolean
  status?: string
  message: string
  isError?: boolean
}

export interface ResourceToolExportResult {
  path: string
  sourceCount: number
  skillCount: number
  automationCount: number
  warnings: string[]
}

export interface ResourceToolImportResult {
  sources: { imported: string[]; skipped: string[]; failed: Array<{ id: string; error: string }>; warnings: string[] }
  skills: { imported: string[]; skipped: string[]; failed: Array<{ id: string; error: string }>; warnings: string[] }
  automations: { imported: string[]; skipped: string[]; failed: Array<{ id: string; error: string }>; warnings: string[] }
}

export interface ResourcesFns {
  status: () => Promise<ResourcesStatusSnapshot>
  listSources: () => Promise<LoadedSource[]>
  listSkills: () => Promise<LoadedSkill[]>
  showSource: (slug: string) => Promise<LoadedSource | undefined>
  showSkill: (slug: string) => Promise<LoadedSkill | undefined>
  createSource: (input: CreateSourceInput) => Promise<LoadedSource>
  deleteSource: (slug: string) => Promise<void>
  deleteSkill: (slug: string) => Promise<void>
  testSource: (slug: string) => Promise<ResourceToolTestResult>
  listTools: (sourceSlug: string) => Promise<ResourceToolSourceToolsResult>
  exportBundle: () => Promise<ResourceToolExportResult>
  importBundle: (bundlePath: string) => Promise<ResourceToolImportResult>
}

const ResourcesSchema = z.object({
  command: z.string().describe('Resources command: status, list, list sources, list skills, show source <slug>, show skill <slug>, create-source <json>, delete-source <slug>, delete-skill <slug>, test-source <slug>, list-tools <sourceSlug>, export, import <bundlePath>.'),
})

function success(text: string): ToolResult {
  return { content: [{ type: 'text', text }] }
}

function failure(text: string): ToolResult {
  return { content: [{ type: 'text', text: `Error: ${text}` }], isError: true }
}

function sourceStatus(source: LoadedSource): string {
  return source.config.connectionStatus ?? (source.config.enabled === false ? 'disabled' : 'unknown')
}

function formatSource(source: LoadedSource): string {
  const enabled = source.config.enabled !== false
  const status = sourceStatus(source)
  const provider = source.config.provider ? ` provider=${source.config.provider}` : ''
  return `- ${source.config.slug} type=${source.config.type} enabled=${enabled} status=${status}${provider} name=${JSON.stringify(source.config.name)}`
}

function formatSkill(skill: LoadedSkill): string {
  return `- ${skill.slug} source=${skill.source} name=${JSON.stringify(skill.metadata.name)} description=${JSON.stringify(skill.metadata.description ?? '')}`
}

function formatSources(sources: LoadedSource[]): string {
  if (sources.length === 0) return 'Sources: none'
  return ['Sources:', ...sources.map(formatSource)].join('\n')
}

function formatSkills(skills: LoadedSkill[]): string {
  if (skills.length === 0) return 'Skills: none'
  return ['Skills:', ...skills.map(formatSkill)].join('\n')
}

function formatStatus(status: ResourcesStatusSnapshot): string {
  const lines = [
    `Resources: ${status.available ? 'available' : 'unavailable'}`,
    `Sources: ${status.sources.length}`,
    `Skills: ${status.skills.length}`,
  ]
  if (status.reason) lines.push(`Reason: ${status.reason}`)
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

function requireArg(parts: string[], index: number, message: string): string {
  const value = parts[index]
  if (!value) throw new Error(message)
  return value
}

function formatImportBucket(label: string, bucket: ResourceToolImportResult['sources']): string {
  return `${label}: imported=${bucket.imported.length} skipped=${bucket.skipped.length} failed=${bucket.failed.length} warnings=${bucket.warnings.length}`
}

export async function executeResourcesCommand(command: string, fns: ResourcesFns): Promise<ToolResult> {
  const trimmed = command.trim()
  const parts = trimmed.split(/\s+/).filter(Boolean)
  const rawVerb = parts[0] ?? 'status'
  const verb = rawVerb.toLowerCase()

  try {
    if (verb === 'status') return success(formatStatus(await fns.status()))
    if (verb === 'list') {
      const scope = parts[1]?.toLowerCase()
      if (scope === 'sources') return success(formatSources(await fns.listSources()))
      if (scope === 'skills') return success(formatSkills(await fns.listSkills()))
      if (scope && scope !== 'all') return failure(`Unknown resources list scope: ${scope}`)
      const status = await fns.status()
      return success([formatStatus(status), formatSources(status.sources), formatSkills(status.skills)].join('\n'))
    }
    if (verb === 'show') {
      const kind = requireArg(parts, 1, 'show requires resource kind: source or skill').toLowerCase()
      const slug = requireArg(parts, 2, `show ${kind} requires a slug`)
      if (kind === 'source') {
        const source = await fns.showSource(slug)
        if (!source) return failure(`Source "${slug}" not found`)
        return success(formatSource(source))
      }
      if (kind === 'skill') {
        const skill = await fns.showSkill(slug)
        if (!skill) return failure(`Skill "${slug}" not found`)
        return success(formatSkill(skill))
      }
      return failure(`Unknown resource kind: ${kind}`)
    }
    if (verb === 'create-source') {
      const payload = trimmed.slice(rawVerb.length).trim()
      const input = parseJsonPayload<CreateSourceInput>(payload, 'create-source')
      const source = await fns.createSource(input)
      return success(`Created source ${source.config.slug}\n${formatSource(source)}`)
    }
    if (verb === 'delete-source') {
      const slug = requireArg(parts, 1, 'delete-source requires a source slug')
      await fns.deleteSource(slug)
      return success(`Deleted source ${slug}`)
    }
    if (verb === 'delete-skill') {
      const slug = requireArg(parts, 1, 'delete-skill requires a skill slug')
      await fns.deleteSkill(slug)
      return success(`Deleted skill ${slug}`)
    }
    if (verb === 'test-source') {
      const slug = requireArg(parts, 1, 'test-source requires a source slug')
      const result = await fns.testSource(slug)
      return result.isError ? failure(result.message) : success(`Tested source ${slug}: ${result.success ? 'ok' : 'not-ok'} status=${result.status ?? 'unknown'} message=${result.message}`)
    }
    if (verb === 'list-tools') {
      const slug = requireArg(parts, 1, 'list-tools requires a source slug')
      const result = await fns.listTools(slug)
      if (!result.success) return failure(result.error ?? 'Failed to list source tools')
      const tools = result.tools ?? []
      if (tools.length === 0) return success(`Tools for ${slug}: none`)
      return success([`Tools for ${slug}: ${tools.length}`, ...tools.map(t => `- ${t.name}${typeof t.allowed === 'boolean' ? ` allowed=${t.allowed}` : ''}${t.description ? ` description=${JSON.stringify(t.description)}` : ''}`)].join('\n'))
    }
    if (verb === 'export') {
      const result = await fns.exportBundle()
      const lines = [
        `Exported resources to ${result.path}`,
        `sources=${result.sourceCount} skills=${result.skillCount} automations=${result.automationCount} warnings=${result.warnings.length}`,
        ...result.warnings.map(warning => `warning: ${warning}`),
      ]
      return success(lines.join('\n'))
    }
    if (verb === 'import') {
      const bundlePath = requireArg(parts, 1, 'import requires a bundle path')
      const result = await fns.importBundle(bundlePath)
      return success([
        `Imported resources from ${bundlePath}`,
        formatImportBucket('sources', result.sources),
        formatImportBucket('skills', result.skills),
        formatImportBucket('automations', result.automations),
      ].join('\n'))
    }
    return failure(`Unknown resources command: ${verb}`)
  } catch (error) {
    return failure(error instanceof Error ? error.message : String(error))
  }
}

export function createResourcesTool(options: { getResourcesFns: () => ResourcesFns | undefined }) {
  return tool('resources', 'Manage workspace resources: list, inspect, create/delete sources, delete skills, test sources, list source tools, and import/export resource bundles.', ResourcesSchema.shape, async (args) => {
    const fns = options.getResourcesFns()
    if (!fns) return failure('Resource controls are not available. This tool requires the desktop app.')
    return executeResourcesCommand(String(args.command ?? 'status'), fns)
  })
}
