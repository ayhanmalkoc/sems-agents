# Session Tools

Use `sessions` as the canonical tool for chat/session lifecycle and metadata management. Legacy single-purpose session tools remain available for compatibility, but prefer `sessions` for new work.

Read this guide before using `sessions` or any mutating legacy session tool.

## Canonical Tool

### `sessions status`
Show available session capabilities for the current runtime context.

### `sessions list`
List workspace sessions.

### `sessions show <sessionId>`
Show metadata for one session.

### `sessions spawn <json>`
Create a new independent session and send its first prompt.

```text
sessions spawn {"name":"Manual QA Session","prompt":"Say ready."}
```

### `sessions rename <sessionId> <name>`
Rename a session.

### `sessions labels <sessionId> <json-array>`
Replace all labels on a session.

```text
sessions labels 260615-rapid-gold ["qa"]
```

### `sessions status-set <sessionId> <status>`
Set the session status.

### `sessions agent <sessionId> <agentId>`
Switch a session to an existing workspace agent profile.

### `sessions archive <sessionId> <true|false>`
Archive or restore a session.

### `sessions pin <sessionId> <true|false>`
Pin or unpin a session in the workspace list.

### `sessions message <sessionId> <message>`
Send a message to another session.

### `sessions delete <sessionId> --confirm`
Permanently delete one explicit session. There is no current-session default, bulk delete, or undo.

## Scope

Session tools manage chat/session metadata, lifecycle, spawning, and session-to-session messages. They do not navigate UI panels, control browser/dock surfaces, or run subagent delegation.

## Legacy Compatibility Tools

These tools still work for older prompts and automations, but new work should use `sessions`:

- `spawn_session` → use `sessions spawn <json>`
- `list_sessions` → use `sessions list`
- `get_session_info` → use `sessions show <sessionId>`; for current session, omit `sessionId` or pass an empty string if the client requires the field
- `set_session_labels` → use `sessions labels <sessionId> <json-array>`
- `set_session_status` → use `sessions status-set <sessionId> <status>`
- `set_session_agent` → use `sessions agent <sessionId> <agentId>`
- `rename_session` → use `sessions rename <sessionId> <name>`
- `archive_session` → use `sessions archive <sessionId> <true|false>`
- `pin_session` → use `sessions pin <sessionId> <true|false>`
- `delete_session` → use `sessions delete <sessionId> --confirm`
- `send_agent_message` → use `sessions message <sessionId> <message>`
