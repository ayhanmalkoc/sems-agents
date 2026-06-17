import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import type { BuiltinHookDefinition, CustomHookDefinition, CustomHookTrustRecord, HookDecision, HookEventPayload, HookMatcher, HookRunRecord, HookStatusSnapshot, HooksPolicy } from '../hooks/types.ts'

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
  policy: () => Promise<HooksPolicy>
  setPolicy: (policy: Partial<HooksPolicy>) => Promise<HooksPolicy>
  simulateTool: (payload: HookEventPayload) => Promise<HookDecision>
  simulatePrompt: (payload: HookEventPayload) => Promise<HookDecision>
  afterToolUse?: (payload: HookEventPayload) => Promise<HookDecision>
  beforePromptSubmit?: (payload: HookEventPayload) => Promise<HookDecision>
  customList: () => Promise<CustomHookDefinition[]>
  customShow: (hookId: string) => Promise<CustomHookDefinition | undefined>
  customCreate: (hook: CustomHookDefinition) => Promise<CustomHookDefinition>
  customUpdate: (hookId: string, hook: Partial<CustomHookDefinition>) => Promise<CustomHookDefinition>
  customDelete: (hookId: string) => Promise<void>
  trustReview: (hookId: string) => Promise<CustomHookTrustRecord>
  trustApprove: (hookId: string) => Promise<CustomHookTrustRecord>
  trustRevoke: (hookId: string) => Promise<CustomHookTrustRecord>
  matcherSet: (hookId: string, matcher: HookMatcher) => Promise<CustomHookDefinition>
}

const HooksSchema = z.object({ command: z.string().describe('Hooks command: status, list, show <hookId>, enable <hookId>, disable <hookId>, runs [hookId], explain <runId>, run-detail <runId>, test <hookId> <json>, policy, set-policy <json>, simulate-tool <snake_case-json>, simulate-prompt <snake_case-json>, custom-list, custom-show <hookId>, custom-create <json>, custom-update <hookId> <json>, custom-delete <hookId>, trust-review <hookId>, trust-approve <hookId> --confirm, trust-revoke <hookId>, matcher-set <hookId> <json>.') })

function success(text: string): ToolResult { return { content: [{ type: 'text', text }] } }
function failure(text: string): ToolResult { return { content: [{ type: 'text', text: `Error: ${text}` }], isError: true } }
function parseJson<T>(value: string): T { try { return JSON.parse(value) as T } catch (error) { throw new Error(`Invalid JSON payload: ${error instanceof Error ? error.message : String(error)}`) } }
function commandPayload(command: string, verb: string, firstArg?: string): string { const rest = command.slice(verb.length).trim(); return firstArg ? rest.slice(firstArg.length).trim() : rest }

