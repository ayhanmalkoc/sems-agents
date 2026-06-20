import { createHash } from 'crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'fs'
import { join } from 'path'
import { BUILTIN_HOOKS } from './builtins.ts'
import type { CustomHookDefinition, CustomHookTrustRecord, HookConfigEntry, HookRunRecord, HooksConfig, HooksPolicy } from './types.ts'

export function hooksDir(workspaceRootPath: string): string { return join(workspaceRootPath, 'hooks') }
export function hooksConfigPath(workspaceRootPath: string): string { return join(hooksDir(workspaceRootPath), 'hooks.json') }
export function hooksRunsPath(workspaceRootPath: string): string { return join(hooksDir(workspaceRootPath), 'runs.jsonl') }

function ensureDir(workspaceRootPath: string): void { mkdirSync(hooksDir(workspaceRootPath), { recursive: true }) }

export function defaultHooksPolicy(): HooksPolicy {
  return { secretGuard: 'standard', workspaceBoundary: 'ask', prerequisiteGuard: 'enforce', toolAudit: 'on', customHooks: 'trusted-only', customMaxDurationMs: 2000, customMaxOutputBytes: 4096 }
}

export function normalizeHooksPolicy(policy?: Partial<HooksPolicy>): HooksPolicy {
  const defaults = defaultHooksPolicy()
  return {
    secretGuard: policy?.secretGuard === 'strict' || policy?.secretGuard === 'off' ? policy.secretGuard : defaults.secretGuard,
    workspaceBoundary: policy?.workspaceBoundary === 'block' || policy?.workspaceBoundary === 'observe' ? policy.workspaceBoundary : defaults.workspaceBoundary,
    prerequisiteGuard: policy?.prerequisiteGuard === 'observe' ? 'observe' : defaults.prerequisiteGuard,
    toolAudit: policy?.toolAudit === 'off' ? 'off' : defaults.toolAudit,
    customHooks: policy?.customHooks === 'off' ? 'off' : defaults.customHooks,
    customMaxDurationMs: Number.isFinite(policy?.customMaxDurationMs) ? Math.max(100, Math.min(30000, Number(policy?.customMaxDurationMs))) : defaults.customMaxDurationMs,
    customMaxOutputBytes: Number.isFinite(policy?.customMaxOutputBytes) ? Math.max(128, Math.min(65536, Number(policy?.customMaxOutputBytes))) : defaults.customMaxOutputBytes,
  }
}

export function hashCustomHook(hook: CustomHookDefinition): string {
  const stable = { ...hook, enabled: undefined }
  return createHash('sha256').update(JSON.stringify(stable)).digest('hex')
}

function normalizeCustomHook(hook: CustomHookDefinition): CustomHookDefinition {
  if (!hook.id?.trim()) throw new Error('Custom hook id is required.')
  if (!hook.name?.trim()) throw new Error('Custom hook name is required.')
  if (!hook.matcher?.event) throw new Error('Custom hook matcher.event is required.')
  if (!hook.handler?.type) throw new Error('Custom hook handler.type is required.')
  if (hook.handler.type === 'command' && !hook.handler.executable?.trim()) throw new Error('Command hook executable is required.')
  if (hook.handler.type === 'http' && !hook.handler.url?.trim()) throw new Error('HTTP hook url is required.')
  if (hook.handler.type === 'mcp' && (!hook.handler.target?.trim() || !hook.handler.tool?.trim())) throw new Error('MCP hook target and tool are required.')
  return { ...hook, id: hook.id.trim(), name: hook.name.trim(), enabled: hook.enabled !== false, source: hook.source ?? 'workspace', matcher: hook.matcher, powers: hook.powers?.length ? hook.powers : ['observe'], timeoutMs: hook.timeoutMs, maxOutputBytes: hook.maxOutputBytes }
}

export function defaultHooksConfig(): HooksConfig {
  return { version: 1, hooks: BUILTIN_HOOKS.map(hook => ({ id: hook.id, enabled: true })), policy: defaultHooksPolicy(), customHooks: [], trust: [] }
}

export function loadHooksConfig(workspaceRootPath: string): HooksConfig {
  const path = hooksConfigPath(workspaceRootPath)
  if (!existsSync(path)) return defaultHooksConfig()
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<HooksConfig>
    const existing = new Map((parsed.hooks ?? []).map(entry => [entry.id, Boolean(entry.enabled)]))
    return {
      version: 1,
      hooks: BUILTIN_HOOKS.map(hook => ({ id: hook.id, enabled: existing.get(hook.id) ?? true })),
      policy: normalizeHooksPolicy(parsed.policy),
      customHooks: (parsed.customHooks ?? []).map(normalizeCustomHook),
      trust: parsed.trust ?? [],
    }
  } catch {
    return defaultHooksConfig()
  }
}

