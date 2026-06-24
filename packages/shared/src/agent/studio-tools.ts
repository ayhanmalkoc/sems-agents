import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import { getStudioScenario, listStudioScenarios, recommendStudioScenarios, type StudioScenarioDefinition, type StudioScenarioRecommendation } from '../studio/scenarios.ts'
import type { AddStudioComponentInput, AddStudioImageAssetInput, AddStudioPageInput, AdoptStudioOutputInput, CreateStudioOutputInput, CreateStudioProjectInput, StudioAssetRecord, StudioDesignSystemDefinition, StudioExportFormat, StudioOutputRecord, StudioTemplateDefinition, UpdateStudioOutputInput } from '../studio/types.ts'

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean }

export interface StudioStatusSnapshot { available: boolean; outputs: number; reason?: string }
export interface StudioFns {
  resolveOutput?: (outputId: string) => Promise<StudioOutputRecord | undefined>
  status: () => Promise<StudioStatusSnapshot>
  list: () => Promise<StudioOutputRecord[]>
  show: (outputId: string) => Promise<StudioOutputRecord | undefined>
  create: (input: CreateStudioOutputInput) => Promise<StudioOutputRecord>
  update: (outputId: string, input: UpdateStudioOutputInput) => Promise<StudioOutputRecord>
  exportOutput: (outputId: string, format: StudioExportFormat) => Promise<StudioOutputRecord>
  adopt: (htmlPath: string, input: AdoptStudioOutputInput) => Promise<StudioOutputRecord>
  templates: () => Promise<StudioTemplateDefinition[]>
  template: (templateId: string) => Promise<StudioTemplateDefinition | undefined>
  designSystems: () => Promise<StudioDesignSystemDefinition[]>
  designSystem: (id: string) => Promise<StudioDesignSystemDefinition | undefined>
  createProject: (input: CreateStudioProjectInput) => Promise<StudioOutputRecord>
  addPage: (outputId: string, input: AddStudioPageInput) => Promise<StudioOutputRecord>
  addComponent: (outputId: string, input: AddStudioComponentInput) => Promise<StudioOutputRecord>
  quality: (outputId: string) => Promise<StudioOutputRecord>
  generateImage?: (outputId: string, input: Omit<AddStudioImageAssetInput, 'bytesBase64'> & { bytesBase64?: string }) => Promise<StudioOutputRecord>
}

const StudioSchema = z.object({
  command: z.string().describe('Studio command: status, list, show <outputId>, templates, template <templateId>, scenarios, scenario <id>, recommend <json>, design-systems, design-system <id>, create <json>, create-project <json>, update <outputId> <json>, add-page <outputId> <json>, add-component <outputId> <json>, quality <outputId>, generate-image <outputId> <json>, assets <outputId>, asset <outputId> <assetId>, export <outputId> <html|zip|pdf>, adopt <absoluteHtmlPath> <json>.'),
})

function success(text: string): ToolResult { return { content: [{ type: 'text', text }] } }
function failure(text: string): ToolResult { return { content: [{ type: 'text', text: `Error: ${text}` }], isError: true } }

function parseJsonPayload<T>(value: string, label: string): T {
  if (!value.trim()) throw new Error(`${label} requires a JSON payload`)
  try { return JSON.parse(value) as T } catch (error) { throw new Error(`Invalid JSON payload: ${error instanceof Error ? error.message : String(error)}`) }
}

function formatOutput(record: StudioOutputRecord): string {
  const m = record.metadata
  return `- ${m.id} type=${m.type} status=${m.status} title=${JSON.stringify(m.title)} template=${m.templateId ?? 'none'} pages=${m.pages?.length ?? 0} components=${m.components?.length ?? 0} entry=${record.entryPath} session=${m.sessionId}`
}