function formatStatus(status: HookStatusSnapshot): string {
  const lines = [`Hooks: ${status.available ? 'available' : 'unavailable'}`, `Built-ins: ${status.hooks}`, `Enabled: ${status.enabled}`, `Runs: ${status.runs}`]
  if (status.policy) lines.push('Policy:', `secretGuard=${status.policy.secretGuard}`, `workspaceBoundary=${status.policy.workspaceBoundary}`, `prerequisiteGuard=${status.policy.prerequisiteGuard}`, `toolAudit=${status.policy.toolAudit}`, `memoryLearn=${status.policy.memoryLearn}`, `customHooks=${status.policy.customHooks}`)
  if (status.reason) lines.push(`Reason: ${status.reason}`)
  return lines.join('\n')
}
function formatHook(hook: BuiltinHookDefinition & { enabled: boolean }): string { return `- ${hook.id} enabled=${hook.enabled} event=${hook.event} mode=${hook.mode} scope=${hook.scope} source=${hook.source}\n  ${hook.description}` }
function formatRun(run: HookRunRecord): string { return `- ${run.id} hook=${run.hookId} event=${run.event} decision=${run.decision} ok=${run.ok} durationMs=${run.durationMs}${run.toolName ? ` tool=${run.toolName}` : ''}${run.sessionId ? ` session=${run.sessionId}` : ''}\n  ${run.message ?? run.error ?? ''}${run.inputSummary ? `\n  input=${run.inputSummary}` : ''}${run.outputSummary ? `\n  output=${run.outputSummary}` : ''}` }
function formatDecision(decision: HookDecision & { decision?: string; reason?: string; updated_input?: unknown; additional_context?: string; redacted_response?: unknown }): string {
  if (decision.decision) return `decision=${decision.decision}${decision.reason ? `\nreason=${decision.reason}` : ''}${decision.updated_input !== undefined ? `\nupdated_input=${JSON.stringify(decision.updated_input)}` : ''}${decision.additional_context ? `\nadditional_context=${decision.additional_context}` : ''}${decision.redacted_response !== undefined ? `\nredacted_response=${JSON.stringify(decision.redacted_response)}` : ''}`
  return `Decision: ${decision.type}${decision.message ? `\nMessage: ${decision.message}` : ''}${decision.context ? `\nContext: ${decision.context}` : ''}`
}
function formatPolicy(policy: HooksPolicy): string { return ['Hooks policy:', `secretGuard=${policy.secretGuard}`, `workspaceBoundary=${policy.workspaceBoundary}`, `prerequisiteGuard=${policy.prerequisiteGuard}`, `toolAudit=${policy.toolAudit}`, `memoryLearn=${policy.memoryLearn}`, `customHooks=${policy.customHooks}`, `customDefaultPower=${policy.customDefaultPower}`, `customMaxDurationMs=${policy.customMaxDurationMs}`, `customMaxOutputBytes=${policy.customMaxOutputBytes}`].join('\n') }
function formatCustomHook(hook: CustomHookDefinition): string { return `- ${hook.id} enabled=${hook.enabled} source=${hook.source} event=${hook.matcher.event} handler=${hook.handler.type} powers=${hook.powers.join(',')}\n  ${hook.description ?? hook.name}` }
function formatTrust(record: CustomHookTrustRecord): string { return `hook=${record.hookId} trusted=${record.trusted} hash=${record.hash}${record.reason ? ` reason=${record.reason}` : ''}${record.approvedBy ? ` approvedBy=${record.approvedBy}` : ''}` }

