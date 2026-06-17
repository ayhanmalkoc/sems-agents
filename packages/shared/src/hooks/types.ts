export type HookEventName = 'SessionStart' | 'UserPromptSubmit' | 'PreToolUse' | 'PostToolUse' | 'TurnStop' | 'SessionComplete' | 'AutomationRun' | 'FileChanged'
export type HookMode = 'observe' | 'enforce' | 'mutate' | 'ask'
export type HookDecisionType = 'allow' | 'block' | 'ask' | 'addContext' | 'mutate' | 'redact' | 'observe'
export type HookSource = 'builtin' | 'workspace' | 'plugin' | 'managed'
export type HookScope = 'system' | 'workspace' | 'agent_profile' | 'session'

export interface BuiltinHookDefinition {
  id: string
  name: string
  description: string
  event: HookEventName
  mode: HookMode
  source: HookSource
  scope: HookScope
  order: number
}

export interface HookConfigEntry {
  id: string
  enabled: boolean
}

export interface HooksPolicy {
  secretGuard: 'strict' | 'standard' | 'off'
  workspaceBoundary: 'block' | 'ask' | 'observe'
  prerequisiteGuard: 'enforce' | 'observe'
  toolAudit: 'on' | 'off'
  memoryLearn: 'auto' | 'review' | 'off'
  customHooks: 'off' | 'trusted-only'
  customDefaultPower: 'observe'
  customMaxDurationMs: number
  customMaxOutputBytes: number
}

export interface HookMatcher {
  event?: HookEventName
  toolName?: string
  commandIncludes?: string
  pathGlob?: string
  sessionScope?: 'current' | 'any'
  agentProfileId?: string
  automationEvent?: string
}

export type CustomHookHandler =
  | { type: 'command'; executable: string; args?: string[]; envAllowlist?: string[]; cwd?: string }
  | { type: 'http'; url: string; method?: 'POST'; headers?: Record<string, string>; body?: unknown; allowlist?: string[] }
  | { type: 'mcp'; target: string; tool: string; input?: unknown }
  | { type: 'prompt'; decision: HookDecision }

export type CustomHookPower = 'observe' | 'block' | 'ask' | 'mutate' | 'redact' | 'addContext'

export interface CustomHookDefinition {
  id: string
  name: string
  enabled: boolean
  source: Exclude<HookSource, 'builtin'>
  handler: CustomHookHandler
  matcher: HookMatcher
  powers: CustomHookPower[]
  timeoutMs?: number
  maxOutputBytes?: number
  description?: string
}

export interface CustomHookTrustRecord {
  hookId: string
  hash: string
  trusted: boolean
  approvedBy?: string
  approvedAt?: string
  revokedAt?: string
  reason?: string
}

export interface HooksConfig {
  version: 1
  hooks: HookConfigEntry[]
  policy?: Partial<HooksPolicy>
  customHooks?: CustomHookDefinition[]
  trust?: CustomHookTrustRecord[]
}

export interface HookEventPayload {
  event: HookEventName
  hookId?: string
  sessionId?: string
  workspaceId?: string
  agentId?: string
  toolName?: string
  toolInput?: unknown
  toolResult?: unknown
  input?: unknown
  result?: unknown
  workspaceRootPath?: string
  message?: string
  durationMs?: number
  error?: string
  source?: string
  metadata?: Record<string, unknown>
}

export interface HookDecision {
  type: HookDecisionType
  message?: string
  context?: string
  mutation?: unknown
  redactedResult?: unknown
}

export interface HookRunRecord {
  id: string
  hookId: string
  event: HookEventName
  decision: HookDecisionType
  message?: string
  inputSummary?: string
  outputSummary?: string
  decisions?: HookDecision[]
  finalDecision?: HookDecision
  matcherReason?: string
  trustSource?: HookSource
  sessionId?: string
  toolName?: string
  durationMs: number
  ok: boolean
  error?: string
  createdAt: string
}

export interface HookStatusSnapshot {
  available: boolean
  hooks: number
  enabled: number
  runs: number
  reason?: string
}