export function saveHooksConfig(workspaceRootPath: string, config: HooksConfig): HooksConfig {
  ensureDir(workspaceRootPath)
  const normalized: HooksConfig = {
    version: 1,
    hooks: BUILTIN_HOOKS.map(hook => ({ id: hook.id, enabled: config.hooks.find(entry => entry.id === hook.id)?.enabled ?? true })),
    policy: normalizeHooksPolicy(config.policy),
    customHooks: (config.customHooks ?? []).map(normalizeCustomHook),
    trust: config.trust ?? [],
  }
  writeFileSync(hooksConfigPath(workspaceRootPath), `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
  return normalized
}

export function setHookEnabled(workspaceRootPath: string, hookId: string, enabled: boolean): HooksConfig {
  if (!BUILTIN_HOOKS.some(hook => hook.id === hookId)) throw new Error(`Unknown hook: ${hookId}`)
  const config = loadHooksConfig(workspaceRootPath)
  return saveHooksConfig(workspaceRootPath, { ...config, hooks: config.hooks.map(entry => entry.id === hookId ? { ...entry, enabled } : entry) })
}

export function appendHookRun(workspaceRootPath: string, run: HookRunRecord): HookRunRecord {
  ensureDir(workspaceRootPath)
  appendFileSync(hooksRunsPath(workspaceRootPath), `${JSON.stringify(run)}\n`, 'utf8')
  return run
}

export function loadHookRuns(workspaceRootPath: string, hookId?: string, limit = 50): HookRunRecord[] {
  const path = hooksRunsPath(workspaceRootPath)
  if (!existsSync(path)) return []
  const rows = readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean)
  const runs: HookRunRecord[] = []
  for (const row of rows) {
    try {
      const run = JSON.parse(row) as HookRunRecord
      if (!hookId || run.hookId === hookId) runs.push(run)
    } catch {}
  }
  return runs.slice(-limit).reverse()
}

export function getHookRun(workspaceRootPath: string, runId: string): HookRunRecord | undefined {
  return loadHookRuns(workspaceRootPath, undefined, 1000).find(run => run.id === runId)
}

export function getHookConfigEntries(workspaceRootPath: string): HookConfigEntry[] { return loadHooksConfig(workspaceRootPath).hooks }
export function loadHooksPolicy(workspaceRootPath: string): HooksPolicy { return normalizeHooksPolicy(loadHooksConfig(workspaceRootPath).policy) }
export function saveHooksPolicy(workspaceRootPath: string, policy: Partial<HooksPolicy>): HooksPolicy {
  const config = loadHooksConfig(workspaceRootPath)
  const next = normalizeHooksPolicy({ ...config.policy, ...policy })
  saveHooksConfig(workspaceRootPath, { ...config, policy: next })
  return next
}

export function loadCustomHooks(workspaceRootPath: string): CustomHookDefinition[] { return loadHooksConfig(workspaceRootPath).customHooks ?? [] }
export function getCustomHook(workspaceRootPath: string, hookId: string): CustomHookDefinition | undefined { return loadCustomHooks(workspaceRootPath).find(hook => hook.id === hookId) }
export function saveCustomHook(workspaceRootPath: string, hook: CustomHookDefinition): CustomHookDefinition {
  const config = loadHooksConfig(workspaceRootPath)
  const normalized = normalizeCustomHook(hook)
  const existing = config.customHooks ?? []
  const customHooks = existing.some(entry => entry.id === normalized.id) ? existing.map(entry => entry.id === normalized.id ? normalized : entry) : [...existing, normalized]
  const trust = (config.trust ?? []).map(record => record.hookId === normalized.id && record.hash !== hashCustomHook(normalized) ? { ...record, trusted: false, reason: 'Hook configuration changed; trust review required.' } : record)
  saveHooksConfig(workspaceRootPath, { ...config, customHooks, trust })
  return normalized
}
export function deleteCustomHook(workspaceRootPath: string, hookId: string): void {
  const config = loadHooksConfig(workspaceRootPath)
  saveHooksConfig(workspaceRootPath, { ...config, customHooks: (config.customHooks ?? []).filter(hook => hook.id !== hookId), trust: (config.trust ?? []).filter(record => record.hookId !== hookId) })
}
export function loadCustomHookTrust(workspaceRootPath: string): CustomHookTrustRecord[] { return loadHooksConfig(workspaceRootPath).trust ?? [] }
export function trustReviewCustomHook(workspaceRootPath: string, hookId: string): CustomHookTrustRecord {
  const hook = getCustomHook(workspaceRootPath, hookId)
  if (!hook) throw new Error(`Unknown custom hook: ${hookId}`)
  const hash = hashCustomHook(hook)
  return loadCustomHookTrust(workspaceRootPath).find(record => record.hookId === hookId) ?? { hookId, hash, trusted: false, reason: 'Trust review required.' }
}
export function trustApproveCustomHook(workspaceRootPath: string, hookId: string, approvedBy = 'user'): CustomHookTrustRecord {
  const hook = getCustomHook(workspaceRootPath, hookId)
  if (!hook) throw new Error(`Unknown custom hook: ${hookId}`)
  const config = loadHooksConfig(workspaceRootPath)
  const next: CustomHookTrustRecord = { hookId, hash: hashCustomHook(hook), trusted: true, approvedBy, approvedAt: new Date().toISOString() }
  saveHooksConfig(workspaceRootPath, { ...config, trust: [...(config.trust ?? []).filter(record => record.hookId !== hookId), next] })
  return next
}
export function trustRevokeCustomHook(workspaceRootPath: string, hookId: string): CustomHookTrustRecord {
  const config = loadHooksConfig(workspaceRootPath)
  const hook = getCustomHook(workspaceRootPath, hookId)
  if (!hook) throw new Error(`Unknown custom hook: ${hookId}`)
  const next: CustomHookTrustRecord = { hookId, hash: hashCustomHook(hook), trusted: false, revokedAt: new Date().toISOString(), reason: 'Trust revoked.' }
  saveHooksConfig(workspaceRootPath, { ...config, trust: [...(config.trust ?? []).filter(record => record.hookId !== hookId), next] })
  return next
}
export function setCustomHookMatcher(workspaceRootPath: string, hookId: string, matcher: CustomHookDefinition['matcher']): CustomHookDefinition {
  const hook = getCustomHook(workspaceRootPath, hookId)
  if (!hook) throw new Error(`Unknown custom hook: ${hookId}`)
  return saveCustomHook(workspaceRootPath, { ...hook, matcher })
}