export async function executeHooksCommand(command: string, fns: HooksFns): Promise<ToolResult> {
  const trimmed = command.trim()
  const [rawVerb = 'status', ...rest] = trimmed.split(/\s+/)
  const verb = rawVerb.toLowerCase()
  try {
    if (verb === 'status') return success(formatStatus(await fns.status()))
    if (verb === 'list') return success(['Hooks:', ...(await fns.list()).map(formatHook)].join('\n'))
    if (verb === 'show') { const hookId = rest[0]; if (!hookId) return failure('show requires a hook id'); const hook = await fns.show(hookId); return hook ? success(formatHook(hook)) : failure(`Hook not found: ${hookId}`) }
    if (verb === 'enable' || verb === 'disable') { const hookId = rest[0]; if (!hookId) return failure(`${verb} requires a hook id`); if (verb === 'enable') await fns.enable(hookId); else await fns.disable(hookId); return success(`${verb === 'enable' ? 'Enabled' : 'Disabled'} hook ${hookId}`) }
    if (verb === 'runs') { const runs = await fns.runs(rest[0]); return success(runs.length ? ['Hook runs:', ...runs.map(formatRun)].join('\n') : 'Hook runs: none') }
    if (verb === 'explain' || verb === 'run-detail') { const runId = rest[0]; if (!runId) return failure(`${verb} requires a run id`); const run = await fns.explain(runId); if (!run) return failure(`Hook run not found: ${runId}`); return success([formatRun(run), run.finalDecision ? `Final: ${formatDecision(run.finalDecision)}` : undefined, run.decisions?.length ? `Decisions: ${run.decisions.map(decision => decision.type).join(' -> ')}` : undefined, run.outputs?.length ? `Outputs: ${run.outputs.map(output => output.decision).join(' -> ')}` : undefined].filter(Boolean).join('\n')) }
    if (verb === 'policy') return success(formatPolicy(await fns.policy()))
    if (verb === 'set-policy') return success(`Updated hooks policy\n${formatPolicy(await fns.setPolicy(parseJson<Partial<HooksPolicy>>(commandPayload(trimmed, rawVerb) || '{}')))}`)
    if (verb === 'simulate-tool') return success(formatDecision(await fns.simulateTool(parseJson<HookEventPayload>(commandPayload(trimmed, rawVerb) || '{}'))))
    if (verb === 'simulate-prompt') return success(formatDecision(await fns.simulatePrompt(parseJson<HookEventPayload>(commandPayload(trimmed, rawVerb) || '{}'))))
    if (verb === 'test') { const hookId = rest[0]; if (!hookId) return failure('test requires a hook id'); return success(formatDecision(await fns.test(hookId, parseJson<HookEventPayload>(commandPayload(trimmed, rawVerb, hookId) || '{}')))) }
    if (verb === 'custom-list') { const hooks = await fns.customList(); return success(hooks.length ? ['Custom hooks:', ...hooks.map(formatCustomHook)].join('\n') : 'Custom hooks: none') }
    if (verb === 'custom-show') { const hookId = rest[0]; if (!hookId) return failure('custom-show requires a hook id'); const hook = await fns.customShow(hookId); return hook ? success(formatCustomHook(hook)) : failure(`Custom hook not found: ${hookId}`) }
    if (verb === 'custom-create') { const hook = await fns.customCreate(parseJson<CustomHookDefinition>(commandPayload(trimmed, rawVerb))); return success(`Created custom hook ${hook.id}`) }
    if (verb === 'custom-update') { const hookId = rest[0]; if (!hookId) return failure('custom-update requires a hook id'); const hook = await fns.customUpdate(hookId, parseJson<Partial<CustomHookDefinition>>(commandPayload(trimmed, rawVerb, hookId))); return success(`Updated custom hook ${hook.id}`) }
    if (verb === 'custom-delete') { const hookId = rest[0]; if (!hookId) return failure('custom-delete requires a hook id'); await fns.customDelete(hookId); return success(`Deleted custom hook ${hookId}`) }
    if (verb === 'trust-review') { const hookId = rest[0]; if (!hookId) return failure('trust-review requires a hook id'); return success(formatTrust(await fns.trustReview(hookId))) }
    if (verb === 'trust-approve') { const hookId = rest[0]; if (!hookId) return failure('trust-approve requires a hook id'); if (!rest.includes('--confirm')) return failure('trust-approve requires --confirm'); return success(formatTrust(await fns.trustApprove(hookId))) }
    if (verb === 'trust-revoke') { const hookId = rest[0]; if (!hookId) return failure('trust-revoke requires a hook id'); return success(formatTrust(await fns.trustRevoke(hookId))) }
    if (verb === 'matcher-set') { const hookId = rest[0]; if (!hookId) return failure('matcher-set requires a hook id'); const hook = await fns.matcherSet(hookId, parseJson<HookMatcher>(commandPayload(trimmed, rawVerb, hookId))); return success(`Updated matcher for ${hook.id}: ${JSON.stringify(hook.matcher)}`) }
    return failure(`Unknown hooks command: ${verb}`)
  } catch (error) { return failure(error instanceof Error ? error.message : String(error)) }
}

export function createHooksTool(options: { getHooksFns: () => HooksFns | undefined }) {
  return tool('hooks', 'Manage workspace lifecycle hooks: built-ins, trusted custom hooks, policy, runs, explainability, and dry-run simulations.', HooksSchema.shape, async (args) => {
    const fns = options.getHooksFns()
    if (!fns) return failure('Hooks controls are not available. This tool requires the desktop app.')
    return executeHooksCommand(String(args.command ?? 'status'), fns)
  })
}
