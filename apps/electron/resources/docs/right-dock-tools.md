# Right Dock Tools

Use `right_dock` to control the visible right workspace dock and its dock tool tabs.

> **Quick start:** Use `right_dock({ command: "status" })` to inspect the dock before changing it.

## Core workflow

Recommended flow:
1. `status` — check whether the right dock is available and open.
2. `open` — open the right dock when needed.
3. `tabs` — list current dock tool tabs and the active tab.
4. `open <tool>` — open a dock tool tab.
5. `select <tabId>` — switch to an existing dock tool tab.
6. `close-tab <tabId>` — close a dock tool tab.
7. `close` — close the right dock.

Dock tool tabs are right-side workspace tools such as Browser, Files, Terminal, Inspect, and Chat.

---

## Commands

```text
right_dock({ command: "status" })
right_dock({ command: "open" })
right_dock({ command: "close" })
right_dock({ command: "tabs" })
right_dock({ command: "open browser" })
right_dock({ command: "open files" })
right_dock({ command: "open terminal" })
right_dock({ command: "open inspect" })
right_dock({ command: "open chat" })
right_dock({ command: "select <tabId>" })
right_dock({ command: "close-tab <tabId>" })
```

---

## Output

All commands return a status snapshot:

```text
Right dock: available
Open: true
Active tab: terminal-abc12
Tabs:
- terminal-abc12 type=terminal active=true title="Terminal"
- files-def34 type=files title="Files"
```

Fields:
- `Right dock`: whether the desktop right dock is available.
- `Open`: whether the dock is currently visible.
- `Active tab`: selected dock tab id, or `none`.
- `Tabs`: current dock tool tabs with type, active state, optional title, and optional browser instance id.
