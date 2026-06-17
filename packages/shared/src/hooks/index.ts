import { execFile } from 'child_process'
import { BUILTIN_HOOKS, getBuiltinHook } from './builtins.ts'
import { appendHookRun, getHookConfigEntries, hashCustomHook, loadCustomHookTrust, loadCustomHooks, loadHookRuns, loadHooksPolicy } from './storage.ts'
import type { BuiltinHookDefinition, CustomHookDefinition, CustomHookPower, HookDecision, HookDecisionType, HookEventPayload, HookMatcher, HookRunRecord, HookStatusSnapshot, HooksPolicy } from './types.ts'

const SECRET_PATTERNS = [
  /["']?\b(api[_-]?key|token|password|passwd|secret|bearer)\b["']?\s*[:=]\s*["']?[A-Za-z0-9_\-./+=]{12,}/i,
  /-----BEGIN (RSA |OPENSSH |EC |)PRIVATE KEY-----/i,
  /\bBearer\s+[A-Za-z0-9_\-./+=]{12,}/i,
]

function containsSecret(value: unknown): boolean { return SECRET_PATTERNS.some(pattern => pattern.test(typeof value === 'string' ? value : JSON.stringify(value ?? ''))) }
function redactSecrets(text: string): string { return SECRET_PATTERNS.reduce((current, pattern) => current.replace(pattern, '[REDACTED]'), text) }
function summarize(value: unknown, max = 360): string | undefined { if (value === undefined) return undefined; const text = typeof value === 'string' ? value : JSON.stringify(value); return text ? redactSecrets(text).slice(0, max) : undefined }

const PRECEDENCE: HookDecisionType[] = ['block', 'ask', 'mutate', 'addContext', 'redact', 'observe', 'allow']
export function mergeHookDecisions(decisions: HookDecision[]): HookDecision { return decisions.length ? [...decisions].sort((a, b) => PRECEDENCE.indexOf(a.type) - PRECEDENCE.indexOf(b.type))[0]! : { type: 'allow', message: 'No hooks matched.' } }
function looksWorkspaceRisky(payload: HookEventPayload): boolean { return /(\.\.\|\.\.\/|Remove-Item|rm\s+-rf|del\s+\/|rmdir|C:\\Windows|\/etc\/|~\/\.ssh)/i.test(JSON.stringify(payload.toolInput ?? payload.input ?? '')) }
function matcherMatches(matcher: HookMatcher, payload: HookEventPayload): boolean {
  if (matcher.event && matcher.event !== payload.event) return false
  if (matcher.toolName && matcher.toolName !== payload.toolName) return false
  if (matcher.agentProfileId && matcher.agentProfileId !== payload.agentId) return false
  if (matcher.commandIncludes && !JSON.stringify(payload.toolInput ?? payload.input ?? '').includes(matcher.commandIncludes)) return false
  if (matcher.pathGlob && !JSON.stringify(payload.toolInput ?? payload.input ?? '').includes(matcher.pathGlob.replace(/\*/g, ''))) return false
  if (matcher.automationEvent && matcher.automationEvent !== String(payload.metadata?.automationEvent ?? '')) return false
  return true
}
function decisionAllowed(decision: HookDecision, powers: CustomHookPower[]): HookDecision { return decision.type === 'allow' || powers.includes(decision.type as CustomHookPower) || (decision.type === 'observe' && powers.includes('observe')) ? decision : { type: 'observe', message: `Custom hook decision ${decision.type} ignored; power not approved.` } }
function makeRun(hook: { id: string; source?: string }, payload: HookEventPayload, decision: HookDecision, started: number, ok = true, error?: string): HookRunRecord {
  return { id: `hook-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`, hookId: hook.id, event: payload.event, decision: decision.type, message: decision.message, inputSummary: summarize(payload.toolInput ?? payload.input ?? payload.message), outputSummary: summarize(payload.toolResult ?? payload.result ?? decision.redactedResult), decisions: [decision], finalDecision: decision, sessionId: payload.sessionId, toolName: payload.toolName, durationMs: Date.now() - started, ok, error, trustSource: hook.source as never, createdAt: new Date().toISOString() }
}

