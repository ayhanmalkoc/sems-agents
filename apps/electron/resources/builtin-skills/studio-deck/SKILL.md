---
name: Studio Deck
description: Create narrative decks, pitch pages, product briefs, and presentation-style HTML.
---

# Studio Deck

Use this skill when the user asks for a deck, presentation, pitch, brief, or storytelling page. Prioritize clear section rhythm, slide-like framing, strong headlines, visual pacing, and export-friendly HTML.

## Studio contract

- Use the native `studio` tool for output lifecycle.
- Write Studio outputs under session data only.
- Produce complete previewable HTML.
- Include concise metadata and README context.
- Keep visual decisions product-grade, not placeholder-only.
- Never store secrets in output files or metadata.

## Template library

Templates and components live beside this skill under 	emplates/ and components/. Use studio templates to discover canonical ids, then create via native studio create or studio create-project. Do not copy templates into Resources. Use studio add-page, studio add-component, and studio quality for project lifecycle polish.
