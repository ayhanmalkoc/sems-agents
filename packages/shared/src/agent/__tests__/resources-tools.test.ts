import { beforeEach, describe, expect, it } from 'bun:test'
import { createResourcesTool, executeResourcesCommand, type ResourcesFns, type ResourcesStatusSnapshot } from '../resources-tools'
import type { LoadedSource } from '../../sources/types'
import type { LoadedSkill } from '../../skills/types'

function source(overrides: Partial<LoadedSource> = {}): LoadedSource {
  return {
    workspaceId: 'my-workspace',
    path: '/workspace/sources/github',
    config: {
      slug: 'github',
      name: 'GitHub',
      provider: 'github',
      type: 'mcp',
      enabled: true,
      connectionStatus: 'connected',
      mcp: { transport: 'http', url: 'https://example.test/mcp', authType: 'none' },
    },
    guide: null,
    iconPath: null,
    ...overrides,
  } as LoadedSource
}

function skill(overrides: Partial<LoadedSkill> = {}): LoadedSkill {
  return {
    slug: 'code-review',
    source: 'workspace',
    path: '/workspace/skills/code-review',
    skillFile: '/workspace/skills/code-review/SKILL.md',
    metadata: { name: 'Code Review', description: 'Reviews code' },
    content: '# Code Review',
    iconPath: null,
    ...overrides,
  } as LoadedSkill
}

function status(overrides: Partial<ResourcesStatusSnapshot> = {}): ResourcesStatusSnapshot {
  return { available: true, sources: [source()], skills: [skill()], ...overrides }
}

