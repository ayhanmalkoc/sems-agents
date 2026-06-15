import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import type { AutomationAction, AutomationEvent, AutomationMatcher } from '../automations/types.ts'

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

export interface AutomationToolItem extends AutomationMatcher {
  id: string
  event: AutomationEvent | string
  matcherIndex: number
  enabled: boolean
}

export interface AutomationsStatusSnapshot {
  available: boolean
  automations: AutomationToolItem[]
  reason?: string
}

export interface AutomationHistoryEntry {
  id: string
  ts: number
  ok: boolean
  event?: AutomationEvent
  triggerSummary?: string
  matcherSummary?: string
  conditionSummary?: string
  outcome?: 'action_completed' | 'action_failed'
  sessionId?: string
  prompt?: string
  error?: string
  webhook?: {
    method: string
    url: string
    statusCode: number
    durationMs: number
    attempts?: number
    error?: string
    responseBody?: string
  }
}

export interface AutomationTestResult {
  actions: Array<{
    type: 'prompt' | 'webhook'
    success: boolean
    sessionId?: string
    url?: string
    statusCode?: number
    stderr?: string
    error?: string
    duration?: number
  }>
}

export interface AutomationsFns {
  status: () => Promise<AutomationsStatusSnapshot>
  list: () => Promise<AutomationToolItem[]>
  show: (automationId: string) => Promise<AutomationToolItem | undefined>
  create: (input: AutomationMatcher & { event: AutomationEvent | string }) => Promise<AutomationToolItem>
  update: (automationId: string, updates: Partial<AutomationMatcher & { event: AutomationEvent | string }>) => Promise<AutomationToolItem>
  duplicate: (automationId: string, name: string) => Promise<AutomationToolItem>
  delete: (automationId: string) => Promise<void>
  setEnabled: (automationId: string, enabled: boolean) => Promise<AutomationToolItem>
  test: (automationId: string) => Promise<AutomationTestResult>
  history: (automationId: string) => Promise<AutomationHistoryEntry[]>
  replay: (automationId: string, runId?: string) => Promise<unknown>
}

const AutomationsSchema = z.object({
  command: z.string().describe('Automations command: status, list, show <automationId>, create <json>, update <automationId> <json>, duplicate <automationId> <name>, delete <automationId>, enable <automationId>, disable <automationId>, test <automationId>, history <automationId>, replay <automationId> <runId>.'),
})

function success(text: string): ToolResult {
  return { content: [{ type: 'text', text }] }
}

function failure(text: string): ToolResult {
  return { content: [{ type: 'text', text: `Error: ${text}` }], isError: true }
}

function actionSummary(actions: AutomationAction[] | undefined): string {
  if (!actions?.length) return 'actions=none'
  const parts = actions.map((action) => {
    if (action.type === 'prompt') return 'prompt'
    return `webhook:${action.method ?? 'POST'}`
  })
  return `actions=${parts.join(',')}`
}

function formatAutomation(item: AutomationToolItem): string {
  const name = item.name ? ` name=${JSON.stringify(item.name)}` : ''
  const matcher = item.matcher ? ` matcher=${JSON.stringify(item.matcher)}` : ''
  const cron = item.cron ? ` cron=${JSON.stringify(item.cron)}` : ''
  return `- ${item.id} event=${item.event} enabled=${item.enabled}${name}${matcher}${cron} ${actionSummary(item.actions)}`
}

function formatList(items: AutomationToolItem[]): string {
  if (items.length === 0) return 'Automations: none'
  return ['Automations:', ...items.map(formatAutomation)].join('\n')
}

function formatStatus(status: AutomationsStatusSnapshot): string {
  const lines = [
    `Automations: ${status.available ? 'available' : 'unavailable'}`,
    `Count: ${status.automations.length}`,
  ]
  if (status.reason) lines.push(`Reason: ${status.reason}`)
  lines.push(...formatList(status.automations).split('\n'))
  return lines.join('\n')
}

function parseJsonPayload<T>(value: string, label: string): T {
  if (!value.trim()) throw new Error(`${label} requires a JSON payload`)
  try {
    return JSON.parse(value) as T
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`Invalid JSON payload: ${message}`)
  }
}

