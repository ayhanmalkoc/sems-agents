import { execFile } from 'child_process'
import { BUILTIN_HOOKS, getBuiltinHook } from './builtins.ts'
import { appendHookRun, getHookConfigEntries, hashCustomHook, loadCustomHookTrust, loadCustomHooks, loadHookRuns, loadHooksPolicy } from './storage.ts'
import type { BuiltinHookDefinition, CustomHookDefinition, CustomHookPower, HookDecision, HookDecisionType, HookEventPayload, HookInput, HookMatcher, HookOutput, HookOutputDecision, HookRunRecord, HookStatusSnapshot, HooksPolicy } from './types.ts'

const SECRET_PATTERNS = [/sk[-_][A-Za-z0-9_\-./+=]{8,}/i, /[\"']?\b(api[_-]?key|token|password|passwd|secret|bearer)\b[\"']?\s*(?:[:=]|is|=)?\s*[\"']?[A-Za-z0-9_\-./+=]{10,}/i, /-----BEGIN (RSA |OPENSSH |EC |)PRIVATE KEY-----/i, /\bBearer\s+[A-Za-z0-9_\-./+=]{12,}/i]
function containsSecret(value: unknown): boolean { return SECRET_PATTERNS.some(pattern => pattern.test(typeof value === 'string' ? value : JSON.stringify(value ?? ''))) }
function redactSecrets(text: string): string { return SECRET_PATTERNS.reduce((current, pattern) => current.replace(pattern, '[REDACTED]'), text) }
function summarize(value: unknown, max = 420): string | undefined { if (value === undefined) return undefined; const text = typeof value === 'string' ? value : JSON.stringify(value); return text ? redactSecrets(text).slice(0, max) : undefined }

const OUTPUT_PRECEDENCE: HookOutputDecision[] = ['block', 'ask', 'modify', 'add_context', 'redact', 'observe', 'allow']
const LEGACY_PRECEDENCE: HookDecisionType[] = ['block', 'ask', 'mutate', 'addContext', 'redact', 'observe', 'allow']
const legacyToPublic: Record<HookDecisionType, HookOutputDecision> = { allow: 'allow', block: 'block', ask: 'ask', mutate: 'modify', addContext: 'add_context', redact: 'redact', observe: 'observe' }
const publicToLegacy: Record<HookOutputDecision, HookDecisionType> = { allow: 'allow', block: 'block', ask: 'ask', modify: 'mutate', add_context: 'addContext', redact: 'redact', observe: 'observe' }
const powerAliases: Record<HookOutputDecision, CustomHookPower[]> = { allow: ['observe'], observe: ['observe'], block: ['block'], ask: ['ask'], modify: ['modify', 'mutate'], add_context: ['add_context', 'addContext'], redact: ['redact'] }

export function normalizeHookInput(payload: HookEventPayload): HookInput {
  return {
    hook_event_name: (payload.hook_event_name ?? payload.event ?? 'PreToolUse') as HookInput['hook_event_name'],
    workspace_id: payload.workspace_id ?? payload.workspaceId,
    session_id: payload.session_id ?? payload.sessionId,
    agent_id: payload.agent_id ?? payload.agentId,
    tool_name: payload.tool_name ?? payload.toolName,
    tool_input: payload.tool_input ?? payload.toolInput ?? payload.input,
    tool_response: payload.tool_response ?? payload.toolResult ?? payload.result,
    prompt: payload.prompt ?? payload.message,
    timestamp: payload.timestamp ?? new Date().toISOString(),
    metadata: payload.metadata,
  }
}

export function toHookOutput(decision: HookDecision): HookOutput { return { decision: legacyToPublic[decision.type], reason: decision.message, updated_input: decision.mutation, additional_context: decision.context, redacted_response: decision.redactedResult } }
export function fromHookOutput(output: HookOutput): HookDecision { return { type: publicToLegacy[output.decision], message: output.reason, mutation: output.updated_input, context: output.additional_context, redactedResult: output.redacted_response } }
export function mergeHookOutputs(outputs: HookOutput[]): HookOutput { return outputs.length ? [...outputs].sort((a, b) => OUTPUT_PRECEDENCE.indexOf(a.decision) - OUTPUT_PRECEDENCE.indexOf(b.decision))[0]! : { decision: 'allow', reason: 'No hooks matched.' } }
export function mergeHookDecisions(decisions: HookDecision[]): HookDecision { return decisions.length ? [...decisions].sort((a, b) => LEGACY_PRECEDENCE.indexOf(a.type) - LEGACY_PRECEDENCE.indexOf(b.type))[0]! : { type: 'allow', message: 'No hooks matched.' } }

function looksWorkspaceRisky(input: HookInput): boolean { return /(\.\.\|\.\.\/|Remove-Item|rm\s+-rf|del\s+\/|rmdir|C:\\Windows|\/etc\/|~\/\.ssh)/i.test(JSON.stringify(input.tool_input ?? '')) }
function matcherMatches(matcher: HookMatcher, input: HookInput): boolean {
  if (matcher.event && matcher.event !== input.hook_event_name) return false
  if (matcher.toolName && matcher.toolName !== input.tool_name) return false
  if (matcher.agentProfileId && matcher.agentProfileId !== input.agent_id) return false
  if (matcher.commandIncludes && !JSON.stringify(input.tool_input ?? '').includes(matcher.commandIncludes)) return false
  if (matcher.pathGlob && !JSON.stringify(input.tool_input ?? '').includes(matcher.pathGlob.replace(/\*/g, ''))) return false
  if (matcher.automationEvent && matcher.automationEvent !== String(input.metadata?.automationEvent ?? '')) return false
  return true
}
function decisionAllowed(output: HookOutput, powers: CustomHookPower[]): HookOutput { return output.decision === 'allow' || powerAliases[output.decision].some(power => powers.includes(power)) ? output : { decision: 'observe', reason: `Custom hook decision ${output.decision} ignored; power not approved.` } }
function makeRun(hook: { id: string; source?: string }, input: HookInput, output: HookOutput, started: number, ok = true, error?: string): HookRunRecord {
  const legacy = fromHookOutput(output)
  return { id: `hook-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, hookId: hook.id, event: input.hook_event_name, decision: legacy.type, message: output.reason, inputSummary: summarize(input), outputSummary: summarize({ hook_output: output, tool_response: input.tool_response }), decisions: [legacy], outputs: [output], finalDecision: legacy, finalOutput: output, sessionId: input.session_id, toolName: input.tool_name, durationMs: Date.now() - started, ok, error, trustSource: hook.source as never, createdAt: new Date().toISOString() }
}
function parseHookOutput(value: string): HookOutput { try { const parsed = JSON.parse(value.trim() || '{}') as Partial<HookOutput>; if (!parsed.decision) return { decision: 'observe', reason: value.slice(0, 4096) }; return parsed as HookOutput } catch { return { decision: 'observe', reason: 'Custom hook returned invalid JSON.' } } }

export class HookEngine {
  constructor(private readonly workspaceRootPath: string) {}
  status(): HookStatusSnapshot { const config = getHookConfigEntries(this.workspaceRootPath); return { available: true, hooks: BUILTIN_HOOKS.length + loadCustomHooks(this.workspaceRootPath).length, enabled: config.filter(entry => entry.enabled).length + loadCustomHooks(this.workspaceRootPath).filter(hook => hook.enabled).length, runs: loadHookRuns(this.workspaceRootPath, undefined, 1000).length, policy: this.policy() } }
  list(): Array<BuiltinHookDefinition & { enabled: boolean }> { const enabled = new Map(getHookConfigEntries(this.workspaceRootPath).map(entry => [entry.id, entry.enabled])); return BUILTIN_HOOKS.map(hook => ({ ...hook, enabled: enabled.get(hook.id) ?? true })).sort((a, b) => a.order - b.order) }
  show(hookId: string): (BuiltinHookDefinition & { enabled: boolean }) | undefined { return this.list().find(hook => hook.id === hookId) }
  policy(): HooksPolicy { return loadHooksPolicy(this.workspaceRootPath) }
  async beforeToolUse(payload: HookEventPayload): Promise<HookDecision> { return fromHookOutput(await this.beforeToolUseOutput(payload)) }
  async afterToolUse(payload: HookEventPayload): Promise<HookDecision> { return fromHookOutput(await this.afterToolUseOutput(payload)) }
  async beforePromptSubmit(payload: HookEventPayload): Promise<HookDecision> { return fromHookOutput(await this.beforePromptSubmitOutput(payload)) }
  async beforeToolUseOutput(payload: HookEventPayload): Promise<HookOutput> { return mergeHookOutputs(await this.runEvent({ ...payload, hook_event_name: 'PreToolUse' })) }
  async afterToolUseOutput(payload: HookEventPayload): Promise<HookOutput> { return mergeHookOutputs(await this.runEvent({ ...payload, hook_event_name: 'PostToolUse' })) }
  async beforePromptSubmitOutput(payload: HookEventPayload): Promise<HookOutput> { return mergeHookOutputs(await this.runEvent({ ...payload, hook_event_name: 'UserPromptSubmit' })) }
  async simulateTool(payload: HookEventPayload): Promise<HookOutput & HookDecision> { const output = await this.beforeToolUseOutput(payload); return Object.assign(fromHookOutput(output), output) }
  async simulatePrompt(payload: HookEventPayload): Promise<HookOutput & HookDecision> { const output = await this.beforePromptSubmitOutput(payload); return Object.assign(fromHookOutput(output), output) }
  async emit(payload: HookEventPayload): Promise<HookDecision[]> { return (await this.runEvent(payload)).map(fromHookOutput) }
  async test(hookId: string, payload: HookEventPayload): Promise<HookOutput & HookDecision> {
    const input = normalizeHookInput(payload)
    const builtin = getBuiltinHook(hookId)
    const output = builtin ? await this.runBuiltinHook(builtin, { ...input, hook_event_name: input.hook_event_name || builtin.event }, true) : await this.runCustomHookOrThrow(hookId, input, true)
    return Object.assign(fromHookOutput(output), output)
  }
  private async runCustomHookOrThrow(hookId: string, input: HookInput, dryRun: boolean): Promise<HookOutput> { const custom = loadCustomHooks(this.workspaceRootPath).find(hook => hook.id === hookId); if (!custom) throw new Error(`Unknown hook: ${hookId}`); return this.runCustomHook(custom, { ...input, hook_event_name: input.hook_event_name ?? custom.matcher.event ?? 'PreToolUse' }, dryRun) }
  private async runEvent(payload: HookEventPayload, dryRun = false): Promise<HookOutput[]> {
    const input = normalizeHookInput(payload)
    const builtin = this.list().filter(hook => hook.enabled && hook.event === input.hook_event_name).map(hook => this.runBuiltinHook(hook, input, dryRun))
    const custom = loadCustomHooks(this.workspaceRootPath).filter(hook => hook.enabled && matcherMatches(hook.matcher, input)).map(hook => this.runCustomHook(hook, input, dryRun))
    return Promise.all([...builtin, ...custom])
  }
  private async runBuiltinHook(hook: BuiltinHookDefinition, input: HookInput, dryRun: boolean): Promise<HookOutput> { const started = Date.now(); try { const output = this.decideBuiltin(hook, input); if (!dryRun) appendHookRun(this.workspaceRootPath, makeRun(hook, input, output, started)); return output } catch (error) { const output: HookOutput = { decision: 'block', reason: error instanceof Error ? error.message : String(error) }; if (!dryRun) appendHookRun(this.workspaceRootPath, makeRun(hook, input, output, started, false, output.reason)); return output } }
  private async runCustomHook(hook: CustomHookDefinition, input: HookInput, dryRun: boolean): Promise<HookOutput> { const started = Date.now(); try { if (this.policy().customHooks === 'off') return { decision: 'allow', reason: 'Custom hooks are off.' }; const trust = loadCustomHookTrust(this.workspaceRootPath).find(record => record.hookId === hook.id); if (!trust?.trusted || trust.hash !== hashCustomHook(hook)) return { decision: 'allow', reason: 'Custom hook is untrusted; skipped.' }; const output = decisionAllowed(await this.executeCustomHook(hook, input), hook.powers); if (!dryRun) appendHookRun(this.workspaceRootPath, makeRun(hook, input, output, started)); return output } catch (error) { const output: HookOutput = { decision: 'observe', reason: error instanceof Error ? error.message : String(error) }; if (!dryRun) appendHookRun(this.workspaceRootPath, makeRun(hook, input, output, started, false, output.reason)); return output } }
  private async executeCustomHook(hook: CustomHookDefinition, input: HookInput): Promise<HookOutput> { const handler = hook.handler; if (handler.type === 'prompt') return handler.output ?? toHookOutput(handler.decision ?? { type: 'observe', message: 'Prompt hook observed.' }); if (handler.type === 'command') return new Promise(resolve => { const timeout = Math.min(hook.timeoutMs ?? this.policy().customMaxDurationMs, this.policy().customMaxDurationMs); const child = execFile(handler.executable, handler.args ?? [], { timeout, cwd: handler.cwd }, (error, stdout) => resolve(error ? { decision: 'observe', reason: error.message } : parseHookOutput(String(stdout).slice(0, hook.maxOutputBytes ?? this.policy().customMaxOutputBytes)))); child.stdin?.end(`${JSON.stringify(input)}\n`) }); if (handler.type === 'http') return { decision: 'observe', reason: `HTTP custom hook configured for ${handler.url}.` }; if (handler.type === 'mcp') return { decision: 'observe', reason: `MCP custom hook configured for ${handler.target}/${handler.tool}.` }; return { decision: 'observe', reason: 'Custom hook observed.' } }
  private decideBuiltin(hook: BuiltinHookDefinition, input: HookInput): HookOutput { const policy = this.policy(); if (hook.id === 'secret_scan_prompt') return policy.secretGuard === 'off' ? { decision: 'allow', reason: 'Secret guard is off.' } : containsSecret(input.prompt ?? input.tool_input) ? { decision: 'block', reason: 'Hook blocked prompt: sensitive credentials or secrets detected.' } : { decision: 'allow', reason: 'No prompt secrets detected.' }; if (hook.id === 'secret_scan_tool_input') return policy.secretGuard === 'off' ? { decision: 'allow', reason: 'Secret guard is off.' } : containsSecret(input.tool_input) ? { decision: 'block', reason: 'Hook blocked tool input: sensitive credentials or secrets detected.' } : { decision: 'allow', reason: 'No tool input secrets detected.' }; if (hook.id === 'tool_prerequisite_guard') return { decision: 'observe', reason: policy.prerequisiteGuard === 'enforce' ? 'Prerequisite guard is enforced by the existing prerequisite manager.' : 'Prerequisite guard observe-only.' }; if (hook.id === 'workspace_boundary_guard') { if (!looksWorkspaceRisky(input)) return { decision: 'allow', reason: 'No workspace boundary risk detected.' }; if (policy.workspaceBoundary === 'block') return { decision: 'block', reason: 'Hook blocked risky workspace boundary operation.' }; if (policy.workspaceBoundary === 'ask') return { decision: 'ask', reason: 'Hook requires approval for risky workspace boundary operation.' }; return { decision: 'observe', reason: 'Observed risky workspace boundary operation.' } } if (hook.id === 'memory_learn_on_session_complete') return policy.memoryLearn === 'off' ? { decision: 'observe', reason: 'Memory learn hook is off.' } : { decision: 'modify', reason: 'Memory auto-learn is delegated to the existing session completion memory engine.' }; if (hook.id === 'tool_audit_log') { if (policy.toolAudit === 'off') return { decision: 'allow', reason: 'Tool audit is off.' }; if (containsSecret(input.tool_response)) return { decision: 'redact', reason: `Audited and redacted tool ${input.tool_name ?? 'unknown'}.`, redacted_response: typeof input.tool_response === 'string' ? redactSecrets(input.tool_response) : JSON.parse(redactSecrets(JSON.stringify(input.tool_response))) }; return { decision: 'observe', reason: `Audited tool ${input.tool_name ?? 'unknown'}.` } } if (hook.id === 'automation_run_audit') return { decision: 'observe', reason: 'Audited automation run.' }; if (hook.id === 'validation_summary_on_stop') return { decision: 'observe', reason: 'Captured stop validation summary context.' }; return { decision: 'observe', reason: 'Hook observed event.' } }
}

export class HookToolGateway { constructor(private readonly engine: HookEngine, private readonly askApproval?: (message: string) => Promise<'allow' | 'deny'>) {} async run<T>(payload: HookEventPayload, callback: (input: unknown) => Promise<T> | T): Promise<T> { const before = await this.engine.beforeToolUseOutput(payload); if (before.decision === 'block') throw new Error(`Hook blocked tool use: ${before.reason ?? 'blocked'}`); if (before.decision === 'ask') { const answer = await this.askApproval?.(before.reason ?? 'Approval required.'); if (answer !== 'allow') throw new Error(`Hook approval denied: ${before.reason ?? 'approval required'}`) } const normalized = normalizeHookInput(payload); const input = before.decision === 'modify' && before.updated_input !== undefined ? before.updated_input : normalized.tool_input; try { const result = await callback(input); const after = await this.engine.afterToolUseOutput({ ...payload, hook_event_name: 'PostToolUse', tool_response: result }); return after.decision === 'redact' && after.redacted_response !== undefined ? after.redacted_response as T : result } catch (error) { await this.engine.emit({ ...payload, hook_event_name: 'PostToolUse', error: error instanceof Error ? error.message : String(error) }); throw error } } }

export * from './builtins.ts'
export * from './storage.ts'
export * from './types.ts'
