# Hooks Tools

Use the `hooks` tool to inspect and manage builtin workspace lifecycle hooks. Hooks are runtime policy/audit orchestration; they do not replace domain tools such as `memory`, `sessions`, `agents`, `automations`, or `resources`.

## Product Policy

- V1 is builtin-only. Custom shell, HTTP, MCP, or user-authored hooks are not supported.
- Hooks run at lifecycle events such as `UserPromptSubmit`, `PreToolUse`, `PostToolUse`, `TurnStop`, and `SessionComplete`.
- Hooks may observe, block, ask, add context, mutate, or redact through existing product domain APIs.
- Hooks do not control UI panels or browser runtime directly.
- Use domain tools for product state changes; use `hooks` for hook toggles, dry-run tests, and audit inspection.

## Commands

- `hooks status` — summarize hook availability, enabled count, and run count.
- `hooks list` — list builtin hooks.
- `hooks show <hookId>` — inspect one builtin hook.
- `hooks enable <hookId>` — enable one builtin hook.
- `hooks disable <hookId>` — disable one builtin hook.
- `hooks runs [hookId]` — show recent hook runs, optionally for one hook.
- `hooks explain <runId>` — inspect one hook run decision.
- `hooks test <hookId> <json>` — dry-run one hook with an event payload.
- `hooks policy` — show workspace hook policy.
- `hooks set-policy <json>` — update workspace hook policy.
- `hooks simulate-tool <json>` — dry-run the `PreToolUse` gateway with structured payload.
- `hooks simulate-prompt <json>` — dry-run the `UserPromptSubmit` gateway with structured payload.

## Builtin Hooks

- `secret_scan_prompt` — blocks prompt content that appears to contain credentials or secrets.
- `secret_scan_tool_input` — blocks tool input that appears to contain credentials or secrets.
- `tool_prerequisite_guard` — mirrors documentation prerequisite enforcement.
- `workspace_boundary_guard` — observes or guards risky workspace boundary operations.
- `tool_audit_log` — records post-tool audit entries.
- `validation_summary_on_turn_stop` — captures validation summary context.
- `memory_learn_on_session_complete` — delegates session-complete memory learning to the memory runtime.
- `automation_run_audit` — records automation run audit context.

## Decision Model

Decision precedence is `block > ask > mutate > addContext > redact > observe > allow`. A `block` decision prevents execution; an `ask` decision must route through permission approval; redaction never stores raw secrets in hook audit.

## Policy

- `secretGuard`: `strict | standard | off`
- `workspaceBoundary`: `block | ask | observe`
- `prerequisiteGuard`: `enforce | observe`
- `toolAudit`: `on | off`
- `memoryLearn`: `auto | review | off`

## Safety

Do not create custom scripts or edit hook JSON files directly. Use `hooks enable`, `hooks disable`, and the Hooks UI.
