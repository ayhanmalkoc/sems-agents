import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { StudioTemplateDefinition } from './types.ts'

const BUILTIN_SKILLS_ROOT = join(process.cwd(), 'apps', 'electron', 'resources', 'builtin-skills')

const DEFINITIONS: Array<Omit<StudioTemplateDefinition, 'templatePath' | 'componentPaths'>> = [
  { id: 'landing-saas', title: 'SaaS Landing Page', description: 'Polished SaaS marketing page with hero, features, pricing, and FAQ.', type: 'landing-page', skill: 'studio-prototype', tags: ['landing', 'saas', 'marketing'] },
  { id: 'landing-agent', title: 'Agent Product Landing Page', description: 'Agent-focused landing page with workflow, trust, and CTA sections.', type: 'landing-page', skill: 'studio-prototype', tags: ['landing', 'agent', 'product'] },
  { id: 'landing-mobile-app', title: 'Mobile App Landing Page', description: 'App launch page with phone-first product story and conversion sections.', type: 'landing-page', skill: 'studio-prototype', tags: ['landing', 'mobile', 'app'] },
  { id: 'landing-web-app', title: 'Web App Product Page', description: 'Web app launch page with workflow, integrations, and pricing preview.', type: 'landing-page', skill: 'studio-prototype', tags: ['landing', 'web-app', 'product'] },
  { id: 'prototype-mobile-flow', title: 'Mobile Flow Prototype', description: 'Mobile product flow prototype with onboarding, action, and success states.', type: 'prototype', skill: 'studio-prototype', tags: ['prototype', 'mobile', 'flow'] },
  { id: 'prototype-saas-flow', title: 'SaaS Flow Prototype', description: 'SaaS workflow prototype with setup, command center, detail, and outcome screens.', type: 'prototype', skill: 'studio-prototype', tags: ['prototype', 'saas', 'workflow'] },
  { id: 'commerce-storefront', title: 'Commerce Storefront', description: 'Modern storefront with editorial hero, product grid, trust strip, and checkout CTA.', type: 'prototype', skill: 'studio-prototype', tags: ['commerce', 'storefront', 'product'] },
  { id: 'portfolio-case-study', title: 'Portfolio Case Study', description: 'Case study page for portfolio storytelling, process, outcomes, and contact CTA.', type: 'prototype', skill: 'studio-prototype', tags: ['portfolio', 'case-study', 'story'] },
  { id: 'dashboard-analytics', title: 'Analytics Dashboard', description: 'Metrics-heavy dashboard with cards, chart panels, and activity table.', type: 'dashboard', skill: 'studio-dashboard', tags: ['dashboard', 'analytics', 'metrics'] },
  { id: 'dashboard-admin', title: 'Admin Dashboard', description: 'Admin console with sidebar, status cards, table, and actions.', type: 'dashboard', skill: 'studio-dashboard', tags: ['dashboard', 'admin', 'ops'] },
  { id: 'dashboard-finance', title: 'Finance Dashboard', description: 'Finance operations dashboard with runway, variance, cashflow, and export summary.', type: 'dashboard', skill: 'studio-dashboard', tags: ['dashboard', 'finance', 'ops'] },
  { id: 'dashboard-support', title: 'Support Command Center', description: 'Support dashboard with queue health, SLA, incidents, and knowledge gaps.', type: 'dashboard', skill: 'studio-dashboard', tags: ['dashboard', 'support', 'ops'] },
  { id: 'dashboard-ai-ops', title: 'AI Ops Dashboard', description: 'AI operations dashboard with model health, run stream, guardrails, and optimization.', type: 'dashboard', skill: 'studio-dashboard', tags: ['dashboard', 'ai', 'ops'] },
  { id: 'dashboard-crm', title: 'CRM Pipeline Dashboard', description: 'Sales pipeline dashboard with revenue stages, deals, activity, and coaching insights.', type: 'dashboard', skill: 'studio-dashboard', tags: ['dashboard', 'crm', 'sales'] },
  { id: 'deck-pitch', title: 'Pitch Deck', description: 'Narrative pitch deck structure for product, market, proof, and ask.', type: 'deck', skill: 'studio-deck', tags: ['deck', 'pitch', 'slides'] },
  { id: 'deck-product', title: 'Product Brief Deck', description: 'Product strategy deck with problem, solution, roadmap, and metrics.', type: 'deck', skill: 'studio-deck', tags: ['deck', 'product', 'brief'] },
  { id: 'deck-case-study', title: 'Case Study Deck', description: 'Customer story deck with challenge, solution, impact, and replication path.', type: 'deck', skill: 'studio-deck', tags: ['deck', 'case-study', 'customer'] },
  { id: 'deck-investor-update', title: 'Investor Update Deck', description: 'Investor update with highlights, metrics, roadmap, and support needed.', type: 'deck', skill: 'studio-deck', tags: ['deck', 'investor', 'update'] },
  { id: 'deck-design-review', title: 'Design Review Deck', description: 'Design critique deck with context, options, recommendation, and decision log.', type: 'deck', skill: 'studio-deck', tags: ['deck', 'design', 'review'] },
  { id: 'report-research', title: 'Research Report', description: 'Decision-ready research report with summary, evidence, implications, and next steps.', type: 'report', skill: 'studio-report', tags: ['report', 'research', 'analysis'] },
  { id: 'report-product-spec', title: 'Product Spec Report', description: 'Product spec report with problem, scope, acceptance criteria, and launch plan.', type: 'report', skill: 'studio-report', tags: ['report', 'product', 'spec'] },
  { id: 'report-design-system', title: 'Design System Report', description: 'Design system report with foundations, components, patterns, and governance.', type: 'report', skill: 'studio-report', tags: ['report', 'design-system', 'components'] },
  { id: 'image-brand-visual', title: 'Brand Visual Prompt Board', description: 'Image prompt board for brand visuals, art direction, variants, and usage.', type: 'image-prompt', skill: 'studio-image', tags: ['image', 'prompt', 'brand'] },
  { id: 'image-product-mockup', title: 'Product Mockup Prompt Board', description: 'Image prompt board for product mockups, UI states, scenes, and variants.', type: 'image-prompt', skill: 'studio-image', tags: ['image', 'prompt', 'mockup'] },
  { id: 'video-launch-storyboard', title: 'Launch Video Storyboard', description: 'Video storyboard for product launch hook, problem, reveal, and CTA.', type: 'video-prompt', skill: 'studio-video', tags: ['video', 'storyboard', 'launch'] },
  { id: 'video-product-demo', title: 'Product Demo Storyboard', description: 'Video storyboard for product demo setup, walkthrough, outcome, and cutdowns.', type: 'video-prompt', skill: 'studio-video', tags: ['video', 'demo', 'storyboard'] },
]

const COMPONENTS: Record<string, string[]> = {
  'studio-prototype': ['hero', 'features', 'pricing', 'faq', 'testimonial', 'cta-band', 'app-shell', 'feature-grid', 'commerce-card', 'case-study-block'],
  'studio-dashboard': ['sidebar', 'metric-card', 'chart-panel', 'table-panel', 'filter-bar', 'status-feed', 'insight-card', 'risk-list', 'sparkline-card'],
  'studio-deck': ['slide-title', 'slide-section', 'slide-comparison', 'slide-metric', 'slide-timeline', 'slide-quote', 'slide-roadmap'],
  'studio-report': ['executive-summary', 'evidence-table', 'recommendation-card', 'decision-log'],
  'studio-image': ['prompt-card', 'style-frame', 'variant-grid'],
  'studio-video': ['storyboard-scene', 'shot-list', 'timeline-beat'],
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