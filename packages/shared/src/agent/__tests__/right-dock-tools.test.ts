import { describe, expect, it, beforeEach } from 'bun:test'
import { createRightDockTool, executeRightDockCommand, type RightDockFns, type RightDockStatusSnapshot } from '../right-dock-tools'

function status(overrides: Partial<RightDockStatusSnapshot> = {}): RightDockStatusSnapshot {
  return {
    available: true,
    open: true,
    activeTabId: 'terminal-1',
    tabs: [
      { id: 'terminal-1', type: 'terminal', title: 'Terminal', active: true },
      { id: 'files-1', type: 'files', title: 'Files' },
    ],
    ...overrides,
  }
}

function createMockFns(): RightDockFns & { calls: string[] } {
  const calls: string[] = []
  return {
    calls,
    status: async () => { calls.push('status'); return status() },
    open: async () => { calls.push('open'); return status({ open: true }) },
    close: async () => { calls.push('close'); return status({ open: false }) },
    tabs: async () => { calls.push('tabs'); return status() },
    openTool: async (type) => { calls.push(`openTool:${type}`); return status({ activeTabId: `${type}-1`, tabs: [{ id: `${type}-1`, type, active: true }] }) },
    selectTab: async (tabId) => { calls.push(`selectTab:${tabId}`); return status({ activeTabId: tabId }) },
    closeTab: async (tabId) => { calls.push(`closeTab:${tabId}`); return status({ tabs: status().tabs.filter((tab) => tab.id !== tabId) }) },
  }
}

async function executeTool(tool: any, command: string) {
  return tool.handler({ command })
}

describe('right_dock tools', () => {
  let fns: ReturnType<typeof createMockFns>

  beforeEach(() => {
    fns = createMockFns()
  })

  it('formats status snapshots', async () => {
    const result = await executeRightDockCommand('status', fns)
    expect(result.isError).toBeUndefined()
    expect(result.content[0].text).toContain('Right dock: available')
    expect(result.content[0].text).toContain('Open: true')
    expect(result.content[0].text).toContain('Active tab: terminal-1')
    expect(result.content[0].text).toContain('terminal-1 type=terminal active=true title="Terminal"')
    expect(fns.calls).toEqual(['status'])
  })

  it('formats browser tab instance ids in status snapshots', async () => {
    fns.status = async () => status({
      activeTabId: 'browser-1',
      tabs: [{ id: 'browser-1', type: 'browser', active: true, title: 'Browser', browserInstanceId: 'browser-instance-1' }],
    })
    const result = await executeRightDockCommand('status', fns)
    expect(result.content[0].text).toContain('browser-1 type=browser active=true title="Browser" browserInstanceId=browser-instance-1')
  })


  it('opens and closes the dock', async () => {
    await executeRightDockCommand('open', fns)
    await executeRightDockCommand('close', fns)
    expect(fns.calls).toEqual(['open', 'close'])
  })

  it('lists tabs', async () => {
    const result = await executeRightDockCommand('tabs', fns)
    expect(result.content[0].text).toContain('Tabs:')
    expect(fns.calls).toEqual(['tabs'])
  })

  it('opens supported dock tool tabs', async () => {
    for (const toolType of ['browser', 'files', 'terminal', 'inspect', 'chat'] as const) {
      const result = await executeRightDockCommand(`open ${toolType}`, fns)
      expect(result.isError).toBeUndefined()
      expect(result.content[0].text).toContain(`Active tab: ${toolType}-1`)
    }
    expect(fns.calls).toEqual(['openTool:browser', 'openTool:files', 'openTool:terminal', 'openTool:inspect', 'openTool:chat'])
  })

  it('selects and closes tabs by id', async () => {
    await executeRightDockCommand('select files-1', fns)
    await executeRightDockCommand('close-tab files-1', fns)
    expect(fns.calls).toEqual(['selectTab:files-1', 'closeTab:files-1'])
  })

  it('returns actionable parser errors', async () => {
    expect((await executeRightDockCommand('select', fns)).content[0].text).toContain('select requires a tab id')
    expect((await executeRightDockCommand('close-tab', fns)).content[0].text).toContain('close-tab requires a tab id')
    expect((await executeRightDockCommand('open unknown', fns)).content[0].text).toContain('Unknown right_dock tool type: unknown')
    expect((await executeRightDockCommand('wat', fns)).content[0].text).toContain('Unknown right_dock command: wat')
  })

  it('wraps callback errors', async () => {
    fns.status = async () => { throw new Error('dock unavailable') }
    const result = await executeRightDockCommand('status', fns)
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('dock unavailable')
  })

  it('creates right_dock SDK tool', async () => {
    const tool = createRightDockTool({ getRightDockFns: () => fns }) as any
    expect(tool.name).toBe('right_dock')
    const result = await executeTool(tool, 'status')
    expect(result.content[0].text).toContain('Right dock: available')
  })

  it('reports unavailable callbacks', async () => {
    const tool = createRightDockTool({ getRightDockFns: () => undefined }) as any
    const result = await executeTool(tool, 'status')
    expect(result.isError).toBe(true)
    expect(result.content[0].text).toContain('requires the desktop app')
  })
})