function formatTemplate(template: StudioTemplateDefinition): string {
  return `- ${template.id} type=${template.type} category=${template.category} skill=${template.skill} designSystem=${template.recommendedDesignSystem ?? 'none'} title=${JSON.stringify(template.title)} tags=${template.tags.join(',')}`
}

function formatScenario(scenario: StudioScenarioDefinition): string {
  return `- ${scenario.id} type=${scenario.outputType} skill=${scenario.skill} templates=${scenario.templateIds.slice(0, 4).join(',')} designSystems=${scenario.designSystemIds.slice(0, 3).join(',')} title=${JSON.stringify(scenario.title)}`
}

function formatRecommendation(item: StudioScenarioRecommendation): string {
  return [
    `- ${item.scenario.id} score=${item.score} type=${item.scenario.outputType} skill=${item.scenario.skill}`,
    `  templates=${item.templates.slice(0, 4).map(template => template.id).join(',') || 'none'}`,
    `  designSystems=${item.designSystems.slice(0, 3).map(system => system.id).join(',') || 'none'}`,
    `  guidance=${item.scenario.guidance}`,
    `  command=${item.commandExample}`,
  ].join('\n')
}
function formatDesignSystem(system: StudioDesignSystemDefinition): string {
  const colors = system.tokens.colors ? Object.entries(system.tokens.colors).map(([key, value]) => `${key}:${value}`).join(',') : 'none'
  return `- ${system.id} skill=${system.skill} title=${JSON.stringify(system.title)} density=${system.tokens.density ?? 'default'} colors=${colors}`
}

function formatAsset(asset: StudioAssetRecord): string {
  return `- ${asset.id} type=${asset.type} mime=${asset.mimeType} provider=${asset.provider} model=${asset.model} path=${asset.path} prompt=${JSON.stringify(asset.prompt)}`
}

function formatDetail(record: StudioOutputRecord): string {
  const m = record.metadata
  const exports = m.exports.length ? m.exports.map(item => `${item.format}:${item.path}`).join(', ') : 'none'
  const assets = m.assets?.length ? m.assets.map(item => `${item.id}:${item.path}`).join(', ') : 'none'
  const quality = m.quality ? `${m.quality.score}/100 (${m.quality.checks.map(check => `${check.id}:${check.status}`).join(', ')})` : 'not run'
  return [
    `Studio output ${m.id}`,
    `Title: ${m.title}`,
    `Type: ${m.type}`,
    `Status: ${m.status}`,
    `Template: ${m.templateId ?? 'none'}`,
    `Project: ${m.project?.kind ?? 'single-page'}`,
    `Pages: ${m.pages?.map(page => `${page.id}:${page.file}`).join(', ') || 'none'}`,
    `Components: ${m.components?.map(component => `${component.id}:${component.file}`).join(', ') || 'none'}`,
    `Quality: ${quality}`,
    `Session: ${m.sessionId}`,
    `Entry: ${record.entryPath}`,
    `Exports: ${exports}`,
    `Assets: ${assets}`,
  ].join('\n')
}

