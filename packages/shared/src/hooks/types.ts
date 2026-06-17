export type HookEventName = 'SessionStart' | 'UserPromptSubmit' | 'PreToolUse' | 'PostToolUse' | 'TurnStop' | 'SessionComplete' | 'AutomationRun' | 'FileChanged'
export type HookMode = 'observe' | 'enforce' | 'mutate' | 'ask'
export type HookDecisionType = 'allow' | 'block' | 'ask' | 'addContext' | 'mutate' | 'redact' | 'observe'
export type HookOutputDecision = 'allow' | 'block' | 'ask' | 'modify' | 'add_context' | 'redact' | 'observe'
export type HookSource = 'builtin' | 'workspace' | 'plugin' | 'managed'
export type HookScope = 'system' | 'workspace' | 'agent_profile' | 'session'

export interface BuiltinHookDefinition { id: string; name: string; description: string; event: HookEventName; mode: HookMode; source: HookSource; scope: HookScope; order: number }
export interface HookConfigEntry { id: string; enabled: boolean }
export interface HooksPolicy { secretGuard: 'strict' | 'standard' | 'off'; workspaceBoundary: 'block' | 'ask' | 'observe'; prerequisiteGuard: 'enforce' | 'observe'; toolAudit: 'on' | 'off'; memoryLearn: 'auto' | 'review' | 'off'; customHooks: 'off' | 'trusted-only'; customDefaultPower: 'observe'; customMaxDurationMs: number; customMaxOutputBytes: number }

export interface HookMatcher { event?: HookEventName; toolName?: string; commandIncludes?: string; pathGlob?: string; sessionScope?: 'current' | 'any'; agentProfileId?: string; automationEvent?: string }

export interface HookInput {
  hook_event_name: HookEventName
  workspace_id?: string
  session_id?: string
  agent_id?: string
  tool_name?: string
  tool_input?: unknown
  tool_response?: unknown
  prompt?: string
  timestamp: string
  metadata?: Record<string, unknown>
}

export interface HookOutput {
  decision: HookOutputDecision
  reason?: string
  updated_input?: unknown
  additional_context?: string
  redacted_response?: unknown
}

export interface HookDecision { type: HookDecisionType; message?: string; context?: string; mutation?: unknown; redactedResult?: unknown }

export type CustomHookHandler =
  | { type: 'command'; executable: string; args?: string[]; envAllowlist?: string[]; cwd?: string }
  | { type: 'http'; url: string; method?: 'POST'; headers?: Record<string, string>; body?: unknown; allowlist?: string[] }
  | { type: 'mcp'; target: string; tool: string; input?: unknown }
  | { type: 'prompt'; decision?: HookDecision; output?: HookOutput }

export type CustomHookPower = 'observe' | 'block' | 'ask' | 'mutate' | 'redact' | 'addContext' | 'modify' | 'add_context'
export interface CustomHookDefinition { id: string; name: string; enabled: boolean; source: Exclude<HookSource, 'builtin'>; handler: CustomHookHandler; matcher: HookMatcher; powers: CustomHookPower[]; timeoutMs?: number; maxOutputBytes?: number; description?: string }
export interface CustomHookTrustRecord { hookId: string; hash: string; trusted: boolean; approvedBy?: string; approvedAt?: string; revokedAt?: string; reason?: string }
export interface HooksConfig { version: 1; hooks: HookConfigEntry[]; policy?: Partial<HooksPolicy>; customHooks?: CustomHookDefinition[]; trust?: CustomHookTrustRecord[] }

export interface HookEventPayload {
  event?: HookEventName
  hook_event_name?: HookEventName
  hookId?: string
  sessionId?: string
  session_id?: string
  workspaceId?: string
  workspace_id?: string
  agentId?: string
  agent_id?: string
  toolName?: string
  tool_name?: string
  toolInput?: unknown
  tool_input?: unknown
  toolResult?: unknown
  tool_response?: unknown
  input?: unknown
  result?: unknown
  workspaceRootPath?: string
  message?: string
  prompt?: string
  durationMs?: number
  error?: string
  source?: string
  timestamp?: string
  metadata?: Record<string, unknown>
}

export interface HookRunRecord { id: string; hookId: string; event: HookEventName; decision: HookDecisionType; message?: string; inputSummary?: string; outputSummary?: string; decisions?: HookDecision[]; outputs?: HookOutput[]; finalDecision?: HookDecision; finalOutput?: HookOutput; matcherReason?: string; trustSource?: HookSource; sessionId?: string; toolName?: string; durationMs: number; ok: boolean; error?: string; createdAt: string }
export interface HookStatusSnapshot { available: boolean; hooks: number; enabled: number; runs: number; reason?: string }
