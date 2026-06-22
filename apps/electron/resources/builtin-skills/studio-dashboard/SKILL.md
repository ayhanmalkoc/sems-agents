---
name: Studio Dashboard
description: Create scanable dashboards, admin panels, analytics pages, and data-heavy product surfaces.
---

# Studio Dashboard

Use this skill when the user asks for dashboard, admin, analytics, tables, metrics, monitoring, or operational UI. Prioritize dense-but-readable layout, states, filters, summaries, and responsive behavior.

## Studio contract

- Use the native `studio` tool for output lifecycle.
- Write Studio outputs under session data only.
- Produce complete previewable HTML.
- Include concise metadata and README context.
- Keep visual decisions product-grade, not placeholder-only.
- Never store secrets in output files or metadata.

## Template library

Templates and components live beside this skill under `templates/` and `components/`. Use `studio templates` to discover canonical ids, then create via native `studio create` or `studio create-project`. Do not copy templates into Resources. Use `studio add-page`, `studio add-component`, and `studio quality` for project lifecycle polish.
