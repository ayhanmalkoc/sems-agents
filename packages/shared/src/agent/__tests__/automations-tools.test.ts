import { beforeEach, describe, expect, it } from 'bun:test'
import { createAutomationsTool, executeAutomationsCommand, type AutomationToolItem, type AutomationsFns, type AutomationsStatusSnapshot } from '../automations-tools'

function automation(overrides: Partial<AutomationToolItem> = {}): AutomationToolItem {
  return {
    id: 'daily-summary',
    event: 'SchedulerTick',
    matcherIndex: 0,
    enabled: true,
    name: 'Daily summary',
    cron: '0 9 * * *',
    actions: [{ type: 'prompt', prompt: 'Summarize yesterday.' }],
    ...overrides,
  }
}

function status(overrides: Partial<AutomationsStatusSnapshot> = {}): AutomationsStatusSnapshot {
  return {
    available: true,
    automations: [automation()],
    ...overrides,
  }
}

function createMockFns(): AutomationsFns & { calls: string[] } {
  const calls: string[] = []
  const items = new Map<string, AutomationToolItem>(status().automations.map((item) => [item.id, item]))
  return {
    calls,
    status: async () => { calls.push('status'); return { available: true, automations: [...items.values()] } },
    list: async () => { calls.push('list'); return [...items.values()] },
    show: async (automationId) => { calls.push(`show:${automationId}`); return items.get(automationId) },
    create: async (input) => {
      calls.push(`create:${input.name}`)
      const id = String(input.id ?? input.name ?? 'automation').toLowerCase().replace(/[^a-z0-9]+/g, '-')
      const next = automation({ ...input, id, event: input.event, matcherIndex: items.size, enabled: input.enabled !== false })
      items.set(next.id, next)
      return next
    },
    update: async (automationId, updates) => {
      calls.push(`update:${automationId}`)
      const existing = items.get(automationId)
      if (!existing) throw new Error(`Automation "${automationId}" not found`)
      const next = { ...existing, ...updates, id: automationId }
      items.set(automationId, next)
      return next
    },
    duplicate: async (automationId, name) => {
      calls.push(`duplicate:${automationId}:${name}`)
      const existing = items.get(automationId)
      if (!existing) throw new Error(`Automation "${automationId}" not found`)
      const id = name.toLowerCase().replace(/[^a-z0-9]+/g, '-')
      const next = automation({ ...existing, id, name, matcherIndex: items.size })
      items.set(next.id, next)
      return next
    },
    delete: async (automationId) => { calls.push(`delete:${automationId}`); items.delete(automationId) },
    setEnabled: async (automationId, enabled) => {
      calls.push(`setEnabled:${automationId}:${enabled}`)
      const existing = items.get(automationId)
      if (!existing) throw new Error(`Automation "${automationId}" not found`)
      const next = { ...existing, enabled }
      items.set(automationId, next)
      return next
    },
    test: async (automationId) => { calls.push(`test:${automationId}`); return { actions: [{ type: 'prompt', success: true, duration: 1 }] } },
    history: async (automationId) => { calls.push(`history:${automationId}`); return [{ id: automationId, ts: 123, ok: true }] },
    replay: async (automationId, runId) => { calls.push(`replay:${automationId}:${runId ?? ''}`); return { ok: true } },
  }
}

async function executeTool(tool: any, command: string) {
  return tool.handler({ command })
}

describe('automations tool', () => {
  let fns: ReturnType<typeof createMockFns>

  beforeEach(() => {
    fns = createMockFns()
  })

  it('formats status and list', async () => {
    const statusResult = await executeAutomationsCommand('status', fns)
    expect(statusResult.content[0].text).toContain('Automations: available')
    expect(statusResult.content[0].text).toContain('Count: 1')

    const listResult = await executeAutomationsCommand('list', fns)
    expect(listResult.content[0].text).toContain('daily-summary event=SchedulerTick enabled=true')
  })

  it('shows one automation', async () => {
    const result = await executeAutomationsCommand('show daily-summary', fns)
    expect(result.content[0].text).toContain('name="Daily summary"')
    expect(fns.calls).toEqual(['show:daily-summary'])
  })

  it('creates and updates automations with JSON payloads', async () => {
    const created = await executeAutomationsCommand('create {"event":"LabelAdd","name":"Urgent label","matcher":"urgent","actions":[{"type":"prompt","prompt":"Handle urgent label."}]}', fns)
    expect(created.content[0].text).toContain('Created automation urgent-label')

    const updated = await executeAutomationsCommand('update urgent-label {"name":"Urgent label v2"}', fns)
    expect(updated.content[0].text).toContain('Updated automation urgent-label')
    expect(updated.content[0].text).toContain('Urgent label v2')
  })

  it('duplicates, toggles, tests, histories, replays, and deletes', async () => {
    expect((await executeAutomationsCommand('duplicate daily-summary Daily Copy', fns)).content[0].text).toContain('Duplicated automation daily-summary as daily-copy')
    expect((await executeAutomationsCommand('disable daily-copy', fns)).content[0].text).toContain('Disabled automation daily-copy')
    expect((await executeAutomationsCommand('enable daily-copy', fns)).content[0].text).toContain('Enabled automation daily-copy')
    expect((await executeAutomationsCommand('test daily-copy', fns)).content[0].text).toContain('actions=1 failed=0')
    expect((await executeAutomationsCommand('history daily-copy', fns)).content[0].text).toContain('ok=true')
    expect((await executeAutomationsCommand('replay daily-copy run-1', fns)).content[0].text).toContain('run=run-1')
    expect((await executeAutomationsCommand('delete daily-copy', fns)).content[0].text).toContain('Deleted automation daily-copy')
  })

  it('returns actionable parser errors', async () => {
    expect((await executeAutomationsCommand('show', fns)).content[0].text).toContain('show requires an automation id')
    expect((await executeAutomationsCommand('create', fns)).content[0].text).toContain('create requires a JSON payload')
    expect((await executeAutomationsCommand('create {bad', fns)).content[0].text).toContain('Invalid JSON payload')
    expect((await executeAutomationsCommand('update daily-summary', fns)).content[0].text).toContain('update requires a JSON payload')
    expect((await executeAutomationsCommand('duplicate daily-summary', fns)).content[0].text).toContain('duplicate requires a new name')
    expect((await executeAutomationsCommand('delete', fns)).content[0].text).toContain('delete requires an automation id')
    expect((await executeAutomationsCommand('wat', fns)).content[0].text).toContain('Unknown automations command: wat')
  })

  it('wraps callback errors', async () => {
    fns.show = async () => { throw new Error('boom') }
    const result = await executeAutomationsCommand('show daily-summary', fns)
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('boom')
  })

  it('creates automations SDK tool', async () => {
    const tool = createAutomationsTool({ getAutomationsFns: () => fns }) as any
    expect(tool.name).toBe('automations')
    const result = await executeTool(tool, 'status')
    expect(result.content[0].text).toContain('Automations: available')
  })

  it('reports unavailable callbacks', async () => {
    const tool = createAutomationsTool({ getAutomationsFns: () => undefined }) as any
    const result = await executeTool(tool, 'status')
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('requires the desktop app')
  })
})
