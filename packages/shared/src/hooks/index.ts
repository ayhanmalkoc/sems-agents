import { BUILTIN_HOOKS, getBuiltinHook } from './builtins.ts'
import { appendHookRun, getHookConfigEntries, loadHookRuns, loadHooksPolicy } from './storage.ts'
import type { BuiltinHookDefinition, HookDecision, HookDecisionType, HookEventPayload, HookRunRecord, HookStatusSnapshot, HooksPolicy } from './types.ts'

const SECRET_PATTERNS = [
  /[\"']?\b(api[_-]?key|token|password|passwd|secret|bearer)\b[\"']?\s*[:=]\s*[\"']?[A-Za-z0-9_\-./+=]{12,}/i,
  /-----BEGIN (RSA |OPENSSH |EC |)PRIVATE KEY-----/i,
  /\bBearer\s+[A-Za-z0-9_\-./+=]{12,}/i,
]

function containsSecret(value: unknown): boolean {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '')
  return SECRET_PATTERNS.some(pattern => pattern.test(text))
}

function summarize(value: unknown, max = 360): string | undefined {
  if (value === undefined) return undefined
  const text = typeof value === 'string' ? value : JSON.stringify(value)
  if (!text) return undefined
  return redactSecrets(text).slice(0, max)
}

function redactSecrets(text: string): string {
  return SECRET_PATTERNS.reduce((current, pattern) => current.replace(pattern, '[REDACTED_SECRET]'), text)
}

const PRECEDENCE: HookDecisionType[] = ['block', 'ask', 'mutate', 'addContext', 'redact', 'observe', 'allow']

export function mergeHookDecisions(decisions: HookDecision[]): HookDecision {
  if (decisions.length === 0) return { type: 'allow', message: 'No hooks matched.' }
  return [...decisions].sort((a, b) => PRECEDENCE.indexOf(a.type) - PRECEDENCE.indexOf(b.type))[0]!
}

function looksWorkspaceRisky(payload: HookEventPayload): boolean {
  const text = JSON.stringify(payload.toolInput ?? payload.input ?? '')
  return /(\.\.\|\.\.\/|Remove-Item|rm\s+-rf|del\s+\/|rmdir|C:\\Windows|\/etc\/|~\/\.ssh)/i.test(text)
}

