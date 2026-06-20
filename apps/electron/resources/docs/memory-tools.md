# Memory Tools

Use the `memory` tool to manage persistent, scoped workspace memory. Product rule: **the agent remembers; user control is a mode, not a bottleneck**.

## Product Policy

Memory is agent-managed with user oversight. When a task depends on prior project decisions, user preferences, workflows, or past error fixes, run `memory search <query>` before answering.

- If the user explicitly says "remember this", "bunu hatırla", or clearly asks you to persist a durable fact, use `memory create <json>` directly after checking for duplicates and secrets.
- If learning is inferred from a session, use `memory suggest-from-session <sessionId>` or `memory learn ...`; these commands delegate review to the current-agent Memory Brain curation.
- Automatic memory follows the workspace preference `memoryAutomationMode`:
  - `auto` lets the current-agent Memory Brain save only strong durable completed-session learnings.
  - `review` lets the current-agent Memory Brain queue durable learnings as pending suggestions.
  - `off` skips automatic memory.
- Default is `auto`.
- If the information is uncertain, noisy, temporary, or only maybe reusable, create a suggestion instead of approved memory.
- If content includes secrets or credentials, reject it. Never store API keys, tokens, passwords, bearer secrets, private keys, or one-time codes.
- Do not edit memory JSON files directly. Use the `memory` tool for create, update, review, and hygiene changes.

## Commands

- `memory status` — show availability and counts.
- `memory list` — list approved memories.
- `memory show <memoryId>` — inspect one memory.
- `memory search <query>` — find approved memories by text in decision-support format (`id`, `type`, `confidence`, `status`, content, `sourceSessionId`).
- `memory create <json>` — create an approved memory for explicit user requests.
- `memory update <memoryId> <json>` — update one approved memory.
- `memory delete <memoryId>` — delete one approved memory.
- `memory suggest-from-session <sessionId>` — ask the current-agent Memory Brain to review one session and queue pending suggestions when useful.
- `memory learn <current|recent|all|sessionId>` — run current-agent Memory Brain curation for current, recent, all, or one specific session.
- `memory approve <suggestionId>` — move a pending suggestion into approved memory.
- `memory reject <suggestionId>` — reject a pending suggestion.
- `memory hygiene` — list duplicate/stale/conflict cleanup candidates without mutating records.
- `memory merge <targetId> <sourceId>` — mark the source stale and add it to target `supersedes`.
- `memory mark-stale <memoryId>` — mark one memory stale.
- `memory refresh <memoryId> <json>` — update a memory and mark it active.

## Memory Types

- `user_preference`
- `project_decision`
- `workflow_learning`
- `error_resolution`
- `agent_instruction`
- `skill_candidate`

## Scopes

- `global_user`
- `workspace`
- `agent_profile`
- `session`

Memory is workspace-first. Use `workspace`, `agent_profile`, or `session` unless the user explicitly asks for global user memory.

## Required Fields For Create

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

`sourceSessionId`, `createdBy`, `createdAt`, `scope`, and `type` are required for traceability.

## Manual Learning

Use manual learning when automatic completion learning may have missed something, or when the user asks to revisit session history for memory.

- `memory learn current` learns from the current session.
- `memory learn recent` learns from recent loaded workspace sessions.
- `memory learn all` learns from up to 100 workspace sessions, including sessions loaded from disk.
- `memory learn <sessionId>` learns from one session.
- In `auto` mode, the Memory Brain saves only strong durable learnings as curated memory.
- In `review` mode, the Memory Brain queues durable learnings as pending suggestions.
- In `off` mode, manual learning is still allowed and queues suggestions (`off-as-review`) because it is an explicit user action.
- Duplicate, secret, and low-confidence guards still apply.
- Tool output is a stable summary: `processed`, `created`, `suggested`, `skipped`, `mode`, created ids, suggested ids, and the first skip reasons.

## Suggestions

Use suggestions when you think something may be worth remembering but the user has not explicitly approved it.

- `suggest-from-session` and manual memory curation delegates judgment to the current-agent Memory Brain; regex/keyword extraction is not used.
- It returns `Memory Brain returned no pending suggestions` when no durable suggestion is queued.
- In `review` mode, pending suggestions are not curated memory until approved. In `auto` mode, only strong durable learnings are saved directly.
- `approve` promotes a suggestion to memory with a fresh `mem-*` id.
- `reject` keeps the audit trail but does not create memory.

## Safety

- Do not store secrets, credentials, tokens, private keys, or one-time codes.
- Keep memory compact and reusable.
- Prefer decisions, preferences, workflows, and error resolutions over raw chat dumps.
- If uncertain, create a suggestion instead of approved memory.


## Hygiene

Use `memory hygiene` when memory feels noisy, duplicated, or outdated. It reports cleanup suggestions only. Use `merge` for duplicates, `mark-stale` for old facts, and `refresh` for updated facts. `delete` is still available but should be reserved for clearly unwanted records.

## Retrieval Guidance

Search memory before answering questions about prior decisions, established preferences, known workflows, recurring commands, or past bug fixes. Cite the memory id in your internal reasoning when useful, but keep user-facing answers natural.
