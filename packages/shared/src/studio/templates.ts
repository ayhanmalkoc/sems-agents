import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { StudioDesignSystemDefinition, StudioTemplateCategory, StudioTemplateDefinition } from './types.ts'

const BUILTIN_SKILLS_ROOT = join(process.cwd(), 'apps', 'electron', 'resources', 'builtin-skills')

const DEFINITIONS: Array<Omit<StudioTemplateDefinition, 'templatePath' | 'componentPaths' | 'category' | 'recommendedDesignSystem'>> = [
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
  { id: 'agency-home', title: 'Agency Homepage', description: 'Agency homepage with positioning, services, proof, and conversion path.', type: 'prototype', skill: 'studio-prototype', tags: ['agency', 'web'] },
  { id: 'startup-waitlist', title: 'Startup Waitlist', description: 'Waitlist page for early access, product promise, proof, and signup CTA.', type: 'landing-page', skill: 'studio-prototype', tags: ['startup', 'waitlist'] },
  { id: 'docs-home', title: 'Documentation Home', description: 'Developer documentation homepage with guides, API paths, and quick starts.', type: 'prototype', skill: 'studio-prototype', tags: ['docs', 'developer'] },
  { id: 'changelog-page', title: 'Changelog Page', description: 'Product changelog page for releases, tags, and update storytelling.', type: 'prototype', skill: 'studio-prototype', tags: ['changelog', 'updates'] },
  { id: 'community-home', title: 'Community Home', description: 'Community landing page with member value, events, and participation CTAs.', type: 'prototype', skill: 'studio-prototype', tags: ['community', 'social'] },
  { id: 'settings-screen', title: 'Settings Screen', description: 'App settings screen with preferences, account, security, and workspace sections.', type: 'prototype', skill: 'studio-prototype', tags: ['settings', 'app'] },
  { id: 'inbox-screen', title: 'Inbox Screen', description: 'Inbox productivity screen with messages, filters, and detail preview.', type: 'prototype', skill: 'studio-prototype', tags: ['inbox', 'messages'] },
  { id: 'kanban-board', title: 'Kanban Board', description: 'Workflow board with columns, cards, owners, status, and action controls.', type: 'prototype', skill: 'studio-prototype', tags: ['kanban', 'workflow'] },
  { id: 'billing-screen', title: 'Billing Screen', description: 'Billing and subscription screen with plan, invoices, payment, and usage.', type: 'prototype', skill: 'studio-prototype', tags: ['billing', 'account'] },
  { id: 'command-center', title: 'Command Center', description: 'Workspace command center with overview, actions, tasks, and status.', type: 'prototype', skill: 'studio-prototype', tags: ['command', 'workspace'] },
  { id: 'mobile-profile', title: 'Mobile Profile', description: 'Mobile profile screen with identity, stats, activity, and actions.', type: 'prototype', skill: 'studio-prototype', tags: ['mobile', 'profile'] },
  { id: 'mobile-paywall', title: 'Mobile Paywall', description: 'Mobile paywall screen with value, plans, trial, and trust cues.', type: 'prototype', skill: 'studio-prototype', tags: ['mobile', 'paywall'] },
  { id: 'mobile-chat', title: 'Mobile Chat', description: 'Mobile chat screen with conversation, composer, and assistant states.', type: 'prototype', skill: 'studio-prototype', tags: ['mobile', 'chat'] },
  { id: 'mobile-activity', title: 'Mobile Activity', description: 'Mobile activity feed with timeline, filters, and detail states.', type: 'prototype', skill: 'studio-prototype', tags: ['mobile', 'activity'] },
  { id: 'desktop-editor', title: 'Desktop Editor', description: 'Desktop editor layout with toolbar, canvas, inspector, and status bar.', type: 'prototype', skill: 'studio-prototype', tags: ['desktop', 'editor'] },
  { id: 'desktop-file-manager', title: 'Desktop File Manager', description: 'Desktop file manager with sidebar, grid, preview, and metadata.', type: 'prototype', skill: 'studio-prototype', tags: ['desktop', 'files'] },
  { id: 'desktop-inspector', title: 'Desktop Inspector', description: 'Desktop inspector panel for object details, properties, and actions.', type: 'prototype', skill: 'studio-prototype', tags: ['desktop', 'inspector'] },
  { id: 'dashboard-security', title: 'Security Dashboard', description: 'Security dashboard with risk, alerts, posture, and investigation queue.', type: 'dashboard', skill: 'studio-dashboard', tags: ['security', 'dashboard'] },
  { id: 'dashboard-observability', title: 'Observability Dashboard', description: 'Observability dashboard with services, logs, traces, and incidents.', type: 'dashboard', skill: 'studio-dashboard', tags: ['observability', 'logs'] },
  { id: 'dashboard-marketing', title: 'Marketing Dashboard', description: 'Marketing dashboard with campaigns, funnel, attribution, and channel mix.', type: 'dashboard', skill: 'studio-dashboard', tags: ['marketing', 'analytics'] },
  { id: 'dashboard-product', title: 'Product Analytics Dashboard', description: 'Product analytics dashboard with activation, retention, cohorts, and events.', type: 'dashboard', skill: 'studio-dashboard', tags: ['product', 'analytics'] },
  { id: 'dashboard-infra', title: 'Infrastructure Dashboard', description: 'Infrastructure dashboard with capacity, health, deploys, and alerts.', type: 'dashboard', skill: 'studio-dashboard', tags: ['infra', 'ops'] },
  { id: 'deck-sales', title: 'Sales Deck', description: 'Sales deck with pain, product, proof, ROI, and next steps.', type: 'deck', skill: 'studio-deck', tags: ['sales', 'deck'] },
  { id: 'deck-roadmap', title: 'Roadmap Deck', description: 'Roadmap deck with strategy, milestones, bets, and dependencies.', type: 'deck', skill: 'studio-deck', tags: ['roadmap', 'deck'] },
  { id: 'deck-launch', title: 'Launch Deck', description: 'Launch deck with audience, plan, channels, timeline, and risks.', type: 'deck', skill: 'studio-deck', tags: ['launch', 'deck'] },
  { id: 'deck-board-update', title: 'Board Update Deck', description: 'Board update deck with highlights, metrics, risks, and asks.', type: 'deck', skill: 'studio-deck', tags: ['board', 'update'] },
  { id: 'report-audit', title: 'Audit Report', description: 'Audit report with findings, evidence, severity, and remediation plan.', type: 'report', skill: 'studio-report', tags: ['audit', 'report'] },
  { id: 'report-qa', title: 'QA Report', description: 'QA report with coverage, failures, risk, and release recommendation.', type: 'report', skill: 'studio-report', tags: ['qa', 'quality'] },
  { id: 'report-strategy-memo', title: 'Strategy Memo', description: 'Strategy memo with context, options, recommendation, and decision log.', type: 'report', skill: 'studio-report', tags: ['strategy', 'memo'] },
  { id: 'report-research-synthesis', title: 'Research Synthesis', description: 'Research synthesis with themes, evidence, implications, and decisions.', type: 'report', skill: 'studio-report', tags: ['research', 'synthesis'] },
  { id: 'image-campaign-board', title: 'Campaign Image Board', description: 'Image prompt board for campaign directions, variants, and usage.', type: 'image-prompt', skill: 'studio-image', tags: ['image', 'campaign'] },
  { id: 'image-social-pack', title: 'Social Image Pack', description: 'Image prompt pack for social assets, aspect ratios, and variants.', type: 'image-prompt', skill: 'studio-image', tags: ['image', 'social'] },
  { id: 'video-ad-storyboard', title: 'Ad Storyboard', description: 'Video ad storyboard with hook, product reveal, proof, and CTA.', type: 'video-prompt', skill: 'studio-video', tags: ['video', 'ad'] },
  { id: 'video-onboarding-flow', title: 'Onboarding Video Flow', description: 'Onboarding video flow with steps, narration, and cutdowns.', type: 'video-prompt', skill: 'studio-video', tags: ['video', 'onboarding'] },
]


