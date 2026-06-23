import { getStudioDesignSystem, getStudioTemplate, listStudioTemplates } from './templates.ts'
import type { StudioOutputType, StudioTemplateDefinition } from './types.ts'

export interface StudioScenarioDefinition {
  id: string
  title: string
  description: string
  triggers: string[]
  templateIds: string[]
  designSystemIds: string[]
  outputType: StudioOutputType
  skill: string
  guidance: string
}

export interface StudioScenarioRecommendation {
  scenario: StudioScenarioDefinition
  score: number
  templates: StudioTemplateDefinition[]
  designSystems: Array<{ id: string; title: string }>
  commandExample: string
}

const SCENARIOS: StudioScenarioDefinition[] = [
  { id: 'saas-landing', title: 'SaaS Landing Page', description: 'Marketing page for SaaS products with hero, proof, pricing, and conversion CTA.', triggers: ['saas', 'landing', 'marketing', 'pricing', 'waitlist', 'startup'], templateIds: ['saas-landing', 'landing-saas', 'pricing-page', 'waitlist-page'], designSystemIds: ['linear', 'saas-modern', 'gradient'], outputType: 'landing-page', skill: 'studio-prototype', guidance: 'Use a conversion narrative: problem, product promise, proof, pricing, CTA.' },
  { id: 'agent-platform', title: 'Agent AI Platform', description: 'Modern AI agent workspace with builder, automations, memory, tools, observability, and pricing.', triggers: ['agent', 'ai platform', 'automation', 'memory', 'tools', 'observability', 'workspace', 'animated'], templateIds: ['web-prototype', 'saas-landing', 'landing-agent', 'prototype-saas-flow'], designSystemIds: ['glassmorphism', 'gradient', 'linear'], outputType: 'prototype', skill: 'studio-prototype', guidance: 'Show agent builder, workflow canvas, memory/context, integrations, live observability, and motion-rich product polish.' },
  { id: 'mobile-app', title: 'Mobile App Prototype', description: 'Mobile app onboarding, home, detail, and settings flow.', triggers: ['mobile', 'ios', 'android', 'onboarding', 'app', 'phone'], templateIds: ['mobile-app', 'mobile-onboarding', 'prototype-mobile-flow', 'landing-mobile-app'], designSystemIds: ['consumer-mobile', 'apple', 'material'], outputType: 'prototype', skill: 'studio-prototype', guidance: 'Use phone frames, onboarding steps, tab navigation, realistic microcopy, and clear mobile hierarchy.' },
  { id: 'dashboard-ops', title: 'Operations Dashboard', description: 'Ops dashboard with KPIs, queues, events, risk, and action panels.', triggers: ['dashboard', 'ops', 'observability', 'monitoring', 'admin', 'metrics', 'kpi'], templateIds: ['dashboard', 'dashboard-ai-ops', 'live-dashboard', 'dashboard-observability', 'dashboard-admin'], designSystemIds: ['dashboard', 'dense-ops', 'hud'], outputType: 'dashboard', skill: 'studio-dashboard', guidance: 'Prioritize KPI rail, event stream, action queue, charts, and operational triage.' },
  { id: 'investor-deck', title: 'Investor Deck', description: 'Investor or pitch presentation with story, market, proof, roadmap, and ask.', triggers: ['pitch', 'investor', 'deck', 'fundraising', 'slides', 'presentation'], templateIds: ['html-ppt-pitch-deck', 'deck-pitch', 'deck-investor-update', 'simple-deck'], designSystemIds: ['pitch-dark', 'linear', 'editorial'], outputType: 'deck', skill: 'studio-deck', guidance: 'Build a slide narrative: why now, product, traction, market, roadmap, ask.' },
  { id: 'product-launch', title: 'Product Launch', description: 'Launch page/deck/video planning for a new product.', triggers: ['launch', 'release', 'go to market', 'gtm', 'announcement', 'promo'], templateIds: ['html-ppt-product-launch', 'deck-launch', 'open-design-landing', 'video-prompt-hyperframes-saas-product-promo-30s'], designSystemIds: ['gradient', 'pitch-dark', 'launch-motion'], outputType: 'deck', skill: 'studio-deck', guidance: 'Use launch story, audience, moments, channels, proof, CTA, and launch assets.' },
  { id: 'product-spec', title: 'Product Spec', description: 'Decision-ready PM spec or product requirements document.', triggers: ['spec', 'prd', 'requirements', 'product spec', 'pm', 'feature'], templateIds: ['pm-spec', 'report-product-spec', 'report-strategy-memo'], designSystemIds: ['product-spec', 'linear', 'enterprise'], outputType: 'document', skill: 'studio-report', guidance: 'Include context, goals, non-goals, user stories, requirements, risks, and rollout plan.' },
  { id: 'engineering-runbook', title: 'Engineering Runbook', description: 'Operational runbook for engineering response and maintenance.', triggers: ['runbook', 'incident', 'sre', 'engineering', 'ops guide', 'oncall'], templateIds: ['eng-runbook', 'report-qa', 'report-audit'], designSystemIds: ['enterprise', 'github', 'minimal'], outputType: 'document', skill: 'studio-report', guidance: 'Include symptoms, checks, commands, escalation, recovery, validation, and owner notes.' },
  { id: 'design-critique', title: 'Design Critique', description: 'Structured critique or improvement plan for an existing output.', triggers: ['critique', 'review', 'improve', 'tweak', 'polish', 'evaluate'], templateIds: ['critique', 'tweaks', 'deck-design-review'], designSystemIds: ['minimal', 'editorial', 'product-spec'], outputType: 'critique', skill: 'studio-report', guidance: 'Use rubric, evidence, severity, concrete recommendations, and next iteration plan.' },
  { id: 'image-campaign', title: 'Image Campaign', description: 'Image prompt board for brand, product, social, or campaign visuals.', triggers: ['image', 'visual', 'poster', 'campaign', 'social', 'mockup', 'avatar'], templateIds: ['image-campaign-board', 'image-social-pack', 'image-prompt-e-commerce-live-stream-ui-mockup', 'image-prompt-social-media-post-fashion-editorial-collage'], designSystemIds: ['brand-visual', 'editorial', 'creative'], outputType: 'image-prompt', skill: 'studio-image', guidance: 'Define subject, composition, art direction, constraints, variants, and usage notes.' },
  { id: 'video-promo', title: 'Video Promo', description: 'Video prompt/storyboard for product demos, launch films, ads, and social promos.', triggers: ['video', 'promo', 'ad', 'storyboard', 'demo', 'shortform', 'reel'], templateIds: ['video-prompt-hyperframes-saas-product-promo-30s', 'video-product-demo', 'video-ad-storyboard', 'video-shortform'], designSystemIds: ['launch-motion', 'gradient', 'demo-storyboard'], outputType: 'video-prompt', skill: 'studio-video', guidance: 'Create hook, sequence, camera, pacing, captions, product beats, and export constraints.' },
  { id: 'motion-storyboard', title: 'Motion Storyboard', description: 'Motion design or Hyperframes-style animation brief.', triggers: ['motion', 'animation', 'hyperframes', 'kinetic', 'sequence', 'transition'], templateIds: ['motion-frames', 'hyperframes', 'video-prompt-hyperframes-html-in-canvas-liquid-glass', 'audio-jingle'], designSystemIds: ['gradient', 'creative', 'launch-motion'], outputType: 'motion', skill: 'studio-video', guidance: 'Plan motion states, timing, transitions, camera movement, beats, and implementation constraints.' },
]

