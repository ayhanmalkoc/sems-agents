# Resources Tools

Use `resources` to manage the workspace resource registry: sources, skills, source tools, and resource bundles.

Use `resources` when the user asks which external sources or skills are configured, connected, testable, importable, or exportable. Media-capable sources can appear here as sources; actual image/audio/embedding generation is handled by the native Media Generation tool.

> **Quick start:** Read this guide before calling `resources`, then run `resources({ command: "status" })` to inspect current workspace resources.

## Purpose

`resources` is the workspace resource registry tool. It lists and inspects sources/skills, creates and deletes sources, deletes skills, tests sources, lists MCP tools for a source, and imports/exports resource bundles.

Use the existing focused helper tools for validation and auth:

- `config_validate` for source/config validation
- `skill_validate` for `SKILL.md` validation
- `source_test` for full source validation and activation
- `source_oauth_trigger` for OAuth authentication

## Commands

- `status` — summarize resource availability and counts
- `list` — list sources and skills
- `list sources` — list workspace sources
- `list skills` — list workspace skills
- `show source <slug>` — inspect one source
- `show skill <slug>` — inspect one skill
- `create-source <json>` — create one source using the current source schema
- `delete-source <slug>` — delete one source
- `delete-skill <slug>` — delete one skill
- `test-source <slug>` — show current source test/connection status
- `list-tools <sourceSlug>` — list MCP tools exposed by one source
- `export` — export workspace sources and skills to a bundle file
- `import <bundlePath>` — import a resource bundle with skip-on-conflict behavior

## Source JSON shape

`create-source` accepts the existing `CreateSourceInput` shape:

- `name`: display name
- `provider`: provider id/name, e.g. `custom`
- `type`: `mcp`, `api`, or `local`
- `enabled`: optional boolean
- `mcp`: MCP config for MCP sources
- `api`: API config for API sources
- `local`: local source config
- `icon`: optional emoji or URL

## Examples

```ts
resources({ command: "status" })
resources({ command: "list" })
resources({ command: "list sources" })
resources({ command: "list skills" })
resources({ command: "show source github" })
resources({ command: "show skill code-review" })
resources({ command: 'create-source {"name":"Local MCP","provider":"custom","type":"mcp","enabled":false,"mcp":{"transport":"stdio","command":"node","args":["server.js"]}}' })
resources({ command: "test-source github" })
resources({ command: "list-tools github" })
resources({ command: "export" })
resources({ command: "import C:\\path\\to\\resources-export.json" })
resources({ command: "delete-source local-mcp" })
```

## Scope

`resources` manages saved workspace resources. It does not store secrets, start OAuth, execute source MCP/API tools, navigate UI panels, or manage agents, automations, browser, or sessions.

Commands return concise text with slugs, type, enabled state, connection status, counts, and bundle paths. Use returned slugs for follow-up commands.
