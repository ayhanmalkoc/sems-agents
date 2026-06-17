# Hooks Tools

Use the `hooks` tool to manage workspace lifecycle hooks. Hooks are the runtime policy, audit, enforcement, and explainability layer. They do not replace domain tools such as `memory`, `sessions`, `agents`, `automations`, or `resources`.

## Product Policy

- Builtin hooks are always available for security, prerequisites, workspace boundary checks, audit, memory learning, and validation summaries.
- Trusted custom hooks are supported for workspace-local automation. Untrusted custom hooks never run.
- Custom hooks require trust review before execution. If handler config or content hash changes, trust is revoked automatically.
- Command hooks use `executable + args`; shell strings are not supported.
- HTTP hooks require an explicit URL target and timeout/output limits.
- MCP hooks may only target configured workspace MCP sources.
- Prompt hooks return text/JSON decisions only; they do not execute arbitrary code.
- Hook audit stores redacted summaries, not raw secrets or large payload dumps.
- Hook decisions are runtime-authoritative. If a hook blocks or asks, the tool/prompt flow must obey it.


## Craft Native Hook Contract

Hook input is snake_case and lifecycle-focused:

```json
{
  "hook_event_name": "PreToolUse",
  "workspace_id": "my-workspace",
  "session_id": "260617-example",
  "agent_id": "default",
  "tool_name": "bash",
  "tool_input": { "command": "git status" },
  "tool_response": null,
  "prompt": null,
  "timestamp": "2026-06-17T00:00:00.000Z",
  "metadata": {}
}
```

Hook output is explicit:

```json
{
  "decision": "modify",
  "reason": "Normalize command input",
  "updated_input": { "command": "git status --short" },
  "additional_context": null,
  "redacted_response": null
}
```

Valid decisions: `allow`, `block`, `ask`, `modify`, `add_context`, `redact`, `observe`.

Legacy internal camelCase payloads are normalized into this contract before hooks run.

## Commands

- `hooks status` - summarize availability, enabled count, custom count, and run count.
- `hooks list` - list builtin hooks.
- `hooks show <hookId>` - inspect one builtin hook.
- `hooks enable <hookId>` - enable one builtin hook.
- `hooks disable <hookId>` - disable one builtin hook.
- `hooks runs [hookId]` - show recent hook runs.
- `hooks explain <runId>` - inspect one hook run summary.
- `hooks run-detail <runId>` - inspect final decision and per-hook decision timeline.
- `hooks test <hookId> <json>` - dry-run one builtin or custom hook.
- `hooks policy` - show workspace hook policy.
- `hooks set-policy <json>` - update workspace hook policy.
- `hooks simulate-tool <snake_case-json>` - dry-run the `PreToolUse` gateway.
- `hooks simulate-prompt <snake_case-json>` - dry-run the `UserPromptSubmit` gateway.
- `hooks custom-list` - list workspace custom hooks.
- `hooks custom-show <hookId>` - inspect one custom hook.
- `hooks custom-create <json>` - create one custom hook.
- `hooks custom-update <hookId> <json>` - update one custom hook; trust may be revoked if hash changes.
- `hooks custom-delete <hookId>` - delete one custom hook.
- `hooks trust-review <hookId>` - show trust status and hash.
- `hooks trust-approve <hookId> --confirm` - approve current custom hook hash.
- `hooks trust-revoke <hookId>` - revoke trust.
- `hooks matcher-set <hookId> <json>` - update a custom hook matcher.

## Builtin Hooks

- `secret_scan_prompt` - blocks prompt content that appears to contain credentials or secrets.
- `secret_scan_tool_input` - blocks tool input that appears to contain credentials or secrets.
- `tool_prerequisite_guard` - preserves existing documentation prerequisite checks.
- `workspace_boundary_guard` - asks or blocks for risky workspace boundary operations.
- `tool_audit_log` - records post-tool decisions and redacts secret-looking output.
- `validation_summary_on_turn_stop` - captures turn-stop validation context.
- `memory_learn_on_session_complete` - delegates session completion memory learning to the memory engine.
- `automation_run_audit` - links automation run metadata into hook audit history.

## Custom Hook Schema

```json
{
  "id": "workspace_quality_gate",
  "name": "Workspace quality gate",
  "enabled": true,
  "source": "workspace",
  "matcher": { "event": "PreToolUse", "toolName": "bash" },
  "handler": { "type": "prompt", "output": { "decision": "observe", "reason": "ok" } },
  "powers": ["observe"],
  "timeoutMs": 2000,
  "maxOutputBytes": 4096
}
```

Allowed handler types: `command`, `http`, `mcp`, `prompt`.
Allowed powers: `observe`, `block`, `ask`, `mutate`, `redact`, `addContext`.

## Policy

- `secretGuard`: `strict | standard | off`
- `workspaceBoundary`: `block | ask | observe`
- `prerequisiteGuard`: `enforce | observe`
- `toolAudit`: `on | off`
- `memoryLearn`: `auto | review | off`
- `customHooks`: `off | trusted-only`
- `customDefaultPower`: `observe`
- `customMaxDurationMs`: max custom hook runtime
- `customMaxOutputBytes`: max custom hook output captured

## Examples

- `hooks simulate-prompt {"hook_event_name":"UserPromptSubmit","prompt":"token=sk_test_123456789abcdef"}`
- `hooks simulate-tool {"hook_event_name":"PreToolUse","tool_name":"bash","tool_input":"rm -rf ../outside"}`
- `hooks custom-create {"id":"review_note","name":"Review note","enabled":true,"source":"workspace","matcher":{"event":"PostToolUse"},"handler":{"type":"prompt","output":{"decision":"observe","reason":"reviewed"}},"powers":["observe"]}`
- `hooks trust-review review_note`
- `hooks trust-approve review_note --confirm`