function tokenize(value: string): string[] {
  return value.toLowerCase().split(/[^a-z0-9]+/).filter(token => token.length > 1)
}

function scoreScenario(prompt: string, scenario: StudioScenarioDefinition): number {
  const lower = prompt.toLowerCase()
  const promptTokens = new Set(tokenize(prompt))
  let score = 0
  for (const trigger of scenario.triggers) {
    if (lower.includes(trigger.toLowerCase())) score += trigger.includes(' ') ? 8 : 5
    for (const token of tokenize(trigger)) if (promptTokens.has(token)) score += 2
  }
  for (const templateId of scenario.templateIds) for (const token of tokenize(templateId)) if (promptTokens.has(token)) score += 1
  return score
}

export function listStudioScenarios(): StudioScenarioDefinition[] { return SCENARIOS.map(scenario => ({ ...scenario, triggers: [...scenario.triggers], templateIds: [...scenario.templateIds], designSystemIds: [...scenario.designSystemIds] })) }

export function getStudioScenario(id: string): StudioScenarioDefinition | undefined { return listStudioScenarios().find(scenario => scenario.id === id) }

export function recommendStudioScenarios(prompt: string, limit = 3): StudioScenarioRecommendation[] {
  const fallbackTemplates = listStudioTemplates()
  return listStudioScenarios()
    .map(scenario => ({ scenario, score: scoreScenario(prompt, scenario) }))
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || a.scenario.id.localeCompare(b.scenario.id))
    .slice(0, limit)
    .map(({ scenario, score }) => {
      const templates = scenario.templateIds.map(getStudioTemplate).filter((template): template is StudioTemplateDefinition => Boolean(template))
      const resolvedTemplates = templates.length ? templates : fallbackTemplates.filter(template => template.skill === scenario.skill).slice(0, 3)
      const designSystems = scenario.designSystemIds.map(id => getStudioDesignSystem(id)).filter((system): system is NonNullable<ReturnType<typeof getStudioDesignSystem>> => Boolean(system)).map(system => ({ id: system.id, title: system.title }))
      const primaryTemplate = resolvedTemplates[0]
      const primaryDesignSystem = designSystems[0]
      const designSystemJson = primaryDesignSystem ? `,"designSystem":{"source":"${primaryDesignSystem.id}"}` : ''
      return {
        scenario,
        score,
        templates: resolvedTemplates,
        designSystems,
        commandExample: primaryTemplate ? `studio({ command: "create {\"title\":\"${scenario.title}\",\"type\":\"${scenario.outputType}\",\"template\":\"${primaryTemplate.id}\"${designSystemJson}}" })` : 'studio({ command: "templates" })',
      }
    })
}