export async function executeStudioCommand(command: string, fns: StudioFns): Promise<ToolResult> {
  const trimmed = command.trim()
  const [rawVerb = '', ...rest] = trimmed.split(/\s+/)
  const verb = rawVerb.toLowerCase()
  try {
    if (!verb || verb === 'status') {
      const status = await fns.status()
      return success(`Studio: ${status.available ? 'available' : 'unavailable'}\nOutputs: ${status.outputs}${status.reason ? `\nReason: ${status.reason}` : ''}`)
    }
    if (verb === 'list') {
      const outputs = await fns.list()
      return success(outputs.length ? ['Studio outputs:', ...outputs.map(formatOutput)].join('\n') : 'Studio outputs: none')
    }
    if (verb === 'templates') {
      const templates = await fns.templates()
      return success(templates.length ? ['Studio templates:', ...templates.map(formatTemplate)].join('\n') : 'Studio templates: none')
    }
    if (verb === 'template') {
      const templateId = rest[0]
      if (!templateId) return failure('template requires a template id')
      const template = await fns.template(templateId)
      return success(template ? ['Studio template:', formatTemplate(template), `Description: ${template.description}`, `Recommended design system: ${template.recommendedDesignSystem ?? 'none'}`, `Components: ${template.componentPaths.length}`].join('\n') : `Studio template not found: ${templateId}`)
    }
    if (verb === 'scenarios') {
      const scenarios = listStudioScenarios()
      return success(scenarios.length ? ['Studio scenarios:', ...scenarios.map(formatScenario)].join('\n') : 'Studio scenarios: none')
    }
    if (verb === 'scenario') {
      const id = rest[0]
      if (!id) return failure('scenario requires a scenario id')
      const scenario = getStudioScenario(id)
      return success(scenario ? ['Studio scenario:', formatScenario(scenario), `Description: ${scenario.description}`, `Triggers: ${scenario.triggers.join(', ')}`, `Guidance: ${scenario.guidance}`].join('\n') : `Studio scenario not found: ${id}`)
    }
    if (verb === 'recommend') {
      const payload = trimmed.slice(rawVerb.length).trim()
      const input = parseJsonPayload<{ prompt: string; limit?: number }>(payload, 'recommend')
      if (!input.prompt?.trim()) return failure('recommend requires a prompt')
      const recommendations = recommendStudioScenarios(input.prompt, input.limit ?? 3)
      return success(recommendations.length ? ['Studio recommendations:', ...recommendations.map(formatRecommendation)].join('\n') : 'Studio recommendations: none')
    }
    if (verb === 'design-systems') {
      const systems = await fns.designSystems()
      return success(systems.length ? ['Studio design systems:', ...systems.map(formatDesignSystem)].join('\n') : 'Studio design systems: none')
    }
    if (verb === 'design-system') {
      const id = rest[0]
      if (!id) return failure('design-system requires a design system id')
      const system = await fns.designSystem(id)
      return success(system ? ['Studio design system:', formatDesignSystem(system), `Usage: ${system.usage.join(' ')}`].join('\n') : `Studio design system not found: ${id}`)
    }
    if (verb === 'show') {
      const outputId = rest[0]
      if (!outputId) return failure('show requires an output id')
      const output = await fns.show(outputId)
      return success(output ? formatDetail(output) : `Studio output not found: ${outputId}`)
    }
    if (verb === 'create' || verb === 'create-project') {
      const payload = trimmed.slice(rawVerb.length).trim()
      const input = parseJsonPayload<CreateStudioProjectInput>(payload, verb)
      const output = verb === 'create-project' ? await fns.createProject(input) : await fns.create(input)
      return success(`Created Studio output ${output.metadata.id}\n${formatDetail(output)}`)
    }
    if (verb === 'update') {
      const outputId = rest[0]
      if (!outputId) return failure('update requires an output id')
      const payload = trimmed.slice(rawVerb.length).trim().slice(outputId.length).trim()
      const output = await fns.update(outputId, parseJsonPayload<UpdateStudioOutputInput>(payload, 'update'))
      return success(`Updated Studio output ${output.metadata.id}\n${formatDetail(output)}`)
    }
    if (verb === 'add-page') {
      const outputId = rest[0]
      if (!outputId) return failure('add-page requires an output id')
      const payload = trimmed.slice(rawVerb.length).trim().slice(outputId.length).trim()
      const output = await fns.addPage(outputId, parseJsonPayload<AddStudioPageInput>(payload, 'add-page'))
      return success(`Added Studio page to ${output.metadata.id}\n${formatDetail(output)}`)
    }
    if (verb === 'add-component') {
      const outputId = rest[0]
      if (!outputId) return failure('add-component requires an output id')
      const payload = trimmed.slice(rawVerb.length).trim().slice(outputId.length).trim()
      const output = await fns.addComponent(outputId, parseJsonPayload<AddStudioComponentInput>(payload, 'add-component'))
      return success(`Added Studio component to ${output.metadata.id}\n${formatDetail(output)}`)
    }
    if (verb === 'quality') {
      const outputId = rest[0]
      if (!outputId) return failure('quality requires an output id')
      const output = await fns.quality(outputId)
      return success(`Studio quality ${output.metadata.id}\n${formatDetail(output)}`)
    }
    if (verb === 'assets') {
      const outputId = rest[0]
      if (!outputId) return failure('assets requires an output id')
      const output = await fns.show(outputId)
      if (!output) return success(`Studio output not found: ${outputId}`)
      const assets = output.metadata.assets ?? []
      return success(assets.length ? [`Studio assets ${outputId}:`, ...assets.map(formatAsset)].join('\n') : `Studio assets ${outputId}: none`)
    }
    if (verb === 'asset') {
      const [outputId, assetId] = rest
      if (!outputId || !assetId) return failure('asset requires output id and asset id')
      const output = await fns.show(outputId)
      if (!output) return success(`Studio output not found: ${outputId}`)
      const asset = output.metadata.assets?.find(item => item.id === assetId)
      return success(asset ? [`Studio asset ${outputId}/${assetId}:`, formatAsset(asset)].join('\n') : `Studio asset not found: ${assetId}`)
    }
    if (verb === 'generate-image') {
      if (!fns.generateImage) return failure('Studio image generation is not available in this backend')
      const outputId = rest[0]
      if (!outputId) return failure('generate-image requires an output id')
      const payload = trimmed.slice(rawVerb.length).trim().slice(outputId.length).trim()
      const output = await fns.generateImage(outputId, parseJsonPayload<Omit<AddStudioImageAssetInput, 'bytesBase64'> & { bytesBase64?: string }>(payload, 'generate-image'))
      const latest = output.metadata.assets?.at(-1)
      return success(`Generated Studio image ${output.metadata.id}${latest ? `\nasset=${latest.id}\npath=${latest.path}\nmodel=${latest.provider}/${latest.model}` : ''}\n${formatDetail(output)}`)
    }
    if (verb === 'export') {
      const [outputId, formatRaw] = rest
      if (!outputId) return failure('export requires an output id')
      const format = (formatRaw || 'html') as StudioExportFormat
      if (!['html', 'zip', 'pdf'].includes(format)) return failure('Export format must be html, zip, or pdf')
      const output = await fns.exportOutput(outputId, format)
      const latest = output.metadata.exports.at(-1)
      return success(`Exported Studio output ${output.metadata.id}${latest ? `\n${latest.format}: ${latest.path}` : ''}\n${formatDetail(output)}`)
    }
    if (verb === 'adopt') {
      const htmlPath = rest[0]
      if (!htmlPath) return failure('adopt requires an absolute HTML path')
      const payload = trimmed.slice(rawVerb.length).trim().slice(htmlPath.length).trim()
      const output = await fns.adopt(htmlPath, parseJsonPayload<AdoptStudioOutputInput>(payload, 'adopt'))
      return success(`Adopted Studio output ${output.metadata.id}\n${formatDetail(output)}`)
    }
    return failure(`Unknown studio command: ${verb}`)
  } catch (error) {
    return failure(error instanceof Error ? error.message : String(error))
  }
}

export function createStudioTool(options: { getStudioFns: () => StudioFns | undefined }) {
  return tool('studio', 'Manage Craft Studio projects and outputs: scenarios, recommendations, templates, design systems, create, list, inspect, update, add pages/components, quality, adopt, and export. Read studio-tools.md before use.', StudioSchema.shape, async (args) => {
    const fns = options.getStudioFns()
    if (!fns) return failure('Studio controls are not available. This tool requires the desktop app.')
    return executeStudioCommand(String(args.command ?? 'status'), fns)
  })
}