function slugify(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

function createMockFns(): ResourcesFns & { calls: string[] } {
  const calls: string[] = []
  const sources = new Map<string, LoadedSource>(status().sources.map((item) => [item.config.slug, item]))
  const skills = new Map<string, LoadedSkill>(status().skills.map((item) => [item.slug, item]))
  return {
    calls,
    status: async () => { calls.push('status'); return { available: true, sources: [...sources.values()], skills: [...skills.values()] } },
    listSources: async () => { calls.push('listSources'); return [...sources.values()] },
    listSkills: async () => { calls.push('listSkills'); return [...skills.values()] },
    showSource: async (slug) => { calls.push(`showSource:${slug}`); return sources.get(slug) },
    showSkill: async (slug) => { calls.push(`showSkill:${slug}`); return skills.get(slug) },
    createSource: async (input) => {
      calls.push(`createSource:${input.name}`)
      const next = source({ config: { slug: slugify(input.name), name: input.name, provider: input.provider, type: input.type, enabled: input.enabled ?? true, mcp: input.mcp, api: input.api, local: input.local, connectionStatus: 'untested' } as any })
      sources.set(next.config.slug, next)
      return next
    },
    deleteSource: async (slug) => { calls.push(`deleteSource:${slug}`); sources.delete(slug) },
    deleteSkill: async (slug) => { calls.push(`deleteSkill:${slug}`); skills.delete(slug) },
    testSource: async (slug) => { calls.push(`testSource:${slug}`); return { success: true, status: 'connected', message: `${slug} connected` } },
    listTools: async (slug) => { calls.push(`listTools:${slug}`); return { success: true, tools: [{ name: 'list_issues', description: 'List issues', allowed: true }] } },
    exportBundle: async () => { calls.push('exportBundle'); return { path: '/workspace/resources-export.json', sourceCount: sources.size, skillCount: skills.size, automationCount: 0, warnings: ['Source github has no guide.md'] } },
    importBundle: async (bundlePath) => { calls.push(`importBundle:${bundlePath}`); return { sources: { imported: ['github'], skipped: [], failed: [], warnings: [] }, skills: { imported: [], skipped: [], failed: [], warnings: [] }, automations: { imported: [], skipped: [], failed: [], warnings: [] } } },
  }
}

async function executeTool(tool: any, command: string) {
  return tool.handler({ command })
}

describe('resources tool', () => {
  let fns: ReturnType<typeof createMockFns>

  beforeEach(() => {
    fns = createMockFns()
  })

  it('formats status and lists', async () => {
    const statusResult = await executeResourcesCommand('status', fns)
    expect(statusResult.content[0].text).toContain('Resources: available')
    expect(statusResult.content[0].text).toContain('Sources: 1')
    expect(statusResult.content[0].text).toContain('Skills: 1')

    expect((await executeResourcesCommand('list sources', fns)).content[0].text).toContain('github type=mcp enabled=true')
    expect((await executeResourcesCommand('list skills', fns)).content[0].text).toContain('code-review source=workspace')
    expect((await executeResourcesCommand('list', fns)).content[0].text).toContain('Code Review')
  })

  it('shows source and skill', async () => {
    expect((await executeResourcesCommand('show source github', fns)).content[0].text).toContain('name="GitHub"')
    expect((await executeResourcesCommand('show skill code-review', fns)).content[0].text).toContain('Reviews code')
  })

  it('creates and deletes sources and skills', async () => {
    const created = await executeResourcesCommand('create-source {"name":"Local MCP","provider":"custom","type":"mcp","enabled":false,"mcp":{"transport":"stdio","command":"node","args":["server.js"]}}', fns)
    expect(created.content[0].text).toContain('Created source local-mcp')

    expect((await executeResourcesCommand('delete-source local-mcp', fns)).content[0].text).toContain('Deleted source local-mcp')
    expect((await executeResourcesCommand('delete-skill code-review', fns)).content[0].text).toContain('Deleted skill code-review')
  })

  it('tests sources, lists tools, exports, and imports', async () => {
    expect((await executeResourcesCommand('test-source github', fns)).content[0].text).toContain('status=connected')
    expect((await executeResourcesCommand('list-tools github', fns)).content[0].text).toContain('list_issues')
    const exported = await executeResourcesCommand('export', fns)
    expect(exported.content[0].text).toContain('/workspace/resources-export.json')
    expect(exported.content[0].text).toContain('warnings=1')
    expect(exported.content[0].text).toContain('warning: Source github has no guide.md')
    expect((await executeResourcesCommand('import /workspace/resources-export.json', fns)).content[0].text).toContain('sources: imported=1')
  })

  it('returns actionable parser errors', async () => {
    expect((await executeResourcesCommand('show', fns)).content[0].text).toContain('show requires resource kind')
    expect((await executeResourcesCommand('show source', fns)).content[0].text).toContain('requires a slug')
    expect((await executeResourcesCommand('create-source', fns)).content[0].text).toContain('create-source requires a JSON payload')
    expect((await executeResourcesCommand('create-source {bad', fns)).content[0].text).toContain('Invalid JSON payload')
    expect((await executeResourcesCommand('delete-source', fns)).content[0].text).toContain('requires a source slug')
    expect((await executeResourcesCommand('delete-skill', fns)).content[0].text).toContain('requires a skill slug')
    expect((await executeResourcesCommand('test-source', fns)).content[0].text).toContain('requires a source slug')
    expect((await executeResourcesCommand('list-tools', fns)).content[0].text).toContain('requires a source slug')
    expect((await executeResourcesCommand('import', fns)).content[0].text).toContain('requires a bundle path')
    expect((await executeResourcesCommand('wat', fns)).content[0].text).toContain('Unknown resources command: wat')
  })

  it('wraps callback errors', async () => {
    fns.showSource = async () => { throw new Error('boom') }
    const result = await executeResourcesCommand('show source github', fns)
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('boom')
  })

  it('creates resources SDK tool', async () => {
    const tool = createResourcesTool({ getResourcesFns: () => fns }) as any
    expect(tool.name).toBe('resources')
    const result = await executeTool(tool, 'status')
    expect(result.content[0].text).toContain('Resources: available')
  })

  it('reports unavailable callbacks', async () => {
    const tool = createResourcesTool({ getResourcesFns: () => undefined }) as any
    const result = await executeTool(tool, 'status')
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('requires the desktop app')
  })
})
