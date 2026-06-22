# Studio Tools

Use the native `studio` tool to manage Craft Studio projects and outputs. Do not run `studio ...` in Bash, PowerShell, or any shell.

Studio is chat-first and project-aware: the agent creates/refines design projects during the current session. Prefer canonical Studio outputs: use the native `studio` tool for templates, create, update, add pages/components, quality, export, and adoption.

## Native calls

```ts
studio({ command: "status" })
studio({ command: "templates" })
studio({ command: "template landing-saas" })
studio({ command: "list" })
studio({ command: "show <outputId>" })
studio({ command: "create {\"title\":\"Landing page\",\"type\":\"landing-page\",\"template\":\"landing-saas\",\"sourcePrompt\":\"Create a landing page\"}" })
studio({ command: "create-project {\"title\":\"Product site\",\"type\":\"landing-page\",\"template\":\"landing-agent\",\"kind\":\"single-page\"}" })
studio({ command: "update <outputId> {\"title\":\"Updated title\",\"html\":\"<!doctype html>...\"}" })
studio({ command: "add-page <outputId> {\"title\":\"Pricing\"}" })
studio({ command: "add-component <outputId> {\"title\":\"Pricing section\",\"preset\":\"pricing\"}" })
studio({ command: "quality <outputId>" })
studio({ command: "export <outputId> zip" })
studio({ command: "adopt C:\\absolute\\session\\data\\preview.html {\"title\":\"Landing page\",\"type\":\"landing-page\",\"skill\":\"studio-prototype\"}" })
```

## Output convention

Each project lives under the current session data directory:

```text
sessions/{sessionId}/data/studio/{outputId}/metadata.json
sessions/{sessionId}/data/studio/{outputId}/index.html
sessions/{sessionId}/data/studio/{outputId}/README.md
sessions/{sessionId}/data/studio/{outputId}/pages/
sessions/{sessionId}/data/studio/{outputId}/components/
sessions/{sessionId}/data/studio/{outputId}/assets/
sessions/{sessionId}/data/studio/{outputId}/exports/
```

## Templates

Builtin templates live beside builtin Studio skills, not in Resources:

- `landing-saas`
- `landing-agent`
- `dashboard-analytics`
- `dashboard-admin`
- `deck-pitch`
- `deck-product`

## Component presets

- Prototype: `hero`, `features`, `pricing`, `faq`
- Dashboard: `sidebar`, `metric-card`, `chart-panel`, `table-panel`
- Deck: `slide-title`, `slide-section`, `slide-comparison`

## Rules

- Use Studio skills for product/design judgment.
- Use `studio templates` before choosing a template when the user asks for Studio creation.
- For Studio create/refine/export, use native `studio` first; direct `Write` HTML is loose output only.
- If an HTML file already exists under session `data/`, adopt it with `studio adopt <absoluteHtmlPath> <json>` before treating it as a Studio output.
- Use the Studio tool only for output lifecycle.
- Never write outside session data.
- Do not store secrets in metadata, README, HTML, or assets.
- Keep exports relative and local-first.
- After create/update/export, report the output id and next preview/export step.