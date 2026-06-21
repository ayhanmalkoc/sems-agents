# Studio Tools

Use the native `studio` tool to manage Craft Studio outputs. Do not run `studio ...` in Bash, PowerShell, or any shell.

Studio is chat-first: the agent creates/refines design outputs during the current session. The Studio page lists and previews those file-backed outputs.

## Native calls

```ts
studio({ command: "status" })
studio({ command: "list" })
studio({ command: "show <outputId>" })
studio({ command: "create {\"title\":\"Landing page\",\"type\":\"landing-page\",\"skill\":\"studio-prototype\",\"sourcePrompt\":\"Create a landing page\",\"html\":\"<!doctype html>...\"}" })
studio({ command: "update <outputId> {\"title\":\"Updated title\",\"html\":\"<!doctype html>...\"}" })
studio({ command: "export <outputId> zip" })
```

## Output convention

Each output lives under the current session data directory:

```text
sessions/{sessionId}/data/studio/{outputId}/metadata.json
sessions/{sessionId}/data/studio/{outputId}/index.html
sessions/{sessionId}/data/studio/{outputId}/README.md
sessions/{sessionId}/data/studio/{outputId}/assets/
sessions/{sessionId}/data/studio/{outputId}/exports/
```

## Metadata v1

```json
{
  "schema": "craft-studio-output/v1",
  "id": "landing-page",
  "title": "Landing page",
  "type": "landing-page",
  "entryFile": "index.html",
  "skill": "studio-prototype",
  "status": "ready",
  "sourcePrompt": "Create a landing page",
  "createdAt": "2026-06-21T00:00:00.000Z",
  "updatedAt": "2026-06-21T00:00:00.000Z",
  "designSystem": { "source": "workspace", "name": "Craft" },
  "exports": [],
  "sessionId": "session-id"
}
```

## Builtin Studio skill guides

These are built-in product guidance modes, not separate runtimes:

- `studio-prototype` - landing pages, prototypes, app screens, interactive HTML mockups.
- `studio-dashboard` - dashboards, admin views, analytics and data-heavy surfaces.
- `studio-deck` - narrative slide decks, pitch pages, product briefs, presentation-style HTML.

## Types

Allowed `type` values:

- `prototype`
- `landing-page`
- `dashboard`
- `deck`
- `report`
- `image-prompt`
- `video-prompt`

Allowed export formats:

- `html`
- `zip`
- `pdf`

PDF export depends on renderer-backed print support. If unavailable, report the failure and offer `html` or `zip`.

## Rules

- Use Studio skills for product/design judgment.
- Use the Studio tool only for output lifecycle.
- Never write outside session data.
- Do not store secrets in metadata, README, HTML, or assets.
- Keep exports relative and local-first.
- After create/update/export, report the output id and next preview/export step.
