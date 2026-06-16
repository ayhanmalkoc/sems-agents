# Memory Tools

Use the `memory` tool to manage persistent, scoped Craft memory.

## Product Rule

Memory is curated. Do not write memory silently. Write only when the user explicitly asks you to remember something, or when a pending suggestion is approved.

## Commands

- `memory status` — show availability and counts.
- `memory list` — list approved memories.
- `memory show <memoryId>` — inspect one memory.
- `memory search <query>` — find approved memories by text.
- `memory create <json>` — create an approved memory.
- `memory update <memoryId> <json>` — update one approved memory.
- `memory delete <memoryId>` — delete one approved memory.
- `memory suggest-from-session <sessionId>` — create a pending candidate from a session.
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

V1 is workspace-first. Use `workspace`, `agent_profile`, or `session` unless the user explicitly asks for global user memory.

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

- `suggest-from-session` creates a pending candidate.
- Pending candidates are not curated memory.
- `approve` promotes a suggestion to memory.
- `reject` keeps the audit trail but does not create memory.

## Safety

- Do not store secrets, credentials, tokens, private keys, or one-time codes.
- Keep memory compact and reusable.
- Prefer decisions, preferences, workflows, and error resolutions over raw chat dumps.
- If uncertain, create a suggestion instead of approved memory.
