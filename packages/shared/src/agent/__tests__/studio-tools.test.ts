import { describe, expect, it } from 'bun:test'
import { executeStudioCommand, type StudioFns } from '../studio-tools.ts'
import type { StudioDesignSystemDefinition, StudioOutputRecord, StudioTemplateDefinition } from '../../studio/types.ts'

function record(id = 'studio-1'): StudioOutputRecord {
  return {
    outputDir: `/workspace/session/data/studio/${id}`,
    entryPath: `/workspace/session/data/studio/${id}/index.html`,
    metadata: {
      schema: 'craft-studio-output/v1',
      id,
      title: 'Studio One',
      type: 'landing-page',
      entryFile: 'index.html',
      skill: 'studio-prototype',
      status: 'ready',
      sourcePrompt: 'Create Studio One',
      createdAt: '2026-06-21T00:00:00.000Z',
      updatedAt: '2026-06-21T00:00:00.000Z',
      exports: [],
      sessionId: 'session-1',
      pages: [{ id: 'home', title: 'Home', file: 'index.html', createdAt: '2026-06-21T00:00:00.000Z', updatedAt: '2026-06-21T00:00:00.000Z' }],
      components: [],
      project: { kind: 'single-page', title: 'Studio One' },
    },
  }
}

const designSystem: StudioDesignSystemDefinition = {
  id: 'saas-modern',
  title: 'SaaS Modern',
  skill: 'studio-prototype',
  tokens: { colors: { accent: '#8b5cf6' }, density: 'balanced' },
  usage: ['Use for SaaS marketing pages.'],
}

const template: StudioTemplateDefinition = {
  id: 'landing-saas',
  title: 'SaaS Landing Page',
  description: 'SaaS page',
  type: 'landing-page',
  category: 'web',
  recommendedDesignSystem: 'saas-modern',
  skill: 'studio-prototype',
  templatePath: '/templates/landing-saas.html',
  componentPaths: ['/components/hero.html'],
  tags: ['landing'],
}

function fns(): StudioFns & { outputs: Map<string, StudioOutputRecord> } {
  const outputs = new Map<string, StudioOutputRecord>([['studio-1', record()]])
  return {
    outputs,
    status: async () => ({ available: true, outputs: outputs.size }),
    list: async () => [...outputs.values()],
    show: async id => outputs.get(id),
    templates: async () => [template],
    template: async id => id === template.id ? template : undefined,
    designSystems: async () => [designSystem],
    designSystem: async id => id === designSystem.id ? designSystem : undefined,
    create: async input => {
      const next = record(input.id ?? 'created')
      next.metadata.title = input.title
      next.metadata.type = input.type
      next.metadata.templateId = input.template ?? input.templateId
      outputs.set(next.metadata.id, next)
      return next
    },
    createProject: async input => {
      const next = record(input.id ?? 'project')
      next.metadata.title = input.title
      next.metadata.type = input.type
      next.metadata.project = { kind: input.kind ?? 'single-page', title: input.title }
      outputs.set(next.metadata.id, next)
      return next
    },
    update: async (id, input) => {
      const next = outputs.get(id) ?? record(id)
      next.metadata = { ...next.metadata, ...input, updatedAt: '2026-06-21T01:00:00.000Z' }
      outputs.set(id, next)
      return next
    },
    addPage: async (id, input) => {
      const next = outputs.get(id) ?? record(id)
      next.metadata.pages = [...(next.metadata.pages ?? []), { id: 'pricing', title: input.title, file: 'pages/pricing.html', createdAt: '2026-06-21T01:00:00.000Z', updatedAt: '2026-06-21T01:00:00.000Z' }]
      outputs.set(id, next)
      return next
    },
    addComponent: async (id, input) => {
      const next = outputs.get(id) ?? record(id)
      next.metadata.components = [...(next.metadata.components ?? []), { id: 'pricing', title: input.title, preset: input.preset, file: 'components/pricing.html', createdAt: '2026-06-21T01:00:00.000Z', updatedAt: '2026-06-21T01:00:00.000Z' }]
      outputs.set(id, next)
      return next
    },
    quality: async id => {
      const next = outputs.get(id) ?? record(id)
      next.metadata.quality = { checkedAt: '2026-06-21T01:00:00.000Z', score: 80, checks: [{ id: 'viewport', label: 'Viewport', status: 'pass', detail: 'ok' }] }
      outputs.set(id, next)
      return next
    },
    adopt: async (htmlPath, input) => {
      const next = record(input.id ?? 'adopted')
      next.entryPath = htmlPath
      next.metadata.title = input.title
      next.metadata.type = input.type
      outputs.set(next.metadata.id, next)
      return next
    },
    exportOutput: async (id, format) => {
      const next = outputs.get(id) ?? record(id)
      next.metadata.exports.push({ format, path: `/workspace/session/data/studio/${id}/exports/${id}.${format}`, createdAt: '2026-06-21T01:00:00.000Z' })
      next.metadata.status = 'exported'
      return next
    },
  }
}

