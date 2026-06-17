import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'fs'
import { join } from 'path'
import { BUILTIN_HOOKS } from './builtins.ts'
import type { HookConfigEntry, HookRunRecord, HooksConfig, HooksPolicy } from './types.ts'

export function hooksDir(workspaceRootPath: string): string { return join(workspaceRootPath, 'hooks') }
export function hooksConfigPath(workspaceRootPath: string): string { return join(hooksDir(workspaceRootPath), 'hooks.json') }
export function hooksRunsPath(workspaceRootPath: string): string { return join(hooksDir(workspaceRootPath), 'runs.jsonl') }

function ensureDir(workspaceRootPath: string): void { mkdirSync(hooksDir(workspaceRootPath), { recursive: true }) }

export function defaultHooksPolicy(): HooksPolicy {
  return { secretGuard: 'standard', workspaceBoundary: 'ask', prerequisiteGuard: 'enforce', toolAudit: 'on', memoryLearn: 'auto' }
}

export function normalizeHooksPolicy(policy?: Partial<HooksPolicy>): HooksPolicy {
  const defaults = defaultHooksPolicy()
  return {
    secretGuard: policy?.secretGuard === 'strict' || policy?.secretGuard === 'off' ? policy.secretGuard : defaults.secretGuard,
    workspaceBoundary: policy?.workspaceBoundary === 'block' || policy?.workspaceBoundary === 'observe' ? policy.workspaceBoundary : defaults.workspaceBoundary,
    prerequisiteGuard: policy?.prerequisiteGuard === 'observe' ? 'observe' : defaults.prerequisiteGuard,
    toolAudit: policy?.toolAudit === 'off' ? 'off' : defaults.toolAudit,
    memoryLearn: policy?.memoryLearn === 'review' || policy?.memoryLearn === 'off' ? policy.memoryLearn : defaults.memoryLearn,
  }
}

export function defaultHooksConfig(): HooksConfig {
  return { version: 1, hooks: BUILTIN_HOOKS.map(hook => ({ id: hook.id, enabled: true })), policy: defaultHooksPolicy() }
}

export function loadHooksConfig(workspaceRootPath: string): HooksConfig {
  const path = hooksConfigPath(workspaceRootPath)
  if (!existsSync(path)) return defaultHooksConfig()
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Partial<HooksConfig>
    const existing = new Map((parsed.hooks ?? []).map(entry => [entry.id, Boolean(entry.enabled)]))
    return { version: 1, hooks: BUILTIN_HOOKS.map(hook => ({ id: hook.id, enabled: existing.get(hook.id) ?? true })), policy: normalizeHooksPolicy(parsed.policy) }
  } catch {
    return defaultHooksConfig()
  }
}

export function saveHooksConfig(workspaceRootPath: string, config: HooksConfig): HooksConfig {
  ensureDir(workspaceRootPath)
  const normalized: HooksConfig = { version: 1, hooks: BUILTIN_HOOKS.map(hook => ({ id: hook.id, enabled: config.hooks.find(entry => entry.id === hook.id)?.enabled ?? true })), policy: normalizeHooksPolicy(config.policy) }
  writeFileSync(hooksConfigPath(workspaceRootPath), `${JSON.stringify(normalized, null, 2)}\n`, 'utf8')
  return normalized
}

export function setHookEnabled(workspaceRootPath: string, hookId: string, enabled: boolean): HooksConfig {
  if (!BUILTIN_HOOKS.some(hook => hook.id === hookId)) throw new Error(`Unknown hook: ${hookId}`)
  const config = loadHooksConfig(workspaceRootPath)
  return saveHooksConfig(workspaceRootPath, { version: 1, hooks: config.hooks.map(entry => entry.id === hookId ? { ...entry, enabled } : entry) })
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

export function getHookConfigEntries(workspaceRootPath: string): HookConfigEntry[] {
  return loadHooksConfig(workspaceRootPath).hooks
}

export function loadHooksPolicy(workspaceRootPath: string): HooksPolicy { return normalizeHooksPolicy(loadHooksConfig(workspaceRootPath).policy) }

export function saveHooksPolicy(workspaceRootPath: string, policy: Partial<HooksPolicy>): HooksPolicy {
  const config = loadHooksConfig(workspaceRootPath)
  const next = normalizeHooksPolicy({ ...config.policy, ...policy })
  saveHooksConfig(workspaceRootPath, { ...config, policy: next })
  return next
}