const TEMPLATE_METADATA: Record<string, { category: StudioTemplateCategory; recommendedDesignSystem: string }> = {
  'landing-saas': { category: 'web', recommendedDesignSystem: 'saas-modern' },
  'landing-agent': { category: 'web', recommendedDesignSystem: 'saas-modern' },
  'landing-mobile-app': { category: 'mobile', recommendedDesignSystem: 'consumer-mobile' },
  'landing-web-app': { category: 'app', recommendedDesignSystem: 'saas-modern' },
  'prototype-mobile-flow': { category: 'mobile', recommendedDesignSystem: 'consumer-mobile' },
  'prototype-saas-flow': { category: 'app', recommendedDesignSystem: 'saas-modern' },
  'commerce-storefront': { category: 'web', recommendedDesignSystem: 'commerce-editorial' },
  'portfolio-case-study': { category: 'web', recommendedDesignSystem: 'saas-modern' },
  'dashboard-analytics': { category: 'dashboard', recommendedDesignSystem: 'executive-analytics' },
  'dashboard-admin': { category: 'dashboard', recommendedDesignSystem: 'dense-ops' },
  'dashboard-finance': { category: 'dashboard', recommendedDesignSystem: 'executive-analytics' },
  'dashboard-support': { category: 'dashboard', recommendedDesignSystem: 'dense-ops' },
  'dashboard-ai-ops': { category: 'dashboard', recommendedDesignSystem: 'ai-command' },
  'dashboard-crm': { category: 'dashboard', recommendedDesignSystem: 'executive-analytics' },
  'deck-pitch': { category: 'deck', recommendedDesignSystem: 'pitch-dark' },
  'deck-product': { category: 'deck', recommendedDesignSystem: 'strategy-light' },
  'deck-case-study': { category: 'deck', recommendedDesignSystem: 'strategy-light' },
  'deck-investor-update': { category: 'deck', recommendedDesignSystem: 'pitch-dark' },
  'deck-design-review': { category: 'deck', recommendedDesignSystem: 'strategy-light' },
  'report-research': { category: 'report', recommendedDesignSystem: 'research-paper' },
  'report-product-spec': { category: 'report', recommendedDesignSystem: 'product-spec' },
  'report-design-system': { category: 'report', recommendedDesignSystem: 'product-spec' },
  'image-brand-visual': { category: 'image', recommendedDesignSystem: 'brand-visual' },
  'image-product-mockup': { category: 'image', recommendedDesignSystem: 'product-mockup' },
  'video-launch-storyboard': { category: 'video', recommendedDesignSystem: 'launch-motion' },
  'video-product-demo': { category: 'video', recommendedDesignSystem: 'demo-storyboard' },
  'agency-home': { category: 'web', recommendedDesignSystem: 'saas-modern' },
  'startup-waitlist': { category: 'web', recommendedDesignSystem: 'saas-modern' },
  'docs-home': { category: 'web', recommendedDesignSystem: 'saas-modern' },
  'changelog-page': { category: 'web', recommendedDesignSystem: 'saas-modern' },
  'community-home': { category: 'web', recommendedDesignSystem: 'consumer-mobile' },
  'settings-screen': { category: 'app', recommendedDesignSystem: 'saas-modern' },
  'inbox-screen': { category: 'app', recommendedDesignSystem: 'saas-modern' },
  'kanban-board': { category: 'app', recommendedDesignSystem: 'saas-modern' },
  'billing-screen': { category: 'app', recommendedDesignSystem: 'saas-modern' },
  'command-center': { category: 'app', recommendedDesignSystem: 'saas-modern' },
  'mobile-profile': { category: 'mobile', recommendedDesignSystem: 'consumer-mobile' },
  'mobile-paywall': { category: 'mobile', recommendedDesignSystem: 'consumer-mobile' },
  'mobile-chat': { category: 'mobile', recommendedDesignSystem: 'consumer-mobile' },
  'mobile-activity': { category: 'mobile', recommendedDesignSystem: 'consumer-mobile' },
  'desktop-editor': { category: 'app', recommendedDesignSystem: 'saas-modern' },
  'desktop-file-manager': { category: 'app', recommendedDesignSystem: 'saas-modern' },
  'desktop-inspector': { category: 'app', recommendedDesignSystem: 'saas-modern' },
  'dashboard-security': { category: 'dashboard', recommendedDesignSystem: 'dense-ops' },
  'dashboard-observability': { category: 'dashboard', recommendedDesignSystem: 'dense-ops' },
  'dashboard-marketing': { category: 'dashboard', recommendedDesignSystem: 'executive-analytics' },
  'dashboard-product': { category: 'dashboard', recommendedDesignSystem: 'executive-analytics' },
  'dashboard-infra': { category: 'dashboard', recommendedDesignSystem: 'dense-ops' },
  'deck-sales': { category: 'deck', recommendedDesignSystem: 'pitch-dark' },
  'deck-roadmap': { category: 'deck', recommendedDesignSystem: 'strategy-light' },
  'deck-launch': { category: 'deck', recommendedDesignSystem: 'pitch-dark' },
  'deck-board-update': { category: 'deck', recommendedDesignSystem: 'pitch-dark' },
  'report-audit': { category: 'report', recommendedDesignSystem: 'research-paper' },
  'report-qa': { category: 'report', recommendedDesignSystem: 'product-spec' },
  'report-strategy-memo': { category: 'report', recommendedDesignSystem: 'product-spec' },
  'report-research-synthesis': { category: 'report', recommendedDesignSystem: 'research-paper' },
  'image-campaign-board': { category: 'image', recommendedDesignSystem: 'brand-visual' },
  'image-social-pack': { category: 'image', recommendedDesignSystem: 'brand-visual' },
  'video-ad-storyboard': { category: 'video', recommendedDesignSystem: 'launch-motion' },
  'video-onboarding-flow': { category: 'video', recommendedDesignSystem: 'demo-storyboard' },
}