describe('studio tool', () => {
  it('formats status, templates, list, show, create, project, update, quality, export, and adopt', async () => {
    const mock = fns()
    expect((await executeStudioCommand('status', mock)).content[0].text).toContain('Studio: available')
    expect((await executeStudioCommand('templates', mock)).content[0].text).toContain('designSystem=saas-modern')
    expect((await executeStudioCommand('template landing-saas', mock)).content[0].text).toContain('Recommended design system: saas-modern')
    expect((await executeStudioCommand('design-systems', mock)).content[0].text).toContain('saas-modern')
    expect((await executeStudioCommand('design-system saas-modern', mock)).content[0].text).toContain('SaaS Modern')
    expect((await executeStudioCommand('list', mock)).content[0].text).toContain('studio-1')
    expect((await executeStudioCommand('show studio-1', mock)).content[0].text).toContain('Studio One')

    const created = await executeStudioCommand('create {"id":"created","title":"Created","type":"dashboard","template":"landing-saas"}', mock)
    expect(created.content[0].text).toContain('Created')

    const project = await executeStudioCommand('create-project {"id":"project","title":"Project","type":"landing-page"}', mock)
    expect(project.content[0].text).toContain('Project')

    expect((await executeStudioCommand('add-page project {"title":"Pricing"}', mock)).content[0].text).toContain('Added Studio page')
    expect((await executeStudioCommand('add-component project {"title":"Pricing","preset":"pricing"}', mock)).content[0].text).toContain('Added Studio component')
    expect((await executeStudioCommand('quality project', mock)).content[0].text).toContain('Studio quality')

    const updated = await executeStudioCommand('update created {"title":"Updated"}', mock)
    expect(updated.content[0].text).toContain('Updated')

    const exported = await executeStudioCommand('export created zip', mock)
    expect(exported.content[0].text).toContain('Exported Studio output created')

    const pdf = await executeStudioCommand('export created pdf', mock)
    expect(pdf.content[0].text).toContain('Exported Studio output created')

    const adopted = await executeStudioCommand('adopt /workspace/session/data/loose.html {"id":"adopted","title":"Adopted","type":"landing-page"}', mock)
    expect(adopted.content[0].text).toContain('Adopted Studio output adopted')
  })

  it('rejects malformed commands', async () => {
    const mock = fns()
    expect((await executeStudioCommand('', mock)).content[0].text).toContain('Studio: available')
    expect((await executeStudioCommand('show', mock)).content[0].text).toContain('show requires an output id')
    expect((await executeStudioCommand('template', mock)).content[0].text).toContain('template requires a template id')
    expect((await executeStudioCommand('design-system', mock)).content[0].text).toContain('design-system requires a design system id')
    expect((await executeStudioCommand('create not-json', mock)).content[0].text).toContain('Invalid JSON')
    expect((await executeStudioCommand('export studio-1 pptx', mock)).content[0].text).toContain('Export format must be html, zip, or pdf')
  })
})