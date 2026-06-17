# Memory Tools

Use the `memory` tool to manage persistent, scoped workspace memory. Product rule: **the agent remembers; user control is a mode, not a bottleneck**.

## Product Policy

Memory is agent-managed with user oversight. When a task depends on prior project decisions, user preferences, workflows, or past error fixes, run `memory search <query>` before answering.

- If the user explicitly says "remember this", "bunu hatırla", or clearly asks you to persist a durable fact, use `memory create <json>` directly.
- If you infer a possible learning from a session, use `memory suggest-from-session <sessionId>` unless the user explicitly asked to save it.
- Automatic memory follows the workspace preference `memoryAutomationMode`:
  - `auto` saves strong completed-session candidates directly as curated memory.
  - `review` queues strong candidates as pending suggestions.
  - `off` skips automatic memory.
- Default is `auto`. Legacy `autoSuggestMemories: false` maps to `off`.
- If the information is uncertain, noisy, temporary, or only maybe reusable, create a suggestion instead of approved memory.
- If content includes secrets or credentials, reject it. Never store API keys, tokens, passwords, bearer secrets, private keys, or one-time codes.
- Do not edit memory JSON files directly. Use the `memory` tool for create, update, review, hygiene, and working-memory changes.

## Commands

- `memory status` — show availability and counts.
- `memory list` — list approved memories.
- `memory show <memoryId>` — inspect one memory.
- `memory search <query>` — find approved memories by text.
- `memory create <json>` — create an approved memory for explicit user requests.
- `memory update <memoryId> <json>` — update one approved memory.
- `memory delete <memoryId>` — delete one approved memory.
- `memory suggest-from-session <sessionId>` — create up to 3 pending candidates from strong session signals.
- `memory learn <current|recent|all|sessionId>` — manually learn from current, recent, all, or one specific session for strong memory candidates.
- `memory approve <suggestionId>` — move a pending suggestion into approved memory.
- `memory reject <suggestionId>` — reject a pending suggestion.

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
- In `auto` mode, strong learning candidates are saved as curated memory.
- In `review` mode, strong learning candidates become pending suggestions.
- In `off` mode, manual learning is still allowed and queues suggestions (`off-as-review`) because it is an explicit user action.
- Duplicate, secret, and low-confidence guards still apply.

## Suggestions

Use suggestions when you think something may be worth remembering but the user has not explicitly approved it.

- `suggest-from-session` and automatic memory look for strong decision, preference, workflow, or error-resolution signals.
- It returns `No strong memory candidates found` when the session has no durable signal.
- In `review` mode, pending candidates are not curated memory until approved. In `auto` mode, strong candidates are saved directly.
- `approve` promotes a suggestion to memory with a fresh `mem-*` id.
- `reject` keeps the audit trail but does not create memory.

## Working Memory

Working memory is a lightweight layer for short-lived session/day notes. It stays separate from curated memory.

- Storage target: workspace-local `memory/working-notes.json`.
- Scope: session/day, not durable project knowledge.
- Lifecycle: expires or rolls up into suggestions; never auto-promotes to curated memory.
- V3 behavior: auto-suggest may write pending suggestions only; working notes never auto-promote; no curated auto-write, no prompt auto-injection, no vector provider.

## Safety

- Do not store secrets, credentials, tokens, private keys, or one-time codes.
- Keep memory compact and reusable.
- Prefer decisions, preferences, workflows, and error resolutions over raw chat dumps.
- If uncertain, create a suggestion instead of approved memory.


## Hygiene

Use `memory hygiene` when memory feels noisy, duplicated, or outdated. Use `merge` for duplicates and `mark-stale` for old facts. `delete` is still available but should be reserved for clearly unwanted records.

## Retrieval Guidance

Search memory before answering questions about prior decisions, established preferences, known workflows, recurring commands, or past bug fixes. Cite the memory id in your internal reasoning when useful, but keep user-facing answers natural.
