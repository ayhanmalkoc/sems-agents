# Memory Tools

Use the native `memory` session tool to manage persistent, scoped workspace memory.

> **Quick start:** Read this guide before calling `memory`, then run `memory({ command: "status" })` to inspect workspace memory. Use `memory({ command: "learn workspace" })` for Refresh Memory.

Do not run these as shell commands. Do not use bash, terminal, `craft-agent`, CLI wrappers, or direct JSON file edits for memory changes.

## Purpose

`memory` is the workspace durable memory tool. It searches, creates, updates, refreshes, deletes, and curates reusable project decisions, user preferences, workflows, and error resolutions.

Memory is agent-managed. When a task depends on prior project decisions, user preferences, workflows, or past error fixes, call `memory({ command: "search <query>" })` before answering.

Product rule: **Memory is either on or off.** When on, the current chat agent manages durable memory with native memory tool calls. When off, memory mutations and learning are blocked; existing memories remain visible in Settings.

## Commands

- `status` — show availability and counts
- `list` — list approved memories
- `show <memoryId>` — inspect one memory
- `search <query>` — find approved memories by text in decision-support format (`id`, `type`, `confidence`, `status`, content, `sourceSessionId`)
- `create <json>` — create one approved memory after duplicate and secret checks
- `update <memoryId> <json>` — update one approved memory
- `delete <memoryId>` — delete one approved memory
- `learn <workspace|current|recent|all|sessionId>` — prepare a current-agent Memory Brain refresh task
- `hygiene` — list duplicate/stale/conflict cleanup candidates without mutating records
- `merge <targetId> <sourceId>` — mark the source stale and add it to target `supersedes`
- `mark-stale <memoryId>` — mark one memory stale
- `refresh <memoryId> <json>` — update a memory and mark it active

## Memory JSON Shape

`create` accepts durable memory records with required trace fields:

```json
{
  "type": "project_decision",
  "scope": "workspace",
  "title": "Short title",
  "content": "Durable fact to remember.",
  "sourceSessionId": "current-session-id",
  "createdBy": "agent",
  "createdAt": "2026-06-16T00:00:00.000Z",
  "tags": ["optional"]
}
```

Allowed `type` values:

- `user_preference`
- `project_decision`
- `workflow_learning`
- `error_resolution`
- `agent_instruction`
- `skill_candidate`

Allowed `scope` values:

- `global_user`
- `workspace`
- `agent_profile`
- `session`

Memory is workspace-first. Use `workspace`, `agent_profile`, or `session` unless the user explicitly asks for global user memory.

## Examples

```ts
memory({ command: "status" })
memory({ command: "list" })
memory({ command: "search routing decision" })
memory({ command: "learn workspace" })
memory({ command: 'create {"type":"project_decision","scope":"workspace","title":"Memory tool pattern","content":"Memory must be called as a native session tool, not through shell.","sourceSessionId":"current-session-id","createdBy":"agent","createdAt":"2026-06-16T00:00:00.000Z","tags":["memory","tools"]}' })
memory({ command: 'update mem-123 {"content":"Updated durable fact.","tags":["memory"]}' })
memory({ command: "hygiene" })
memory({ command: "merge mem-target mem-source" })
memory({ command: "mark-stale mem-123" })
memory({ command: "delete mem-123" })
```

## Refresh Memory

Use Refresh Memory when the user asks to refresh workspace memory or revisit session history.

- `memory({ command: "learn workspace" })` learns incrementally from new or changed workspace sessions. This is the default Refresh Memory path.
- `memory({ command: "learn current" })` learns from the current session only.
- `memory({ command: "learn recent" })` learns from recent loaded workspace sessions.
- `memory({ command: "learn all" })` is a full one-off audit for up to 100 workspace sessions.
- `memory({ command: "learn <sessionId>" })` learns from one session.

`learn` returns bounded Memory Brain instructions. Complete the workflow before final response: search existing memory, then create/update/merge/mark-stale only when durable facts exist.

Tool output is a stable summary: `processed`, `created`, `updated`, `skipped`, `mode`, indexed sessions, created/updated ids, and reasons.

## Scope

`memory` manages durable workspace memory. It does not manage temporary chat context, compacting, hooks, resources, agents, automations, browser state, shell commands, or raw session logs.

Context is temporary current-chat memory. Memory is durable workspace memory.

## Safety

- Do not store secrets, credentials, tokens, private keys, one-time codes, or raw private data.
- Do not edit memory JSON files directly.
- Keep memory compact and reusable.
- Prefer decisions, preferences, workflows, and error resolutions over raw chat dumps.
- If uncertain, ignore it instead of writing memory.
- Search existing memory before creating duplicates.

## Hygiene

Use `memory({ command: "hygiene" })` when memory feels noisy, duplicated, or outdated. It reports cleanup candidates only. Use `merge`, `mark-stale`, `refresh`, `update`, or `delete` deliberately after review.