function requireId(parts: string[], command: string): string {
  const id = parts[1]
  if (!id) throw new Error(`${command} requires an automation id`)
  return id
}

export async function executeAutomationsCommand(command: string, fns: AutomationsFns): Promise<ToolResult> {
  const trimmed = command.trim()
  const parts = trimmed.split(/\s+/).filter(Boolean)
  const rawVerb = parts[0] ?? 'status'
  const verb = rawVerb.toLowerCase()

  try {
    if (verb === 'status') return success(formatStatus(await fns.status()))
    if (verb === 'list') return success(formatList(await fns.list()))
    if (verb === 'show') {
      const automationId = requireId(parts, 'show')
      const item = await fns.show(automationId)
      if (!item) return failure(`Automation "${automationId}" not found`)
      return success(formatAutomation(item))
    }
    if (verb === 'create') {
      const payload = trimmed.slice(rawVerb.length).trim()
      const input = parseJsonPayload<AutomationMatcher & { event: AutomationEvent | string }>(payload, 'create')
      const item = await fns.create(input)
      return success(`Created automation ${item.id}\n${formatAutomation(item)}`)
    }
    if (verb === 'update') {
      const automationId = requireId(parts, 'update')
      const payload = trimmed.slice(rawVerb.length).trim().slice(automationId.length).trim()
      const updates = parseJsonPayload<Partial<AutomationMatcher & { event: AutomationEvent | string }>>(payload, 'update')
      const item = await fns.update(automationId, updates)
      return success(`Updated automation ${item.id}\n${formatAutomation(item)}`)
    }
    if (verb === 'duplicate') {
      const automationId = requireId(parts, 'duplicate')
      const name = trimmed.slice(rawVerb.length).trim().slice(automationId.length).trim()
      if (!name) return failure('duplicate requires a new name')
      const item = await fns.duplicate(automationId, name)
      return success(`Duplicated automation ${automationId} as ${item.id}\n${formatAutomation(item)}`)
    }
    if (verb === 'delete') {
      const automationId = requireId(parts, 'delete')
      await fns.delete(automationId)
      return success(`Deleted automation ${automationId}`)
    }
    if (verb === 'enable' || verb === 'disable') {
      const automationId = requireId(parts, verb)
      const item = await fns.setEnabled(automationId, verb === 'enable')
      return success(`${verb === 'enable' ? 'Enabled' : 'Disabled'} automation ${item.id}\n${formatAutomation(item)}`)
    }
    if (verb === 'test') {
      const automationId = requireId(parts, 'test')
      const result = await fns.test(automationId)
      const failed = result.actions.filter((action) => !action.success).length
      return success(`Tested automation ${automationId}: actions=${result.actions.length} failed=${failed}`)
    }
    if (verb === 'history') {
      const automationId = requireId(parts, 'history')
      const entries = await fns.history(automationId)
      if (entries.length === 0) return success(`History for ${automationId}: none`)
      return success([
        `History for ${automationId}:`,
        ...entries.map((entry) => `- ${entry.ts} ok=${entry.ok}${entry.sessionId ? ` sessionId=${entry.sessionId}` : ''}${entry.error ? ` error=${JSON.stringify(entry.error)}` : ''}`),
      ].join('\n'))
    }
    if (verb === 'replay') {
      const automationId = requireId(parts, 'replay')
      const runId = parts[2]
      await fns.replay(automationId, runId)
      return success(`Replayed automation ${automationId}${runId ? ` run=${runId}` : ''}`)
    }
    return failure(`Unknown automations command: ${verb}`)
  } catch (error) {
    return failure(error instanceof Error ? error.message : String(error))
  }
}

export function createAutomationsTool(options: { getAutomationsFns: () => AutomationsFns | undefined }) {
  return tool('automations', 'Manage workspace automations: list, inspect, create, update, duplicate, enable, test, history, and replay.', AutomationsSchema.shape, async (args) => {
    const fns = options.getAutomationsFns()
    if (!fns) return failure('Automation controls are not available. This tool requires the desktop app.')
    return executeAutomationsCommand(String(args.command ?? 'status'), fns)
  })
}
