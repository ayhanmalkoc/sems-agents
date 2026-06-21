import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import type { CreateStudioOutputInput, StudioExportFormat, StudioOutputRecord, UpdateStudioOutputInput } from '../studio/types.ts'

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
}

const StudioSchema = z.object({
  command: z.string().describe('Studio command: status, list, show <outputId>, create <json>, update <outputId> <json>, export <outputId> <html|zip|pdf>.'),
})

function success(text: string): ToolResult { return { content: [{ type: 'text', text }] } }
function failure(text: string): ToolResult { return { content: [{ type: 'text', text: `Error: ${text}` }], isError: true } }

function parseJsonPayload<T>(value: string, label: string): T {
  if (!value.trim()) throw new Error(`${label} requires a JSON payload`)
  try { return JSON.parse(value) as T } catch (error) { throw new Error(`Invalid JSON payload: ${error instanceof Error ? error.message : String(error)}`) }
}

function formatOutput(record: StudioOutputRecord): string {
  const m = record.metadata
  return `- ${m.id} type=${m.type} status=${m.status} title=${JSON.stringify(m.title)} entry=${record.entryPath} session=${m.sessionId}`
}

function formatDetail(record: StudioOutputRecord): string {
  const m = record.metadata
  const exports = m.exports.length ? m.exports.map(item => `${item.format}:${item.path}`).join(', ') : 'none'
  return [
    `Studio output ${m.id}`,
    `Title: ${m.title}`,
    `Type: ${m.type}`,
    `Status: ${m.status}`,
    `Session: ${m.sessionId}`,
    `Entry: ${record.entryPath}`,
    `Exports: ${exports}`,
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
    if (verb === 'show') {
      const outputId = rest[0]
      if (!outputId) return failure('show requires an output id')
      const output = await fns.show(outputId)
      return success(output ? formatDetail(output) : `Studio output not found: ${outputId}`)
    }
    if (verb === 'create') {
      const output = await fns.create(parseJsonPayload<CreateStudioOutputInput>(trimmed.slice(rawVerb.length).trim(), 'create'))
      return success(`Created Studio output ${output.metadata.id}\n${formatDetail(output)}`)
    }
    if (verb === 'update') {
      const outputId = rest[0]
      if (!outputId) return failure('update requires an output id')
      const payload = trimmed.slice(rawVerb.length).trim().slice(outputId.length).trim()
      const output = await fns.update(outputId, parseJsonPayload<UpdateStudioOutputInput>(payload, 'update'))
      return success(`Updated Studio output ${output.metadata.id}\n${formatDetail(output)}`)
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
    return failure(`Unknown studio command: ${verb}`)
  } catch (error) {
    return failure(error instanceof Error ? error.message : String(error))
  }
}

export function createStudioTool(options: { getStudioFns: () => StudioFns | undefined }) {
  return tool('studio', 'Manage Craft Studio outputs: create, list, inspect, update, and export file-backed design outputs. Read studio-tools.md before use.', StudioSchema.shape, async (args) => {
    const fns = options.getStudioFns()
    if (!fns) return failure('Studio controls are not available. This tool requires the desktop app.')
    return executeStudioCommand(String(args.command ?? 'status'), fns)
  })
}
