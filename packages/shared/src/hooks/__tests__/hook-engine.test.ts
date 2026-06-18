import { describe, expect, it } from 'bun:test'
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { HookEngine, HookToolGateway, hooksConfigPath, hooksDir, loadHookRuns, loadHooksConfig, mergeHookDecisions, saveCustomHook, saveHooksConfig, saveHooksPolicy, setHookEnabled, trustApproveCustomHook } from '../index.ts'

function tempWorkspace(): string { return mkdtempSync(join(tmpdir(), 'hooks-test-')) }

describe('builtin hooks runtime', () => {
  it('lists builtin hooks and tracks status', () => {
    const workspace = tempWorkspace()
    const engine = new HookEngine(workspace)
    expect(engine.status().hooks).toBeGreaterThan(0)
    expect(engine.status().builtins).toBe(engine.list().length)
    expect(engine.status().custom).toBe(0)
    expect(engine.list().some(hook => hook.id === 'secret_scan_prompt')).toBe(true)
  })


  it('migrates legacy builtin hook ids on load and save', () => {
    const workspace = tempWorkspace()
    mkdirSync(hooksDir(workspace), { recursive: true })
    writeFileSync(hooksConfigPath(workspace), JSON.stringify({ version: 1, hooks: [{ id: 'validation_summary_on_turn_stop', enabled: false }] }), 'utf8')
    const config = loadHooksConfig(workspace)
    expect(config.hooks.find(hook => hook.id === 'validation_summary_on_stop')?.enabled).toBe(false)
    expect(config.hooks.some(hook => hook.id === 'validation_summary_on_turn_stop')).toBe(false)
    saveHooksConfig(workspace, config)
    const saved = readFileSync(hooksConfigPath(workspace), 'utf8')
    expect(saved).toContain('validation_summary_on_stop')
    expect(saved).not.toContain('validation_summary_on_turn_stop')
  })


  it('blocks prompt and tool input secrets', async () => {
    const workspace = tempWorkspace()
    const engine = new HookEngine(workspace)
    const prompt = await engine.test('secret_scan_prompt', { event: 'UserPromptSubmit', message: 'token=sk_test_123456789abcdef' })
    expect(prompt.type).toBe('block')
    expect(prompt.message).toContain('prompt')
    expect(prompt.message).not.toContain('tool input')
    const tool = await engine.test('secret_scan_tool_input', { event: 'PreToolUse', input: { password: 'super-secret-value-12345' } })
    expect(tool.type).toBe('block')
  })


  it('reports prompt secret blocks as prompt content in simulations', async () => {
    const workspace = tempWorkspace()
    const output = await new HookEngine(workspace).simulatePrompt({ hook_event_name: 'UserPromptSubmit', prompt: 'token=sk_test_123456789abcdef' })
    expect(output.decision).toBe('block')
    expect(output.reason).toContain('prompt content')
    expect(output.reason).not.toContain('tool input')
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



  it('accepts native snake_case input and returns public hook output', async () => {
    const workspace = tempWorkspace()
    saveCustomHook(workspace, {
      id: 'native_modify',
      name: 'Native modify',
      enabled: true,
      source: 'workspace',
      handler: { type: 'prompt', output: { decision: 'modify', reason: 'normalize', updated_input: { command: 'echo updated' } } },
      matcher: { event: 'PreToolUse', toolName: 'bash' },
      powers: ['modify'],
    })
    trustApproveCustomHook(workspace, 'native_modify', 'tester')
    const engine = new HookEngine(workspace)
    const output = await engine.simulateTool({ hook_event_name: 'PreToolUse', tool_name: 'bash', tool_input: { command: 'echo old' } })
    expect(output.decision).toBe('modify')
    expect(output.updated_input).toEqual({ command: 'echo updated' })
  })

  it('passes canonical hook input to command hook stdin and parses stdout hook output', async () => {
    const workspace = tempWorkspace()
    const script = join(workspace, 'hook-command.js')
    writeFileSync(script, "let data=''; process.stdin.on('data', chunk => data += chunk); process.stdin.on('end', () => { const input = JSON.parse(data); console.log(JSON.stringify({ decision: 'add_context', reason: input.tool_name, additional_context: 'ctx:' + input.tool_input.command })); });\n", 'utf8')
    saveCustomHook(workspace, {
      id: 'command_context',
      name: 'Command context',
      enabled: true,
      source: 'workspace',
      handler: { type: 'command', executable: process.execPath, args: [script] },
      matcher: { event: 'PreToolUse', toolName: 'bash' },
      powers: ['add_context'],
      timeoutMs: 2000,
      maxOutputBytes: 2048,
    })
    trustApproveCustomHook(workspace, 'command_context', 'tester')
    const output = await new HookEngine(workspace).simulateTool({ hook_event_name: 'PreToolUse', tool_name: 'bash', tool_input: { command: 'pwd' } })
    expect(output.decision).toBe('add_context')
    expect(output.additional_context).toBe('ctx:pwd')
  })

  it('records canonical redacted run summaries', async () => {
    const workspace = tempWorkspace()
    const engine = new HookEngine(workspace)
    await engine.afterToolUse({ hook_event_name: 'PostToolUse', tool_name: 'bash', tool_response: 'token=sk_test_123456789abcdef' })
    const run = loadHookRuns(workspace).find(item => item.hookId === 'tool_audit_log')
    expect(run?.inputSummary).toContain('hook_event_name')
    expect(run?.outputSummary).toContain('[REDACTED]')
    expect(run?.outputSummary).not.toContain('sk_test')
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
