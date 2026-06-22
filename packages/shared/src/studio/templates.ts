import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { StudioTemplateDefinition } from './types.ts'

const BUILTIN_SKILLS_ROOT = join(process.cwd(), 'apps', 'electron', 'resources', 'builtin-skills')

const DEFINITIONS: Array<Omit<StudioTemplateDefinition, 'templatePath' | 'componentPaths'>> = [
  { id: 'landing-saas', title: 'SaaS Landing Page', description: 'Polished SaaS marketing page with hero, features, pricing, and FAQ.', type: 'landing-page', skill: 'studio-prototype', tags: ['landing', 'saas', 'marketing'] },
  { id: 'landing-agent', title: 'Agent Product Landing Page', description: 'Agent-focused landing page with workflow, trust, and CTA sections.', type: 'landing-page', skill: 'studio-prototype', tags: ['landing', 'agent', 'product'] },
  { id: 'dashboard-analytics', title: 'Analytics Dashboard', description: 'Metrics-heavy dashboard with cards, chart panels, and activity table.', type: 'dashboard', skill: 'studio-dashboard', tags: ['dashboard', 'analytics', 'metrics'] },
  { id: 'dashboard-admin', title: 'Admin Dashboard', description: 'Admin console with sidebar, status cards, table, and actions.', type: 'dashboard', skill: 'studio-dashboard', tags: ['dashboard', 'admin', 'ops'] },
  { id: 'deck-pitch', title: 'Pitch Deck', description: 'Narrative pitch deck structure for product, market, proof, and ask.', type: 'deck', skill: 'studio-deck', tags: ['deck', 'pitch', 'slides'] },
  { id: 'deck-product', title: 'Product Brief Deck', description: 'Product strategy deck with problem, solution, roadmap, and metrics.', type: 'deck', skill: 'studio-deck', tags: ['deck', 'product', 'brief'] },
]

const COMPONENTS: Record<string, string[]> = {
  'studio-prototype': ['hero', 'features', 'pricing', 'faq'],
  'studio-dashboard': ['sidebar', 'metric-card', 'chart-panel', 'table-panel'],
  'studio-deck': ['slide-title', 'slide-section', 'slide-comparison'],
}

function skillPath(skill: string, ...parts: string[]): string {
  return join(BUILTIN_SKILLS_ROOT, skill, ...parts)
}

export function listStudioTemplates(): StudioTemplateDefinition[] {
  return DEFINITIONS.map(def => ({
    ...def,
    templatePath: skillPath(def.skill, 'templates', `${def.id}.html`),
    componentPaths: (COMPONENTS[def.skill] ?? []).map(component => skillPath(def.skill, 'components', `${component}.html`)),
  }))
}

export function getStudioTemplate(templateId: string): StudioTemplateDefinition | undefined {
  return listStudioTemplates().find(template => template.id === templateId)
}

export function readStudioTemplateHtml(templateId: string): string {
  const template = getStudioTemplate(templateId)
  if (!template) throw new Error(`Studio template not found: ${templateId}`)
  if (!existsSync(template.templatePath)) throw new Error(`Studio template file not found: ${templateId}`)
  return readFileSync(template.templatePath, 'utf-8')
}

export function readStudioComponentHtml(skill: string, preset: string): string | undefined {
  const path = skillPath(skill, 'components', `${preset}.html`)
  return existsSync(path) ? readFileSync(path, 'utf-8') : undefined
}