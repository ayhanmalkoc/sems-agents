import { afterEach, describe, expect, it } from 'bun:test'
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { addStudioComponent, addStudioPage, adoptStudioOutput, createStudioOutput, createStudioProject, exportStudioOutput, getStudioDesignSystem, getStudioTemplate, listStudioDesignSystems, listStudioOutputsForSession, listStudioTemplates, readStudioOutput, recordStudioPdfExport, runStudioQuality, updateStudioOutput } from '../index.ts'

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
    expect(templates.length).toBeGreaterThanOrEqual(60)
    expect(new Set(templates.map(template => template.id)).size).toBe(templates.length)
  })

  it('lists and resolves builtin Studio design systems', () => {
    const systems = listStudioDesignSystems()
    expect(systems.map(system => system.id)).toContain('saas-modern')
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

    const withPage = addStudioPage(sessionPath, project.metadata.id, { title: 'Pricing' })
    expect(withPage.metadata.pages?.map(page => page.id)).toContain('pricing')
    expect(existsSync(join(withPage.outputDir, 'pages', 'pricing.html'))).toBe(true)

    const withComponent = addStudioComponent(sessionPath, project.metadata.id, { title: 'Pricing block', preset: 'pricing' })
    expect(withComponent.metadata.components?.at(-1)?.preset).toBe('pricing')
    expect(existsSync(join(withComponent.outputDir, withComponent.metadata.components!.at(-1)!.file))).toBe(true)

    const quality = runStudioQuality(sessionPath, project.metadata.id)
    expect(quality.metadata.quality?.checks.map(check => check.id)).toContain('design-system')
    expect(quality.metadata.quality?.checks.map(check => check.id)).toContain('placeholder-copy')
    expect(quality.metadata.quality?.score).toBeGreaterThan(0)
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
})