export class HookEngine {
  constructor(private readonly workspaceRootPath: string) {}
  status(): HookStatusSnapshot { const config = getHookConfigEntries(this.workspaceRootPath); return { available: true, hooks: BUILTIN_HOOKS.length + loadCustomHooks(this.workspaceRootPath).length, enabled: config.filter(entry => entry.enabled).length + loadCustomHooks(this.workspaceRootPath).filter(hook => hook.enabled).length, runs: loadHookRuns(this.workspaceRootPath, undefined, 1000).length } }
  list(): Array<BuiltinHookDefinition & { enabled: boolean }> { const enabled = new Map(getHookConfigEntries(this.workspaceRootPath).map(entry => [entry.id, entry.enabled])); return BUILTIN_HOOKS.map(hook => ({ ...hook, enabled: enabled.get(hook.id) ?? true })).sort((a, b) => a.order - b.order) }
  show(hookId: string): (BuiltinHookDefinition & { enabled: boolean }) | undefined { return this.list().find(hook => hook.id === hookId) }
  policy(): HooksPolicy { return loadHooksPolicy(this.workspaceRootPath) }
  async beforeToolUse(payload: HookEventPayload): Promise<HookDecision> { return mergeHookDecisions(await this.runEvent({ ...payload, event: 'PreToolUse' })) }
  async afterToolUse(payload: HookEventPayload): Promise<HookDecision> { return mergeHookDecisions(await this.runEvent({ ...payload, event: 'PostToolUse' })) }
  async beforePromptSubmit(payload: HookEventPayload): Promise<HookDecision> { return mergeHookDecisions(await this.runEvent({ ...payload, event: 'UserPromptSubmit' })) }
  async simulateTool(payload: HookEventPayload): Promise<HookDecision> { return mergeHookDecisions(await this.runEvent({ ...payload, event: 'PreToolUse' }, true)) }
  async simulatePrompt(payload: HookEventPayload): Promise<HookDecision> { return mergeHookDecisions(await this.runEvent({ ...payload, event: 'UserPromptSubmit' }, true)) }
  async emit(payload: HookEventPayload): Promise<HookDecision[]> { return this.runEvent(payload) }
  async test(hookId: string, payload: HookEventPayload): Promise<HookDecision> { const builtin = getBuiltinHook(hookId); if (builtin) return this.runBuiltinHook(builtin, { ...payload, event: payload.event ?? builtin.event }, true); const custom = loadCustomHooks(this.workspaceRootPath).find(hook => hook.id === hookId); if (custom) return this.runCustomHook(custom, { ...payload, event: payload.event ?? custom.matcher.event ?? 'PreToolUse' }, true); throw new Error(`Unknown hook: ${hookId}`) }
  private async runEvent(payload: HookEventPayload, dryRun = false): Promise<HookDecision[]> {
    const builtin = this.list().filter(hook => hook.enabled && hook.event === payload.event).map(hook => this.runBuiltinHook(hook, payload, dryRun))
    const custom = loadCustomHooks(this.workspaceRootPath).filter(hook => hook.enabled && matcherMatches(hook.matcher, payload)).map(hook => this.runCustomHook(hook, payload, dryRun))
    return Promise.all([...builtin, ...custom])
  }
  private async runBuiltinHook(hook: BuiltinHookDefinition, payload: HookEventPayload, dryRun: boolean): Promise<HookDecision> {
    const started = Date.now()
    try { const decision = this.decideBuiltin(hook, payload); if (!dryRun) appendHookRun(this.workspaceRootPath, makeRun(hook, payload, decision, started)); return decision }
    catch (error) { const decision: HookDecision = { type: 'block', message: error instanceof Error ? error.message : String(error) }; if (!dryRun) appendHookRun(this.workspaceRootPath, makeRun(hook, payload, decision, started, false, decision.message)); return decision }
  }
  private async runCustomHook(hook: CustomHookDefinition, payload: HookEventPayload, dryRun: boolean): Promise<HookDecision> {
    const started = Date.now(); const policy = this.policy()
    try {
      if (policy.customHooks === 'off') return { type: 'allow', message: 'Custom hooks are off.' }
      const trust = loadCustomHookTrust(this.workspaceRootPath).find(record => record.hookId === hook.id)
      if (!trust?.trusted || trust.hash !== hashCustomHook(hook)) return { type: 'allow', message: 'Custom hook is untrusted; skipped.' }
      const decision = decisionAllowed(await this.executeCustomHook(hook, payload), hook.powers)
      if (!dryRun) appendHookRun(this.workspaceRootPath, makeRun(hook, payload, decision, started))
      return decision
    } catch (error) { const decision: HookDecision = { type: 'observe', message: error instanceof Error ? error.message : String(error) }; if (!dryRun) appendHookRun(this.workspaceRootPath, makeRun(hook, payload, decision, started, false, decision.message)); return decision }
  }
  private async executeCustomHook(hook: CustomHookDefinition, payload: HookEventPayload): Promise<HookDecision> {
    void payload
    const handler = hook.handler
    if (handler.type === 'prompt') return handler.decision
    if (handler.type === 'command') return new Promise(resolve => {
      const timeout = Math.min(hook.timeoutMs ?? this.policy().customMaxDurationMs, this.policy().customMaxDurationMs)
      execFile(handler.executable, handler.args ?? [], { timeout, cwd: handler.cwd }, (error, stdout) => resolve(error ? { type: 'observe', message: error.message } : { type: 'observe', message: String(stdout).slice(0, hook.maxOutputBytes ?? this.policy().customMaxOutputBytes) }))
    })
    if (handler.type === 'http') return { type: 'observe', message: `HTTP custom hook configured for ${handler.url}.` }
    if (handler.type === 'mcp') return { type: 'observe', message: `MCP custom hook configured for ${handler.target}/${handler.tool}.` }
    return { type: 'observe', message: 'Custom hook observed.' }
  }
  private decideBuiltin(hook: BuiltinHookDefinition, payload: HookEventPayload): HookDecision {
    const policy = this.policy(); const input = payload.toolInput ?? payload.input; const output = payload.toolResult ?? payload.result
    if (hook.id === 'secret_scan_prompt') return policy.secretGuard === 'off' ? { type: 'allow', message: 'Secret guard is off.' } : containsSecret(payload.message ?? input) ? { type: 'block', message: 'Hook blocked prompt: sensitive credentials or secrets detected.' } : { type: 'allow', message: 'No prompt secrets detected.' }
    if (hook.id === 'secret_scan_tool_input') return policy.secretGuard === 'off' ? { type: 'allow', message: 'Secret guard is off.' } : containsSecret(input) ? { type: 'block', message: 'Hook blocked tool input: sensitive credentials or secrets detected.' } : { type: 'allow', message: 'No tool input secrets detected.' }
    if (hook.id === 'tool_prerequisite_guard') return { type: 'observe', message: policy.prerequisiteGuard === 'enforce' ? 'Prerequisite guard is enforced by the existing prerequisite manager.' : 'Prerequisite guard observe-only.' }
    if (hook.id === 'workspace_boundary_guard') { if (!looksWorkspaceRisky(payload)) return { type: 'allow', message: 'No workspace boundary risk detected.' }; if (policy.workspaceBoundary === 'block') return { type: 'block', message: 'Hook blocked risky workspace boundary operation.' }; if (policy.workspaceBoundary === 'ask') return { type: 'ask', message: 'Hook requires approval for risky workspace boundary operation.' }; return { type: 'observe', message: 'Observed risky workspace boundary operation.' } }
    if (hook.id === 'memory_learn_on_session_complete') return policy.memoryLearn === 'off' ? { type: 'observe', message: 'Memory learn hook is off.' } : { type: 'mutate', message: 'Memory auto-learn is delegated to the existing session completion memory engine.' }
    if (hook.id === 'tool_audit_log') { if (policy.toolAudit === 'off') return { type: 'allow', message: 'Tool audit is off.' }; if (containsSecret(output)) return { type: 'redact', message: `Audited and redacted tool ${payload.toolName ?? 'unknown'}.`, redactedResult: typeof output === 'string' ? redactSecrets(output) : JSON.parse(redactSecrets(JSON.stringify(output))) }; return { type: 'observe', message: `Audited tool ${payload.toolName ?? 'unknown'}.` } }
    if (hook.id === 'automation_run_audit') return { type: 'observe', message: 'Audited automation run.' }
    if (hook.id === 'validation_summary_on_turn_stop') return { type: 'observe', message: 'Captured turn-stop validation summary context.' }
    return { type: 'observe', message: 'Hook observed event.' }
  }
}

