import { describe, expect, it } from 'bun:test'
import { executeHooksCommand, type HooksFns } from '../hooks-tools.ts'
import type { BuiltinHookDefinition, HookRunRecord } from '../../hooks/index.ts'

const hook: BuiltinHookDefinition & { enabled: boolean } = { id: 'secret_scan_prompt', name: 'Secret scan prompt', description: 'Blocks secrets.', event: 'UserPromptSubmit', mode: 'enforce', source: 'builtin', scope: 'workspace', order: 1, enabled: true }
const run: HookRunRecord = { id: 'run-1', hookId: hook.id, event: hook.event, decision: 'block', message: 'blocked', durationMs: 1, ok: true, createdAt: '2026-06-17T00:00:00.000Z' }
function fns(): HooksFns {
  return {
    status: async () => ({ available: true, hooks: 1, enabled: 1, runs: 1 }),
    list: async () => [hook],
    show: async id => id === hook.id ? hook : undefined,
    enable: async () => {},
    disable: async () => {},
    runs: async () => [run],
    explain: async id => id === run.id ? run : undefined,
    test: async () => ({ type: 'block', message: 'blocked' }),
  }
}

describe('hooks tool', () => {
  it('handles read and toggle commands', async () => {
    expect((await executeHooksCommand('status', fns())).content[0].text).toContain('Hooks: available')
    expect((await executeHooksCommand('list', fns())).content[0].text).toContain('secret_scan_prompt')
    expect((await executeHooksCommand('show secret_scan_prompt', fns())).content[0].text).toContain('UserPromptSubmit')
    expect((await executeHooksCommand('disable secret_scan_prompt', fns())).content[0].text).toContain('Disabled hook')
  })

  it('handles runs and dry-run test', async () => {
    expect((await executeHooksCommand('runs secret_scan_prompt', fns())).content[0].text).toContain('run-1')
    expect((await executeHooksCommand('explain run-1', fns())).content[0].text).toContain('blocked')
    expect((await executeHooksCommand('test secret_scan_prompt {"event":"UserPromptSubmit"}', fns())).content[0].text).toContain('Decision: block')
  })
})
