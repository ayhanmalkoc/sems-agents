import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const read = (path: string) => readFileSync(join(root, path), 'utf8')

describe('memory native tool surface', () => {
  it('documents native memory calls instead of shell commands', () => {
    const docs = read('apps/electron/resources/docs/memory-tools.md')

    expect(docs).toContain('memory({ command: "status" })')
    expect(docs).toContain('memory({ command: "learn workspace" })')
    expect(docs).toContain('Do not run these as shell commands')
    expect(docs).not.toContain('craft-agent memory')
  })

  it('keeps memory popover on native session tool calls', () => {
    const popover = read('apps/electron/src/renderer/components/ui/EditPopover.tsx')

    expect(popover).toContain('native memory session tool')
    expect(popover).toContain('memory({ command: "learn workspace" })')
    expect(popover).toContain('do not use shell')
  })

  it('keeps runtime memory brain instructions off shell and nested learn', () => {
    const manager = read('packages/server-core/src/sessions/SessionManager.ts')

    expect(manager).toContain('memory({ command: \\"search')
    expect(manager).toContain('Do not use shell')
    expect(manager).toContain('Do not call memory learn')
  })
})
