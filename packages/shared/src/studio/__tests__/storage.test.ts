import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { addStudioComponent, addStudioPage, adoptStudioOutput, createStudioOutput, createStudioProject, exportStudioOutput, getStudioDesignSystem, getStudioTemplate, listStudioDesignSystems, listStudioOutputsForSession, listStudioTemplates, readStudioOutput, recordStudioPdfExport, recommendStudioScenarios, runStudioQuality, updateStudioOutput, getStudioScenario, listStudioScenarios } from '../index.ts'

let dirs: string[] = []
function tempSession(): string {
  const dir = mkdtempSync(join(tmpdir(), 'craft-studio-test-'))
  dirs.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
  dirs = []
})

describe('studio storage', () => {
  it('lists and resolves builtin Studio templates', () => {
    const templates = listStudioTemplates()
    expect(templates.map(template => template.id)).toContain('landing-saas')
    expect(getStudioTemplate('landing-saas')?.skill).toBe('studio-prototype')
    expect(getStudioTemplate('landing-saas')?.category).toBe('web')
    expect(getStudioTemplate('landing-saas')?.recommendedDesignSystem).toBe('saas-modern')
    expect(getStudioTemplate('report-product-spec')?.skill).toBe('studio-report')
    expect(getStudioTemplate('image-brand-visual')?.type).toBe('image-prompt')
    expect(getStudioTemplate('video-product-demo')?.type).toBe('video-prompt')
    expect(getStudioTemplate('audio-jingle')?.type).toBe('motion')
    expect(getStudioTemplate('critique')?.type).toBe('critique')
    expect(getStudioTemplate('dcf-valuation')?.type).toBe('document')
    expect(getStudioTemplate('image-prompt-3d-stone-staircase-evolution-infographic')?.type).toBe('image-prompt')
    expect(getStudioTemplate('video-prompt-3d-animated-boy-building-lego')?.skill).toBe('studio-video')
    expect(templates.length).toBeGreaterThanOrEqual(109)
    expect(templates.filter(template => template.id.startsWith('image-prompt-'))).toHaveLength(46)
    expect(templates.filter(template => template.id.startsWith('video-prompt-'))).toHaveLength(58)
    expect(new Set(templates.map(template => template.id)).size).toBe(templates.length)
  })

  it('lists and resolves builtin Studio design systems', () => {
    const systems = listStudioDesignSystems()
    expect(systems.map(system => system.id)).toContain('saas-modern')
    expect(systems.map(system => system.id)).toContain('linear')
    expect(systems.map(system => system.id)).toContain('gradient')
    expect(getStudioDesignSystem('airbnb')).toBeTruthy()
    expect(getStudioDesignSystem('github')).toBeTruthy()
    expect(systems.length).toBeGreaterThanOrEqual(151)
    expect(getStudioDesignSystem('saas-modern')?.skill).toBe('studio-prototype')
    expect(getStudioDesignSystem('missing-system')).toBeUndefined()
    for (const template of listStudioTemplates()) {
      expect(template.recommendedDesignSystem).toBeTruthy()
      expect(getStudioDesignSystem(template.recommendedDesignSystem!)).toBeTruthy()
      expect(existsSync(template.templatePath)).toBe(true)
    }
  })

  it('creates, lists, reads, updates, and exports Studio outputs', () => {
    const sessionPath = tempSession()
    const created = createStudioOutput(sessionPath, {
      title: 'QA Landing Page',
      type: 'landing-page',
      skill: 'studio-prototype',
      sourcePrompt: 'Create a QA page',
      html: '<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body><main><h1>QA</h1></main></body></html>',
    }, 'session-1')

    expect(created.metadata.id).toBe('qa-landing-page')
    expect(created.metadata.project?.kind).toBe('single-page')
    expect(created.metadata.pages?.at(0)?.file).toBe('index.html')
    expect(existsSync(created.entryPath)).toBe(true)
    expect(listStudioOutputsForSession(sessionPath)).toHaveLength(1)
    expect(readStudioOutput(created.outputDir)?.metadata.title).toBe('QA Landing Page')

    const updated = updateStudioOutput(sessionPath, created.metadata.id, { title: 'Updated QA', html: '<!doctype html><html><body>Updated</body></html>' })
    expect(updated.metadata.title).toBe('Updated QA')

    const exported = exportStudioOutput(sessionPath, created.metadata.id, 'zip')
    expect(exported.metadata.status).toBe('exported')
    expect(exported.metadata.exports.at(-1)?.format).toBe('zip')
    expect(existsSync(join(exported.outputDir, exported.metadata.exports.at(-1)!.path))).toBe(true)
  })

  it('creates projects from templates and adds pages/components/quality', () => {
    const sessionPath = tempSession()
    const project = createStudioProject(sessionPath, { title: 'Template QA', type: 'landing-page', template: 'landing-saas' }, 'session-1')
    expect(project.metadata.templateId).toBe('landing-saas')
    expect(project.metadata.skill).toBe('studio-prototype')
    expect(project.metadata.designSystem?.source).toBe('saas-modern')
    expect(readFileSync(project.entryPath, 'utf-8')).toContain('data-studio-design-system="saas-modern"')

    const withPage = addStudioPage(sessionPath, project.metadata.id, { title: 'Pricing' })
    expect(withPage.metadata.pages?.map(page => page.id)).toContain('pricing')
    expect(existsSync(join(withPage.outputDir, 'pages', 'pricing.html'))).toBe(true)

    const withComponent = addStudioComponent(sessionPath, project.metadata.id, { title: 'Pricing block', preset: 'pricing' })
    expect(withComponent.metadata.components?.at(-1)?.preset).toBe('pricing')
    expect(existsSync(join(withComponent.outputDir, withComponent.metadata.components!.at(-1)!.file))).toBe(true)

    const quality = runStudioQuality(sessionPath, project.metadata.id)
    expect(quality.metadata.quality?.checks.map(check => check.id)).toContain('design-system')
    expect(quality.metadata.quality?.checks.map(check => check.id)).toContain('placeholder-copy')
    expect(quality.metadata.quality?.checks.find(check => check.id === 'design-system')?.status).toBe('pass')
    expect(quality.metadata.quality?.checks.find(check => check.id === 'viewport')?.status).toBe('pass')
    expect(quality.metadata.quality?.score).toBeGreaterThan(0)
  })

  it('keeps quality checks deterministic and avoids generic false positives', () => {
    const sessionPath = tempSession()
    const output = createStudioOutput(sessionPath, {
      title: 'Quality Signals',
      type: 'landing-page',
      designSystem: { source: 'saas-modern' },
      html: '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body><main><section><h1>Quality Signals</h1><h2>Clear product story</h2><p>Primary action helps teams review launch readiness.</p><a href="./export.html">Open launch review</a></section></main><style>.grid{display:grid}</style></body></html>',
    }, 'session-1')

    const quality = runStudioQuality(sessionPath, output.metadata.id)
    expect(quality.metadata.quality?.checks.find(check => check.id === 'placeholder-copy')?.status).toBe('pass')
    expect(quality.metadata.quality?.checks.find(check => check.id === 'design-system')?.status).toBe('pass')

    updateStudioOutput(sessionPath, output.metadata.id, { html: '<!doctype html><html><head><meta name="viewport" content="width=device-width"></head><body><main><section><h1>Todo</h1><h2>Placeholder</h2><p>Lorem ipsum</p></section></main></body></html>' })
    const failed = runStudioQuality(sessionPath, output.metadata.id)
    expect(failed.metadata.quality?.checks.find(check => check.id === 'placeholder-copy')?.status).toBe('fail')
  })

  it('adopts loose HTML outputs inside session data', () => {
    const sessionPath = tempSession()
    const dataDir = join(sessionPath, 'data')
    mkdirSync(dataDir, { recursive: true })
    const loosePath = join(dataDir, 'loose.html')
    writeFileSync(loosePath, '<!doctype html><html><body>Loose</body></html>', 'utf-8')

    const adopted = adoptStudioOutput(sessionPath, loosePath, {
      title: 'Adopted Loose',
      type: 'landing-page',
      skill: 'studio-prototype',
    }, 'session-1')

    expect(adopted.metadata.id).toBe('adopted-loose')
    expect(adopted.metadata.sourcePrompt).toContain('loose.html')
    expect(adopted.metadata.pages?.at(0)?.file).toBe('index.html')
    expect(existsSync(adopted.entryPath)).toBe(true)
    expect(listStudioOutputsForSession(sessionPath).map(output => output.metadata.id)).toContain('adopted-loose')
  })

  it('rejects adopt paths outside session data', () => {
    const sessionPath = tempSession()
    const externalPath = join(mkdtempSync(join(tmpdir(), 'studio-external-')), 'external.html')
    writeFileSync(externalPath, '<!doctype html><html></html>', 'utf-8')
    expect(() => adoptStudioOutput(sessionPath, externalPath, { title: 'External', type: 'landing-page' }, 'session-1')).toThrow('Adopt path must stay inside session data')
  })

  it('blocks unsafe paths and unsupported types', () => {
    const sessionPath = tempSession()
    expect(() => createStudioOutput(sessionPath, { id: '../bad', title: '../bad', type: 'landing-page' }, 'session-1')).not.toThrow()
    expect(() => createStudioOutput(sessionPath, { title: 'Bad type', type: 'unknown' as any }, 'session-1')).toThrow('Unsupported Studio output type')
    expect(() => updateStudioOutput(sessionPath, '../bad', { title: 'Nope' })).toThrow('output id must be a safe path segment')
    expect(() => createStudioOutput(sessionPath, { title: 'Missing', type: 'landing-page', template: 'missing-template' }, 'session-1')).toThrow('Studio template not found')
  })

  it('keeps curated high-impact templates domain-specific', () => {
    const curatedIds = ['web-prototype', 'saas-landing', 'dashboard', 'github-dashboard', 'html-ppt-pitch-deck', 'pm-spec', 'eng-runbook', 'critique', 'image-prompt-e-commerce-live-stream-ui-mockup', 'video-prompt-hyperframes-saas-product-promo-30s']
    for (const id of curatedIds) {
      const template = getStudioTemplate(id)
      expect(template).toBeTruthy()
      const html = readFileSync(template!.templatePath, 'utf-8')
      expect(html).not.toContain('Production-ready prompt board for Studio')
      expect(html).not.toContain('Open Design library')
      expect(html).not.toContain('Use this template to shape')
      expect(html).toContain('Curated Studio template')
    }
  })

  it('recommends Studio scenarios for common product requests', () => {
    expect(listStudioScenarios().map(scenario => scenario.id)).toContain('agent-platform')
    expect(getStudioScenario('agent-platform')?.templateIds).toContain('web-prototype')
    expect(recommendStudioScenarios('animated agent AI platform with memory and observability')[0]?.scenario.id).toBe('agent-platform')
    expect(recommendStudioScenarios('mobile onboarding app')[0]?.scenario.id).toBe('mobile-app')
    expect(recommendStudioScenarios('ops dashboard for monitoring incidents')[0]?.scenario.id).toBe('dashboard-ops')
  })

  it('accepts document, motion, and critique Studio output types', () => {
    const sessionPath = tempSession()
    for (const [title, type] of [['Document QA', 'document'], ['Motion QA', 'motion'], ['Critique QA', 'critique']] as const) {
      const output = createStudioOutput(sessionPath, { title, type }, 'session-1')
      expect(output.metadata.type).toBe(type)
      expect(existsSync(output.entryPath)).toBe(true)
    }
  })
})
