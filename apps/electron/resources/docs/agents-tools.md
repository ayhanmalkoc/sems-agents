# Agents Tools

Use `agents` to manage workspace agent profiles.

> **Quick start:** Read this guide before calling `agents`, then run `agents({ command: "status" })` to inspect the current workspace agents.

## Purpose

`agents` manages saved workspace agent profiles: list, inspect, create, update, duplicate, and delete.

Agent profiles are reusable workspace agents. The `Default Agent` is a protected system profile. New and updated profiles should be user profiles.

Templates are starter prompts in the UI; they are not saved agent profiles until the user asks you to create one.

## Commands

- `status` — summarize availability and profile count
- `list` — list all workspace agent profiles
- `show <agentId>` — inspect one profile
- `create <json>` — create one user agent profile
- `update <agentId> <json>` — update one user agent profile
- `duplicate <agentId> <name>` — create a user copy of an existing profile
- `delete <agentId>` — delete one user profile

## JSON fields

Common fields:

- `id` optional lowercase slug; omit it unless the user requested a specific id
- `kind` must be `"user"` for create/update payloads
- `name` display name
- `description` short summary
- `systemPrompt` role instructions
- `model`, `llmConnection`, `thinkingLevel`, `permissionMode`
- `enabledSourceSlugs`, `skillSlugs`
- `delegationMode`, `delegationAllowedAgentIds`
- `icon`, `color`, `visibility`

## Examples

```ts
agents({ command: "status" })
agents({ command: "list" })
agents({ command: "show researcher" })
agents({ command: 'create {"kind":"user","name":"Researcher","description":"Finds and summarizes evidence","systemPrompt":"You are a careful research agent. Verify claims and cite sources."}' })
agents({ command: 'update researcher {"description":"Finds evidence and writes concise summaries"}' })
agents({ command: "duplicate default Research Helper" })
agents({ command: "delete research-helper" })
```

## Expected output

Commands return concise text with profile ids, kind, name, and important fields. Use the returned id for follow-up `show`, `update`, `duplicate`, or `delete` commands.
