import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import type { BuiltinHookDefinition, HookDecision, HookEventPayload, HookRunRecord, HookStatusSnapshot } from '../hooks/types.ts'

type ToolResult = { content: Array<{ type: 'text'; text: string }>; isError?: boolean }

export interface HooksFns {
  status: () => Promise<HookStatusSnapshot>
  list: () => Promise<Array<BuiltinHookDefinition & { enabled: boolean }>>
  show: (hookId: string) => Promise<(BuiltinHookDefinition & { enabled: boolean }) | undefined>
  enable: (hookId: string) => Promise<void>
  disable: (hookId: string) => Promise<void>
  runs: (hookId?: string) => Promise<HookRunRecord[]>
  explain: (runId: string) => Promise<HookRunRecord | undefined>
  test: (hookId: string, payload: HookEventPayload) => Promise<HookDecision>
}

const HooksSchema = z.object({ command: z.string().describe('Hooks command: status, list, show <hookId>, enable <hookId>, disable <hookId>, runs [hookId], explain <runId>, test <hookId> <json>.') })

function success(text: string): ToolResult { return { content: [{ type: 'text', text }] } }
function failure(text: string): ToolResult { return { content: [{ type: 'text', text: `Error: ${text}` }], isError: true } }
function parseJson<T>(value: string): T { try { return JSON.parse(value) as T } catch (error) { throw new Error(`Invalid JSON payload: ${error instanceof Error ? error.message : String(error)}`) } }

function formatStatus(status: HookStatusSnapshot): string {
  const lines = [`Hooks: ${status.available ? 'available' : 'unavailable'}`, `Built-ins: ${status.hooks}`, `Enabled: ${status.enabled}`, `Runs: ${status.runs}`]
  if (status.reason) lines.push(`Reason: ${status.reason}`)
  return lines.join('\n')
}
function formatHook(hook: BuiltinHookDefinition & { enabled: boolean }): string {
  return `- ${hook.id} enabled=${hook.enabled} event=${hook.event} mode=${hook.mode} scope=${hook.scope} source=${hook.source}\n  ${hook.description}`
}
function formatRun(run: HookRunRecord): string {
  return `- ${run.id} hook=${run.hookId} event=${run.event} decision=${run.decision} ok=${run.ok} durationMs=${run.durationMs}${run.toolName ? ` tool=${run.toolName}` : ''}${run.sessionId ? ` session=${run.sessionId}` : ''}\n  ${run.message ?? run.error ?? ''}`
}
function formatDecision(decision: HookDecision): string {
  return `Decision: ${decision.type}${decision.message ? `\nMessage: ${decision.message}` : ''}${decision.context ? `\nContext: ${decision.context}` : ''}`
}

export async function executeHooksCommand(command: string, fns: HooksFns): Promise<ToolResult> {
  const trimmed = command.trim()
  const [rawVerb = 'status', ...rest] = trimmed.split(/\s+/)
  const verb = rawVerb.toLowerCase()
  try {
    if (verb === 'status') return success(formatStatus(await fns.status()))
    if (verb === 'list') return success(['Hooks:', ...(await fns.list()).map(formatHook)].join('\n'))
    if (verb === 'show') {
      const hookId = rest[0]
      if (!hookId) return failure('show requires a hook id')
      const hook = await fns.show(hookId)
      if (!hook) return failure(`Hook not found: ${hookId}`)
      return success(formatHook(hook))
    }
    if (verb === 'enable' || verb === 'disable') {
      const hookId = rest[0]
      if (!hookId) return failure(`${verb} requires a hook id`)
      if (verb === 'enable') await fns.enable(hookId)
      else await fns.disable(hookId)
      return success(`${verb === 'enable' ? 'Enabled' : 'Disabled'} hook ${hookId}`)
    }
    if (verb === 'runs') {
      const runs = await fns.runs(rest[0])
      return success(runs.length ? ['Hook runs:', ...runs.map(formatRun)].join('\n') : 'Hook runs: none')
    }
    if (verb === 'explain') {
      const runId = rest[0]
      if (!runId) return failure('explain requires a run id')
      const run = await fns.explain(runId)
      if (!run) return failure(`Hook run not found: ${runId}`)
      return success(formatRun(run))
    }
    if (verb === 'test') {
      const hookId = rest[0]
      if (!hookId) return failure('test requires a hook id')
      const payload = parseJson<HookEventPayload>(trimmed.slice(rawVerb.length).trim().slice(hookId.length).trim() || '{}')
      return success(formatDecision(await fns.test(hookId, payload)))
    }
    return failure(`Unknown hooks command: ${verb}`)
  } catch (error) {
    return failure(error instanceof Error ? error.message : String(error))
  }
}

export function createHooksTool(options: { getHooksFns: () => HooksFns | undefined }) {
  return tool('hooks', 'Manage builtin workspace lifecycle hooks: list, inspect, enable, disable, view runs, explain decisions, and dry-run tests.', HooksSchema.shape, async (args) => {
    const fns = options.getHooksFns()
    if (!fns) return failure('Hooks controls are not available. This tool requires the desktop app.')
    return executeHooksCommand(String(args.command ?? 'status'), fns)
  })
}
