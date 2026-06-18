import type { BuiltinHookDefinition, CustomHookDefinition, CustomHookTrustRecord, HookEventName, HookRunRecord } from '@craft-agent/shared/hooks'

export type TrustStatus = 'Built-in' | 'Trusted' | 'Untrusted' | 'Changed'
export type HookKind = 'builtin' | 'custom'

export type HookListItem = {
  id: string
  name: string
  event: HookEventName
  enabled: boolean
  kind: HookKind
  trustStatus: TrustStatus
  handlerType: string
  matcherSummary: string
  description?: string
  customHook?: CustomHookDefinition
  builtinHook?: BuiltinHookDefinition & { enabled: boolean }
  powers?: string[]
  timeoutMs?: number
  hash?: string
  lastRun?: HookRunRecord
}

export type HookGroup = { event: HookEventName; title: string; description: string; hooks: HookListItem[] }

export const EVENT_GROUPS: Array<{ event: HookEventName; title: string; description: string }> = [
  { event: 'SessionStart', title: 'Session start', description: 'When a new session starts' },
  { event: 'UserPromptSubmit', title: 'User prompt submit', description: 'When the user sends a prompt' },
  { event: 'PreToolUse', title: 'Before tool use', description: 'Before a tool is run' },
  { event: 'PermissionRequest', title: 'Permission request', description: 'Before an approval request is shown' },
  { event: 'PostToolUse', title: 'After tool use', description: 'After a tool has run' },
  { event: 'PreCompact', title: 'Before compaction', description: 'Before conversation compaction' },
  { event: 'PostCompact', title: 'After compaction', description: 'After conversation compaction' },
  { event: 'SubagentStart', title: 'Subagent start', description: 'When a subagent starts' },
  { event: 'SubagentStop', title: 'Subagent stop', description: 'When a subagent stops' },
  { event: 'Stop', title: 'Stop', description: 'Before an agent turn stops' },
  { event: 'SessionComplete', title: 'Session complete', description: 'When a session completes' },
  { event: 'AutomationRun', title: 'Automation run', description: 'When an automation runs' },
  { event: 'FileChanged', title: 'File changed', description: 'When a watched file changes' },
]

export function getCustomHookTrustStatus(_hook: CustomHookDefinition, record?: CustomHookTrustRecord): TrustStatus {
  if (!record?.trusted) return record?.reason?.toLowerCase().includes('changed') ? 'Changed' : 'Untrusted'
  return 'Trusted'
}

export function matcherSummary(hook: CustomHookDefinition): string {
  const parts = [hook.matcher.toolName && `tool:${hook.matcher.toolName}`, hook.matcher.commandIncludes && `includes:${hook.matcher.commandIncludes}`, hook.matcher.pathGlob && `path:${hook.matcher.pathGlob}`, hook.matcher.agentProfileId && `agent:${hook.matcher.agentProfileId}`].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'all matching events'
}

export function buildHookGroups(
  builtins: Array<BuiltinHookDefinition & { enabled: boolean }>,
  customHooks: CustomHookDefinition[],
  trustRecords: CustomHookTrustRecord[] = [],
  runs: HookRunRecord[] = [],
  options: { includeBuiltins?: boolean } = { includeBuiltins: true },
): HookGroup[] {
  const trustByHook = new Map(trustRecords.map(record => [record.hookId, record]))
  const lastRunByHook = new Map<string, HookRunRecord>()
  for (const run of runs) if (!lastRunByHook.has(run.hookId)) lastRunByHook.set(run.hookId, run)
  const rows: HookListItem[] = [
    ...((options.includeBuiltins ?? true) ? builtins.map(hook => ({
      id: hook.id,
      name: hook.name,
      event: hook.event,
      enabled: hook.enabled,
      kind: 'builtin' as const,
      trustStatus: 'Built-in' as const,
      handlerType: 'builtin',
      matcherSummary: 'all matching events',
      description: hook.description,
      builtinHook: hook,
      lastRun: lastRunByHook.get(hook.id),
    })) : []),
    ...customHooks.map(hook => ({
      id: hook.id,
      name: hook.name,
      event: hook.matcher.event ?? 'PreToolUse',
      enabled: hook.enabled,
      kind: 'custom' as const,
      trustStatus: getCustomHookTrustStatus(hook, trustByHook.get(hook.id)),
      handlerType: hook.handler.type,
      matcherSummary: matcherSummary(hook),
      description: hook.description,
      customHook: hook,
      powers: hook.powers,
      timeoutMs: hook.timeoutMs,
      hash: trustByHook.get(hook.id)?.hash,
      lastRun: lastRunByHook.get(hook.id),
    })),
  ]
  return EVENT_GROUPS.map(group => ({ ...group, hooks: rows.filter(row => row.event === group.event) })).filter(group => group.hooks.length > 0)
}
