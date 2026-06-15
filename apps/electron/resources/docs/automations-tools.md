# Automations Tools

Use `automations` to manage workspace automations.

> **Quick start:** Read this guide before calling `automations`, then run `automations({ command: "status" })` to inspect current workspace automations.

## Purpose

`automations` manages saved workspace automation configs and run surfaces: list, inspect, create, update, duplicate, enable, disable, test, history, and replay.

Automations stay in the existing product model: event matchers with optional conditions and `prompt` or `webhook` actions.

## Commands

- `status` — summarize availability and automation count
- `list` — list workspace automations
- `show <automationId>` — inspect one automation
- `create <json>` — create one automation matcher
- `update <automationId> <json>` — update one automation matcher
- `duplicate <automationId> <name>` — create a named copy
- `delete <automationId>` — delete one automation matcher
- `enable <automationId>` — enable one automation
- `disable <automationId>` — disable one automation
- `test <automationId>` — run configured actions manually
- `history <automationId>` — show recent runs
- `replay <automationId> <runId>` — replay webhook actions for the automation

## JSON shape

Create payloads must include `event` and `actions`.

Common fields:

- `event`: automation event, e.g. `SchedulerTick`, `LabelAdd`, `UserPromptSubmit`
- `name`: display name
- `matcher`: regex matcher for event data
- `cron`: 5-field schedule for `SchedulerTick`
- `timezone`: IANA timezone
- `permissionMode`: prompt session permission mode
- `labels`: labels for prompt sessions
- `conditions`: optional condition tree
- `actions`: `prompt` and/or `webhook` actions

## Examples

```ts
automations({ command: "status" })
automations({ command: "list" })
automations({ command: "show abc123" })
automations({ command: 'create {"event":"SchedulerTick","name":"Daily summary","cron":"0 9 * * *","timezone":"Europe/Istanbul","actions":[{"type":"prompt","prompt":"Summarize yesterday workspace activity."}]}' })
automations({ command: 'update abc123 {"name":"Daily workspace summary"}' })
automations({ command: "duplicate abc123 Daily summary copy" })
automations({ command: "disable abc123" })
automations({ command: "test abc123" })
automations({ command: "history abc123" })
automations({ command: "delete abc123" })
```

## Expected output

Commands return concise text with automation id, event, enabled state, name, matcher/cron, and action summary. Use returned ids for follow-up commands.
