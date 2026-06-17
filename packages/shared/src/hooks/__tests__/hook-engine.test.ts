import { describe, expect, it } from 'bun:test'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { HookEngine, HookToolGateway, loadHookRuns, mergeHookDecisions, saveCustomHook, saveHooksPolicy, setHookEnabled, trustApproveCustomHook } from '../index.ts'

function tempWorkspace(): string { return mkdtempSync(join(tmpdir(), 'hooks-test-')) }

describe('builtin hooks runtime', () => {
  it('lists builtin hooks and tracks status', () => {
    const workspace = tempWorkspace()
    const engine = new HookEngine(workspace)
    expect(engine.status().hooks).toBeGreaterThan(0)
    expect(engine.list().some(hook => hook.id === 'secret_scan_prompt')).toBe(true)
  })

  it('blocks prompt and tool input secrets', async () => {
    const workspace = tempWorkspace()
    const engine = new HookEngine(workspace)
    const prompt = await engine.test('secret_scan_prompt', { event: 'UserPromptSubmit', message: 'token=sk_test_123456789abcdef' })
    expect(prompt.type).toBe('block')
    const tool = await engine.test('secret_scan_tool_input', { event: 'PreToolUse', input: { password: 'super-secret-value-12345' } })
    expect(tool.type).toBe('block')
  })

  it('merges decisions by precedence', () => {
    expect(mergeHookDecisions([{ type: 'allow' }, { type: 'ask' }, { type: 'block' }]).type).toBe('block')
    expect(mergeHookDecisions([{ type: 'observe' }, { type: 'redact' }]).type).toBe('redact')
  })

  it('applies policy to workspace boundary and audit redaction', async () => {
    const workspace = tempWorkspace()
    saveHooksPolicy(workspace, { workspaceBoundary: 'block' })
    const engine = new HookEngine(workspace)
    const boundary = await engine.beforeToolUse({ event: 'PreToolUse', toolName: 'bash', toolInput: 'rm -rf ../outside' })
    expect(boundary.type).toBe('block')
    const audit = await engine.afterToolUse({ event: 'PostToolUse', toolName: 'bash', toolResult: 'token=sk_test_123456789abcdef' })
    expect(audit.type).toBe('redact')
  })

  it('skips disabled hooks and records audit runs', async () => {
    const workspace = tempWorkspace()
    setHookEnabled(workspace, 'secret_scan_prompt', false)
    const engine = new HookEngine(workspace)
    const decisions = await engine.emit({ event: 'UserPromptSubmit', message: 'token=sk_test_123456789abcdef' })
    expect(decisions.some(decision => decision.type === 'block')).toBe(false)
    await engine.emit({ event: 'PostToolUse', toolName: 'memory' })
    const runs = loadHookRuns(workspace)
    expect(runs.some(run => run.hookId === 'tool_audit_log')).toBe(true)
  })

  it('runs trusted custom prompt hooks and invalidates trust when config changes', async () => {
    const workspace = tempWorkspace()
    saveCustomHook(workspace, {
      id: 'custom_prompt_guard',
      name: 'Custom prompt guard',
      enabled: true,
      source: 'workspace',
      handler: { type: 'prompt', decision: { type: 'block', message: 'custom blocked' } },
      matcher: { event: 'UserPromptSubmit' },
      powers: ['block'],
      timeoutMs: 1000,
      maxOutputBytes: 1024,
    })
    trustApproveCustomHook(workspace, 'custom_prompt_guard', 'tester')
    const engine = new HookEngine(workspace)
    expect((await engine.beforePromptSubmit({ event: 'UserPromptSubmit', message: 'hello' })).type).toBe('block')

    saveCustomHook(workspace, {
      id: 'custom_prompt_guard',
      name: 'Custom prompt guard changed',
      enabled: true,
      source: 'workspace',
      handler: { type: 'prompt', decision: { type: 'allow', message: 'changed' } },
      matcher: { event: 'UserPromptSubmit' },
      powers: ['block'],
      timeoutMs: 1000,
      maxOutputBytes: 1024,
    })
    expect((await new HookEngine(workspace).beforePromptSubmit({ event: 'UserPromptSubmit', message: 'hello' })).type).toBe('allow')
  })

  it('gateway blocks callbacks and redacts returned output', async () => {
    const workspace = tempWorkspace()
    const gateway = new HookToolGateway(new HookEngine(workspace), async input => `ok token=sk_test_123456789abcdef ${input}`)
    let called = false
    await expect(gateway.run({ event: 'PreToolUse', toolName: 'bash', toolInput: 'password=super-secret-value-12345' }, async () => { called = true; return 'never' })).rejects.toThrow('Hook blocked')
    expect(called).toBe(false)
    const result = await gateway.run({ event: 'PreToolUse', toolName: 'bash', toolInput: 'echo ok' }, async () => 'ok token=sk_test_123456789abcdef')
    expect(result).toContain('[REDACTED]')
    expect(result).not.toContain('sk_test')
  })
})
