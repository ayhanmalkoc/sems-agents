# Studio Tools

Use the native Studio tool to manage Craft Studio projects and outputs. Do not run `studio ...` in Bash, PowerShell, or any shell.

The visible native tool name depends on the backend: Claude-style sessions expose `studio`; Pi/MCP proxy sessions expose `mcp__session__studio`. Use whichever native tool is visible in the current session.

Studio is chat-first and project-aware: the agent creates/refines design projects during the current session. Prefer canonical Studio outputs: use the native `studio` tool for templates, create, update, add pages/components, quality, export, and adoption.

For normal chat requests like landing pages, product prototypes, dashboards, decks, reports, documents, image prompt boards, motion briefs, critiques, or video storyboards, use Studio as the primary path. Raw `Write` + `html-preview` is loose output only and should be adopted before treating it as Studio work.

## Native calls

```ts
studio({ command: "status" })
studio({ command: "templates" })
studio({ command: "template landing-saas" })
studio({ command: "design-systems" })
studio({ command: "design-system saas-modern" })
studio({ command: "list" })
studio({ command: "show <outputId>" })
studio({ command: "create {\"title\":\"Landing page\",\"type\":\"landing-page\",\"template\":\"landing-saas\",\"sourcePrompt\":\"Create a landing page\"}" })
studio({ command: "create-project {\"title\":\"Product site\",\"type\":\"landing-page\",\"template\":\"landing-agent\",\"kind\":\"single-page\"}" })
studio({ command: "update <outputId> {\"title\":\"Updated title\",\"html\":\"<!doctype html>...\"}" })
studio({ command: "add-page <outputId> {\"title\":\"Pricing\"}" })
studio({ command: "add-component <outputId> {\"title\":\"Pricing section\",\"preset\":\"pricing\"}" })
studio({ command: "quality <outputId>" })
studio({ command: "export <outputId> zip" })
studio({ command: "export <outputId> pdf" })
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

Builtin templates live beside builtin Studio skills, not in Resources. The library includes the normalized Open Design design-template set plus image/video prompt-template libraries; run `studio templates` for the full current list before selecting.

- Prototype/landing: SaaS, agent, mobile app, web app, pricing, waitlist, docs, contact, web prototypes, mobile onboarding, app flows.
- Dashboard: analytics, admin, finance, support, AI ops, CRM, GitHub, live, social, trading, FlowAI-style operations dashboards.
- Deck: pitch, product, case study, investor update, design review, sales, roadmap, board update, HTML-PPT taste/style variants.
- Report/document: research, product spec, design system, audit, QA, finance, DCF valuation, clinical case, invoice, meeting notes, OKRs, runbooks.
- Image prompt: brand visuals, product mockups, campaign boards, social packs, posters, carousel, wireframe sketches, and Open Design image prompt presets.
- Video/motion: launch storyboard, product demo, onboarding flow, ads, shortform video, motion frames, sprite animation, audio jingle briefs, and Open Design video prompt presets.
- Critique: critique, tweaks, review/improve workflows.

Current library scale: 270+ templates, 150+ design systems, 46 image prompt templates, and 58 video prompt templates.

Supported output types: `prototype`, `landing-page`, `dashboard`, `deck`, `report`, `document`, `image-prompt`, `video-prompt`, `motion`, `critique`.

## Component presets

- Prototype: `hero`, `features`, `pricing`, `faq`, `testimonial`, `cta-band`, `app-shell`, `feature-grid`, `commerce-card`, `case-study-block`
- Dashboard: `sidebar`, `metric-card`, `chart-panel`, `table-panel`, `filter-bar`, `status-feed`, `insight-card`, `risk-list`, `sparkline-card`
- Deck: `slide-title`, `slide-section`, `slide-comparison`, `slide-metric`, `slide-timeline`, `slide-quote`, `slide-roadmap`
- Report: `executive-summary`, `evidence-table`, `recommendation-card`, `decision-log`
- Image: `prompt-card`, `style-frame`, `variant-grid`
- Video: `storyboard-scene`, `shot-list`, `timeline-beat`

## Rules

- Use Studio skills for product/design judgment.
- Use `studio templates` before choosing a template when the user asks for Studio creation.
- Use `studio design-systems` before writing/refining visual output. Pick the recommended design system unless the user asks for a different style.
- After create/refine, run `studio quality <outputId>` and fix important warnings.
- For Studio create/refine/export, use native `studio` first; direct `Write` HTML is loose output only.
- If an HTML file already exists under session `data/`, adopt it with `studio adopt <absoluteHtmlPath> <json>` before treating it as a Studio output.
- Use the Studio tool only for output lifecycle.
- Never write outside session data.
- Do not store secrets in metadata, README, HTML, or assets.
- Keep exports relative and local-first.
- After create/update/export, report the output id, selected template/design system, quality result, and next preview/export step.