const DESIGN_SYSTEMS: Record<string, string[]> = {
  'studio-prototype': ['saas-modern', 'consumer-mobile', 'commerce-editorial'],
  'studio-dashboard': ['dense-ops', 'executive-analytics', 'ai-command'],
  'studio-deck': ['pitch-dark', 'strategy-light'],
  'studio-report': ['research-paper', 'product-spec'],
  'studio-image': ['brand-visual', 'product-mockup'],
  'studio-video': ['launch-motion', 'demo-storyboard'],
}

const COMPONENTS: Record<string, string[]> = {
  'studio-prototype': ['hero', 'features', 'pricing', 'faq', 'testimonial', 'cta-band', 'app-shell', 'feature-grid', 'commerce-card', 'case-study-block', 'nav-shell', 'settings-panel', 'inbox-list', 'kanban-column', 'billing-table', 'mobile-frame', 'desktop-toolbar'],
  'studio-dashboard': ['sidebar', 'metric-card', 'chart-panel', 'table-panel', 'filter-bar', 'status-feed', 'insight-card', 'risk-list', 'sparkline-card', 'alert-table', 'log-stream', 'funnel-chart', 'security-score'],
  'studio-deck': ['slide-title', 'slide-section', 'slide-comparison', 'slide-metric', 'slide-timeline', 'slide-quote', 'slide-roadmap', 'slide-agenda', 'slide-ask', 'slide-status'],
  'studio-report': ['executive-summary', 'evidence-table', 'recommendation-card', 'decision-log', 'risk-register', 'qa-summary', 'memo-header'],
  'studio-image': ['prompt-card', 'style-frame', 'variant-grid', 'campaign-frame', 'social-tile'],
  'studio-video': ['storyboard-scene', 'shot-list', 'timeline-beat', 'ad-beat', 'onboarding-step'],
}

