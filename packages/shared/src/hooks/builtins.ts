import type { BuiltinHookDefinition } from './types.ts'

export const BUILTIN_HOOKS: BuiltinHookDefinition[] = [
  { id: 'secret_scan_prompt', name: 'Secret scan prompt', description: 'Blocks prompts that appear to contain credentials or secrets.', event: 'UserPromptSubmit', mode: 'enforce', source: 'builtin', scope: 'workspace', order: 10 },
  { id: 'secret_scan_tool_input', name: 'Secret scan tool input', description: 'Blocks tool inputs that appear to contain credentials or secrets.', event: 'PreToolUse', mode: 'enforce', source: 'builtin', scope: 'workspace', order: 20 },
  { id: 'tool_prerequisite_guard', name: 'Tool prerequisite guard', description: 'Enforces tool documentation prerequisites before domain mutations.', event: 'PreToolUse', mode: 'enforce', source: 'builtin', scope: 'workspace', order: 30 },
  { id: 'workspace_boundary_guard', name: 'Workspace boundary guard', description: 'Flags risky workspace-boundary operations before tool execution.', event: 'PreToolUse', mode: 'ask', source: 'builtin', scope: 'workspace', order: 40 },
  { id: 'tool_audit_log', name: 'Tool audit log', description: 'Records tool execution decisions, duration, and errors.', event: 'PostToolUse', mode: 'observe', source: 'builtin', scope: 'workspace', order: 900 },
  { id: 'validation_summary_on_turn_stop', name: 'Validation summary on turn stop', description: 'Captures validation/test summary context at turn stop.', event: 'TurnStop', mode: 'observe', source: 'builtin', scope: 'session', order: 910 },
  { id: 'memory_learn_on_session_complete', name: 'Memory learn on session complete', description: 'Runs automatic memory learning after successful session completion.', event: 'SessionComplete', mode: 'mutate', source: 'builtin', scope: 'workspace', order: 920 },
  { id: 'automation_run_audit', name: 'Automation run audit', description: 'Links automation run metadata into hook audit history.', event: 'AutomationRun', mode: 'observe', source: 'builtin', scope: 'workspace', order: 930 },
]

export function getBuiltinHook(id: string): BuiltinHookDefinition | undefined {
  return BUILTIN_HOOKS.find(hook => hook.id === id)
}