function makeRun(hook: BuiltinHookDefinition, payload: HookEventPayload, decision: HookDecision, started: number, ok = true, error?: string): HookRunRecord {
  return {
    id: `hook-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    hookId: hook.id,
    event: payload.event,
    decision: decision.type,
    message: decision.message,
    inputSummary: summarize(payload.toolInput ?? payload.input),
    outputSummary: summarize(payload.toolResult ?? payload.result),
    decisions: [decision],
    sessionId: payload.sessionId,
    toolName: payload.toolName,
    durationMs: Date.now() - started,
    ok,
    error,
    createdAt: new Date().toISOString(),
  }
}

export class HookEngine {
  constructor(private readonly workspaceRootPath: string) {}

  status(): HookStatusSnapshot {
    const config = getHookConfigEntries(this.workspaceRootPath)
    return { available: true, hooks: BUILTIN_HOOKS.length, enabled: config.filter(entry => entry.enabled).length, runs: loadHookRuns(this.workspaceRootPath, undefined, 1000).length }
  }

  list(): Array<BuiltinHookDefinition & { enabled: boolean }> {
    const enabled = new Map(getHookConfigEntries(this.workspaceRootPath).map(entry => [entry.id, entry.enabled]))
    return BUILTIN_HOOKS.map(hook => ({ ...hook, enabled: enabled.get(hook.id) ?? true })).sort((a, b) => a.order - b.order)
  }

  show(hookId: string): (BuiltinHookDefinition & { enabled: boolean }) | undefined {
    return this.list().find(hook => hook.id === hookId)
  }

  policy(): HooksPolicy { return loadHooksPolicy(this.workspaceRootPath) }

  async beforeToolUse(payload: HookEventPayload): Promise<HookDecision> {
    const decisions = await this.runEvent({ ...payload, event: 'PreToolUse' })
    return mergeHookDecisions(decisions)
  }

  async afterToolUse(payload: HookEventPayload): Promise<HookDecision> {
    const decisions = await this.runEvent({ ...payload, event: 'PostToolUse' })
    return mergeHookDecisions(decisions)
  }

  async beforePromptSubmit(payload: HookEventPayload): Promise<HookDecision> {
    const decisions = await this.runEvent({ ...payload, event: 'UserPromptSubmit' })
    return mergeHookDecisions(decisions)
  }

  async simulateTool(payload: HookEventPayload): Promise<HookDecision> {
    const decisions = this.list().filter(hook => hook.enabled && hook.event === 'PreToolUse').map(hook => this.decide(hook, { ...payload, event: 'PreToolUse' }))
    return mergeHookDecisions(decisions)
  }

  async simulatePrompt(payload: HookEventPayload): Promise<HookDecision> {
    const decisions = this.list().filter(hook => hook.enabled && hook.event === 'UserPromptSubmit').map(hook => this.decide(hook, { ...payload, event: 'UserPromptSubmit' }))
    return mergeHookDecisions(decisions)
  }

  private async runEvent(payload: HookEventPayload): Promise<HookDecision[]> {
    const hooks = this.list().filter(hook => hook.enabled && hook.event === payload.event)
    const decisions: HookDecision[] = []
    for (const hook of hooks) decisions.push(await this.runHook(hook, payload, false))
    return decisions
  }

  async emit(payload: HookEventPayload): Promise<HookDecision[]> {
    return this.runEvent(payload)
  }

  async test(hookId: string, payload: HookEventPayload): Promise<HookDecision> {
    const hook = getBuiltinHook(hookId)
    if (!hook) throw new Error(`Unknown hook: ${hookId}`)
    return this.runHook(hook, { ...payload, event: payload.event ?? hook.event }, true)
  }

  private async runHook(hook: BuiltinHookDefinition, payload: HookEventPayload, dryRun: boolean): Promise<HookDecision> {
    const started = Date.now()
    try {
      const decision = this.decide(hook, payload)
      if (!dryRun) appendHookRun(this.workspaceRootPath, makeRun(hook, payload, decision, started))
      return decision
    } catch (error) {
      const decision: HookDecision = { type: 'block', message: error instanceof Error ? error.message : String(error) }
      if (!dryRun) appendHookRun(this.workspaceRootPath, makeRun(hook, payload, decision, started, false, decision.message))
      return decision
    }
  }

  private decide(hook: BuiltinHookDefinition, payload: HookEventPayload): HookDecision {
    const policy = this.policy()
    const input = payload.toolInput ?? payload.input
    const output = payload.toolResult ?? payload.result
    if (hook.id === 'secret_scan_prompt') {
      if (policy.secretGuard === 'off') return { type: 'allow', message: 'Secret guard is off.' }
      return containsSecret(payload.message ?? input) ? { type: 'block', message: 'Hook blocked prompt: sensitive credentials or secrets detected.' } : { type: 'allow', message: 'No prompt secrets detected.' }
    }
    if (hook.id === 'secret_scan_tool_input') {
      if (policy.secretGuard === 'off') return { type: 'allow', message: 'Secret guard is off.' }
      return containsSecret(input) ? { type: 'block', message: 'Hook blocked tool input: sensitive credentials or secrets detected.' } : { type: 'allow', message: 'No tool input secrets detected.' }
    }
    if (hook.id === 'tool_prerequisite_guard') return policy.prerequisiteGuard === 'enforce' ? { type: 'observe', message: 'Prerequisite guard is enforced by the existing prerequisite manager.' } : { type: 'observe', message: 'Prerequisite guard observe-only.' }
    if (hook.id === 'workspace_boundary_guard') {
      if (!looksWorkspaceRisky(payload)) return { type: 'allow', message: 'No workspace boundary risk detected.' }
      if (policy.workspaceBoundary === 'block') return { type: 'block', message: 'Hook blocked risky workspace boundary operation.' }
      if (policy.workspaceBoundary === 'ask') return { type: 'ask', message: 'Hook requires approval for risky workspace boundary operation.' }
      return { type: 'observe', message: 'Observed risky workspace boundary operation.' }
    }
    if (hook.id === 'memory_learn_on_session_complete') return policy.memoryLearn === 'off' ? { type: 'observe', message: 'Memory learn hook is off.' } : { type: 'mutate', message: 'Memory auto-learn is delegated to the existing session completion memory engine.' }
    if (hook.id === 'tool_audit_log') {
      if (policy.toolAudit === 'off') return { type: 'allow', message: 'Tool audit is off.' }
      if (containsSecret(output)) return { type: 'redact', message: `Audited and redacted tool ${payload.toolName ?? 'unknown'}.`, redactedResult: typeof output === 'string' ? redactSecrets(output) : JSON.parse(redactSecrets(JSON.stringify(output))) }
      return { type: 'observe', message: `Audited tool ${payload.toolName ?? 'unknown'}.` }
    }
    if (hook.id === 'automation_run_audit') return { type: 'observe', message: 'Audited automation run.' }
    if (hook.id === 'validation_summary_on_turn_stop') return { type: 'observe', message: 'Captured turn-stop validation summary context.' }
    return { type: 'observe', message: 'Hook observed event.' }
  }
}

export * from './builtins.ts'
export * from './storage.ts'
export * from './types.ts'
