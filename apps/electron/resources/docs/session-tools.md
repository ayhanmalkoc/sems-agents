# Session Tools

Session tools let Craft manage chat/session metadata without editing session files directly. Use them for session state work such as renaming, pinning, archiving, labels, status, agent profile switching, and session-to-session messages.

Read this guide before using mutating session management tools.

## Tools

### `list_sessions`
List workspace sessions with optional filters.

```json
{ "limit": 20 }
```

### `get_session_info`
Show metadata for one session. Omit `sessionId` for the current session.

```json
{ "sessionId": "260615-rapid-gold" }
```

### `rename_session`
Rename the current session or a specific session. `name` must be non-empty.

```json
{ "name": "Release QA follow-up" }
```

### `pin_session`
Pin or unpin a session in the workspace list.

```json
{ "sessionId": "260615-rapid-gold", "pinned": true }
```

### `archive_session`
Archive or restore a session.

```json
{ "sessionId": "260615-rapid-gold", "archived": true }
```

### `set_session_agent`
Switch a session to an existing workspace agent profile. Omit `sessionId` for the current session. This updates the session's main and active agent profile together.

```json
{ "agentId": "default" }
```

### `delete_session`
Permanently delete a specific session. This is destructive and requires an explicit `sessionId` plus `confirm: true`. There is no current-session default and no bulk delete.

```json
{ "sessionId": "260615-rapid-gold", "confirm": true }
```

### `set_session_labels`
Replace all labels on a session. Pass an empty array to clear labels.

```json
{ "labels": ["bug", "ui"] }
```

### `set_session_status`
Set the session status.

```json
{ "status": "done" }
```

### `send_agent_message`
Send a message to another session.

```json
{ "sessionId": "260615-rapid-gold", "message": "Please summarize current blockers." }
```

### `spawn_session`
Create a new independent session and send the first prompt.

## Output

Mutating tools return a short confirmation. Read tools return structured session metadata. Errors are explicit for unknown sessions, unknown agents, missing fields, or unavailable callbacks.

## Scope

Session tools manage chat/session metadata and messages. They do not navigate UI panels, control browser/dock surfaces, or run subagent delegation. `delete_session` only deletes one explicit confirmed session.