function skillPath(skill: string, ...parts: string[]): string {
  return join(BUILTIN_SKILLS_ROOT, skill, ...parts)
}

export function listStudioTemplates(): StudioTemplateDefinition[] {
  return DEFINITIONS.map(def => {
    const metadata = TEMPLATE_METADATA[def.id] ?? { category: 'web' as const, recommendedDesignSystem: undefined }
    return {
      ...def,
      ...metadata,
      templatePath: skillPath(def.skill, 'templates', `${def.id}.html`),
      componentPaths: (COMPONENTS[def.skill] ?? []).map(component => skillPath(def.skill, 'components', `${component}.html`)),
    }
  })
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

function designSystemPath(skill: string, id: string): string {
  return skillPath(skill, 'design-systems', `${id}.json`)
}

export function listStudioDesignSystems(): StudioDesignSystemDefinition[] {
  return Object.entries(DESIGN_SYSTEMS).flatMap(([skill, ids]) => ids.map(id => getStudioDesignSystem(id)).filter((item): item is StudioDesignSystemDefinition => Boolean(item)))
}

export function getStudioDesignSystem(id: string): StudioDesignSystemDefinition | undefined {
  for (const [skill, ids] of Object.entries(DESIGN_SYSTEMS)) {
    if (!ids.includes(id)) continue
    const path = designSystemPath(skill, id)
    if (!existsSync(path)) return undefined
    const parsed = JSON.parse(readFileSync(path, 'utf-8')) as StudioDesignSystemDefinition
    return parsed.id === id ? parsed : undefined
  }
  return undefined
}
