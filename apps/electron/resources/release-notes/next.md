# Pending Release Notes

This file accumulates release notes for the next unreleased version. PRs that add user-visible behavior should append a bullet to the relevant section here. Versioned files (`X.Y.Z.md`) are owned by the release skill — never create them in feature commits.

## Features

## Improvements

- **Right dock full focus** — Added an expand/restore control that hides the main content and gives the right dock the remaining workspace while preserving normal dock width on restore.

- **Browser tool default guidance** — Clarified that normal browser use should open a visible browser window first, with dock and background modes reserved for explicit requests.

- **Browser dock mode guidance** — Clarified `browser_tool open --dock` as the agent path for right dock browsing and exposed dock metadata in browser/right dock status output.

- **Right dock tool guide** — Added the agent-facing Right Dock Tools guide, prompt reference, and prerequisite checks so agents read the dock orchestration docs before using `right_dock`.

## Bug Fixes

- **Dock browser close visibility** — Hide the native dock browser view when the right dock panel closes so browser content no longer remains over the workspace.

## Breaking Changes

- **Hooks V3 runtime** — Adds trusted custom hooks, trust review, extended policy controls, and run-detail explainability while keeping hooks workspace-local and redacted by default.
