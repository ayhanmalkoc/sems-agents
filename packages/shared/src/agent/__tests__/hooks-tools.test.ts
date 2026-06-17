import { describe, expect, it } from 'bun:test'
import { executeHooksCommand, type HooksFns } from '../hooks-tools.ts'
import type { BuiltinHookDefinition, CustomHookDefinition, CustomHookTrustRecord, HookRunRecord, HooksPolicy } from '../../hooks/index.ts'

const hook: BuiltinHookDefinition & { enabled: boolean } = { id: 'secret_scan_prompt', name: 'Secret scan prompt', description: 'Blocks secrets.', event: 'UserPromptSubmit', mode: 'enforce', source: 'builtin', scope: 'workspace', order: 1, enabled: true }
const policy: HooksPolicy = { secretGuard: 'standard', workspaceBoundary: 'ask', prerequisiteGuard: 'enforce', toolAudit: 'on', memoryLearn: 'auto', customHooks: 'trusted-only', customDefaultPower: 'observe', customMaxDurationMs: 2000, customMaxOutputBytes: 4096 }
const run: HookRunRecord = { id: 'run-1', hookId: hook.id, event: hook.event, decision: 'block', message: 'blocked', durationMs: 1, ok: true, createdAt: '2026-06-17T00:00:00.000Z' }
const customHook: CustomHookDefinition = { id: 'custom-1', name: 'Custom one', enabled: true, source: 'workspace', matcher: { event: 'PreToolUse' }, handler: { type: 'prompt', decision: { type: 'observe', message: 'ok' } }, powers: ['observe'] }
const trust: CustomHookTrustRecord = { hookId: 'custom-1', hash: 'abc', trusted: false, reason: 'Trust review required.' }
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
    policy: async () => policy,
    setPolicy: async updates => ({ ...policy, ...updates }),
    simulateTool: async () => ({ type: 'block', message: 'blocked tool' }),
    simulatePrompt: async () => ({ type: 'block', message: 'blocked prompt' }),
    customList: async () => [customHook],
    customShow: async id => id === customHook.id ? customHook : undefined,
    customCreate: async hook => hook as CustomHookDefinition,
    customUpdate: async (_id, hook) => ({ ...customHook, ...hook }),
    customDelete: async () => {},
    trustReview: async () => trust,
    trustApprove: async () => ({ ...trust, trusted: true }),
    trustRevoke: async () => ({ ...trust, trusted: false, reason: 'Trust revoked.' }),
    matcherSet: async (_id, matcher) => ({ ...customHook, matcher }),
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

  it('handles policy and simulations', async () => {
    expect((await executeHooksCommand('policy', fns())).content[0].text).toContain('secretGuard=standard')
    expect((await executeHooksCommand('set-policy {"workspaceBoundary":"block"}', fns())).content[0].text).toContain('workspaceBoundary=block')
    expect((await executeHooksCommand('simulate-tool {"toolName":"memory"}', fns())).content[0].text).toContain('blocked tool')
    expect((await executeHooksCommand('simulate-prompt {"message":"token=abc123456789000"}', fns())).content[0].text).toContain('blocked prompt')
  })

  it('handles custom hook and trust commands', async () => {
    expect((await executeHooksCommand('custom-list', fns())).content[0].text).toContain('custom-1')
    expect((await executeHooksCommand('custom-show custom-1', fns())).content[0].text).toContain('workspace')
    expect((await executeHooksCommand('custom-create {"id":"custom-2","name":"Two","enabled":true,"source":"workspace","matcher":{"event":"PreToolUse"},"handler":{"type":"prompt","decision":{"type":"observe"}},"powers":["observe"]}', fns())).content[0].text).toContain('Created custom hook custom-2')
    expect((await executeHooksCommand('trust-review custom-1', fns())).content[0].text).toContain('trusted=false')
    expect((await executeHooksCommand('trust-approve custom-1 --confirm', fns())).content[0].text).toContain('trusted=true')
    expect((await executeHooksCommand('matcher-set custom-1 {"event":"PostToolUse"}', fns())).content[0].text).toContain('PostToolUse')
  })
})