export class HookToolGateway {
  constructor(private readonly engine: HookEngine, private readonly askApproval?: (message: string) => Promise<'allow' | 'deny'>) {}
  async run<T>(payload: HookEventPayload, callback: (input: unknown) => Promise<T> | T): Promise<T> {
    const before = await this.engine.beforeToolUse(payload)
    if (before.type === 'block') throw new Error(`Hook blocked tool use: ${before.message ?? 'blocked'}`)
    if (before.type === 'ask') { const answer = await this.askApproval?.(before.message ?? 'Approval required.'); if (answer !== 'allow') throw new Error(`Hook approval denied: ${before.message ?? 'approval required'}`) }
    const input = before.type === 'mutate' && before.mutation !== undefined ? before.mutation : (payload.toolInput ?? payload.input)
    try {
      const result = await callback(input)
      const after = await this.engine.afterToolUse({ ...payload, event: 'PostToolUse', toolResult: result, result })
      return after.type === 'redact' && after.redactedResult !== undefined ? after.redactedResult as T : result
    } catch (error) {
      await this.engine.emit({ ...payload, event: 'PostToolUse', error: error instanceof Error ? error.message : String(error) })
      throw error
    }
  }
}

export * from './builtins.ts'
export * from './storage.ts'
export * from './types.ts'
