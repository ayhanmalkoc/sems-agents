import { describe, expect, it } from 'bun:test'
import { buildHookGroups, filterHookRuns, getCustomHookTrustStatus } from '../hooks-ui-model.ts'
import type { BuiltinHookDefinition, CustomHookDefinition, CustomHookTrustRecord, HookRunRecord } from '@craft-agent/shared/hooks'

const custom: CustomHookDefinition = {
  id: 'custom-pretool',
  name: 'Custom pretool',
  enabled: false,
  source: 'workspace',
  matcher: { event: 'PreToolUse', toolName: 'bash' },
  handler: { type: 'prompt', output: { decision: 'observe', reason: 'ok' } },
  powers: ['observe'],
  timeoutMs: 1000,
}

function item(overrides: Partial<BuiltinHookDefinition & { enabled: boolean }>): BuiltinHookDefinition & { enabled: boolean } {
  return {
    id: 'secret_scan_tool_input',
    name: 'Secret scan tool input',
    description: 'Blocks secrets.',
    event: 'PreToolUse',
    mode: 'enforce',
    source: 'builtin',
    scope: 'workspace',
    order: 10,
    enabled: true,
    ...overrides,
  }
}

describe('hooks ui model', () => {
  it('groups hooks by Codex-style event labels', () => {
    const groups = buildHookGroups([
      item({ event: 'PreToolUse' }),
      item({ id: 'tool_audit_log', event: 'PostToolUse' }),
      item({ id: 'memory_learn_on_session_complete', event: 'SessionComplete' }),
    ], [])
    expect(groups.map(group => group.title)).toEqual(['Before tool use', 'After tool use', 'Session complete'])
  })

  it('orders OpenAI-style lifecycle events before Craft-specific events', () => {
    const groups = buildHookGroups([
      item({ id: 'permission_request', event: 'PermissionRequest' }),
      item({ id: 'pre_compact', event: 'PreCompact' }),
      item({ id: 'subagent_start', event: 'SubagentStart' }),
      item({ id: 'stop', event: 'Stop' }),
      item({ id: 'file_changed', event: 'FileChanged' }),
    ], [])
    expect(groups.map(group => group.title)).toEqual(['Permission request', 'Before compaction', 'Subagent start', 'Stop', 'File changed'])
  })


  it('marks missing, matching, and changed trust states', () => {
    expect(getCustomHookTrustStatus(custom, undefined)).toBe('Untrusted')
    const trusted: CustomHookTrustRecord = { hookId: custom.id, trusted: true, hash: 'abc' }
    expect(getCustomHookTrustStatus(custom, trusted)).toBe('Trusted')
    const changed: CustomHookTrustRecord = { hookId: custom.id, trusted: false, hash: 'abc', reason: 'Hook configuration changed; trust review required.' }
    expect(getCustomHookTrustStatus(custom, changed)).toBe('Changed')
  })


  it('filters hook runs for recent runs view', () => {
    const runs: HookRunRecord[] = [
      { id: 'old', hookId: 'a', event: 'PreToolUse', decision: 'observe', durationMs: 1, ok: true, createdAt: '2026-06-17T00:00:00.000Z' },
      { id: 'blocked', hookId: 'b', event: 'PreToolUse', decision: 'block', durationMs: 2, ok: true, createdAt: '2026-06-18T00:00:00.000Z' },
      { id: 'error', hookId: 'c', event: 'PostToolUse', decision: 'observe', durationMs: 3, ok: false, error: 'failed', createdAt: '2026-06-18T01:00:00.000Z' },
    ]
    expect(filterHookRuns(runs, 'all').map(run => run.id)).toEqual(['error', 'blocked', 'old'])
    expect(filterHookRuns(runs, 'blocked').map(run => run.id)).toEqual(['blocked'])
    expect(filterHookRuns(runs, 'errors').map(run => run.id)).toEqual(['error'])
  })


  it('adds last run to matching hook rows', () => {
    const run: HookRunRecord = { id: 'run-1', hookId: 'custom-pretool', event: 'PreToolUse', decision: 'observe', durationMs: 2, ok: true, createdAt: '2026-06-17T00:00:00.000Z' }
    const groups = buildHookGroups([], [custom], [], [run])
    expect(groups[0]?.hooks[0]?.lastRun?.id).toBe('run-1')
    expect(groups[0]?.hooks[0]?.matcherSummary).toContain('bash')
  })
})
