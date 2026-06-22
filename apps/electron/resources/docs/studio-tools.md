# Studio Tools

Use the native `studio` tool to manage Craft Studio outputs. Do not run `studio ...` in Bash, PowerShell, or any shell.

Studio is chat-first: the agent creates/refines design outputs during the current session. Prefer canonical Studio outputs: use the native `studio` tool for create, update, export, and adoption. The Studio page lists loose HTML previews too, but loose HTML should be adopted before refine/export.

## Native calls

```ts
studio({ command: "status" })
studio({ command: "list" })
studio({ command: "show <outputId>" })
studio({ command: "create {\"title\":\"Landing page\",\"type\":\"landing-page\",\"skill\":\"studio-prototype\",\"sourcePrompt\":\"Create a landing page\",\"html\":\"<!doctype html>...\"}" })
studio({ command: "update <outputId> {\"title\":\"Updated title\",\"html\":\"<!doctype html>...\"}" })
studio({ command: "export <outputId> zip" })
studio({ command: "adopt C:\\absolute\\session\\data\\preview.html {\"title\":\"Landing page\",\"type\":\"landing-page\",\"skill\":\"studio-prototype\"}" })
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

## Built-in Studio skills

These are real built-in skills synced to `~/.craft-agent/builtin-skills/`. They are not separate runtimes or chat modes:

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

## Rules

- Use Studio skills for product/design judgment.
- For Studio create/refine/export, use native `studio` first; direct `Write` HTML is loose output only.
- If an HTML file already exists under session `data/`, adopt it with `studio adopt <absoluteHtmlPath> <json>` before treating it as a Studio output.
- Use the Studio tool only for output lifecycle.
- Never write outside session data.
- Do not store secrets in metadata, README, HTML, or assets.
- Keep exports relative and local-first.
- After create/update/export, report the output id and next preview/export step.