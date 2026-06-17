import { BUILTIN_HOOKS, getBuiltinHook } from './builtins.ts'
import { appendHookRun, getHookConfigEntries, loadHookRuns } from './storage.ts'
import type { BuiltinHookDefinition, HookDecision, HookEventPayload, HookRunRecord, HookStatusSnapshot } from './types.ts'

const SECRET_PATTERNS = [
  /[\"']?\b(api[_-]?key|token|password|passwd|secret|bearer)\b[\"']?\s*[:=]\s*[\"']?[A-Za-z0-9_\-./+=]{12,}/i,
  /-----BEGIN (RSA |OPENSSH |EC |)PRIVATE KEY-----/i,
  /\bBearer\s+[A-Za-z0-9_\-./+=]{12,}/i,
]

function containsSecret(value: unknown): boolean {
  const text = typeof value === 'string' ? value : JSON.stringify(value ?? '')
  return SECRET_PATTERNS.some(pattern => pattern.test(text))
}

function makeRun(hook: BuiltinHookDefinition, payload: HookEventPayload, decision: HookDecision, started: number, ok = true, error?: string): HookRunRecord {
  return {
    id: `hook-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
    hookId: hook.id,
    event: payload.event,
    decision: decision.type,
    message: decision.message,
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

  async emit(payload: HookEventPayload): Promise<HookDecision[]> {
    const hooks = this.list().filter(hook => hook.enabled && hook.event === payload.event)
    const decisions: HookDecision[] = []
    for (const hook of hooks) decisions.push(await this.runHook(hook, payload, false))
    return decisions
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
    if (hook.id === 'secret_scan_prompt') return containsSecret(payload.message ?? payload.input) ? { type: 'block', message: 'Hook blocked prompt: sensitive credentials or secrets detected.' } : { type: 'allow', message: 'No prompt secrets detected.' }
    if (hook.id === 'secret_scan_tool_input') return containsSecret(payload.input) ? { type: 'block', message: 'Hook blocked tool input: sensitive credentials or secrets detected.' } : { type: 'allow', message: 'No tool input secrets detected.' }
    if (hook.id === 'tool_prerequisite_guard') return { type: 'observe', message: 'Prerequisite guard is enforced by the existing prerequisite manager.' }
    if (hook.id === 'workspace_boundary_guard') return { type: 'observe', message: 'Workspace boundary guard observed this tool request.' }
    if (hook.id === 'memory_learn_on_session_complete') return { type: 'mutate', message: 'Memory auto-learn is delegated to the existing session completion memory engine.' }
    if (hook.id === 'tool_audit_log') return { type: 'observe', message: `Audited tool ${payload.toolName ?? 'unknown'}.` }
    if (hook.id === 'automation_run_audit') return { type: 'observe', message: 'Audited automation run.' }
    if (hook.id === 'validation_summary_on_turn_stop') return { type: 'observe', message: 'Captured turn-stop validation summary context.' }
    return { type: 'observe', message: 'Hook observed event.' }
  }
}

export * from './builtins.ts'
export * from './storage.ts'
export * from './types.ts'
