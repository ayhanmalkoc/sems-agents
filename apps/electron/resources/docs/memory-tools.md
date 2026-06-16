# Memory Tools

Use the `memory` tool to manage persistent, scoped Craft memory. Product rule: **the agent remembers; the user stays in control**.

## Product Policy

Memory is agent-managed with user oversight.

- If the user explicitly says "remember this", "bunu hatırla", or clearly asks you to persist a durable fact, use `memory create <json>` directly.
- If you infer a possible learning from a session, use `memory suggest-from-session <sessionId>` so it stays pending until reviewed.
- Craft may also auto-suggest pending memory candidates after completed sessions when `autoSuggestMemories` is enabled. Auto-suggest never creates approved memory.
- If the information is uncertain, noisy, temporary, or only maybe reusable, create a suggestion instead of approved memory.
- If content includes secrets or credentials, reject it. Never store API keys, tokens, passwords, bearer secrets, private keys, or one-time codes.
- Do not write memory silently. Use memory only when the user asks, or when a reviewable candidate is approved.

## Commands

- `memory status` — show availability and counts.
- `memory list` — list approved memories.
- `memory show <memoryId>` — inspect one memory.
- `memory search <query>` — find approved memories by text.
- `memory create <json>` — create an approved memory for explicit user requests.
- `memory update <memoryId> <json>` — update one approved memory.
- `memory delete <memoryId>` — delete one approved memory.
- `memory suggest-from-session <sessionId>` — create up to 3 pending candidates from strong session signals.
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

V2 is workspace-first. Use `workspace`, `agent_profile`, or `session` unless the user explicitly asks for global user memory.

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

## Suggestions

Use suggestions when you think something may be worth remembering but the user has not explicitly approved it.

- `suggest-from-session` and auto-suggest look for strong decision, preference, workflow, or error-resolution signals.
- It returns `No strong memory candidates found` when the session has no durable signal.
- Pending candidates are not curated memory.
- `approve` promotes a suggestion to memory with a fresh `mem-*` id.
- `reject` keeps the audit trail but does not create memory.

## Working Memory Design

Working memory is a future lightweight layer for short-lived session/day notes. It must stay separate from curated memory.

- Storage target: workspace-local `memory/working-notes.json` or per-session note files.
- Scope: session/day, not durable project knowledge.
- Lifecycle: expires or rolls up into suggestions; never auto-promotes to curated memory.
- V2 behavior: auto-suggest may write pending suggestions only; no curated auto-write, no prompt auto-injection, no vector provider.

## Safety

- Do not store secrets, credentials, tokens, private keys, or one-time codes.
- Keep memory compact and reusable.
- Prefer decisions, preferences, workflows, and error resolutions over raw chat dumps.
- If uncertain, create a suggestion instead of approved memory.
