import { tool } from '@anthropic-ai/claude-agent-sdk';
import { z } from 'zod';

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
};

export type RightDockToolType = 'browser' | 'files' | 'terminal' | 'inspect' | 'chat';

export interface RightDockTabSnapshot {
  id: string;
  type: RightDockToolType;
  title?: string;
  active?: boolean;
  browserInstanceId?: string | null;
}

export interface RightDockStatusSnapshot {
  available: boolean;
  open: boolean;
  activeTabId?: string | null;
  tabs: RightDockTabSnapshot[];
  reason?: string;
}

export interface RightDockFns {
  status: () => Promise<RightDockStatusSnapshot>;
  open: () => Promise<RightDockStatusSnapshot>;
  close: () => Promise<RightDockStatusSnapshot>;
  tabs: () => Promise<RightDockStatusSnapshot>;
  openTool: (type: RightDockToolType) => Promise<RightDockStatusSnapshot>;
  selectTab: (tabId: string) => Promise<RightDockStatusSnapshot>;
  closeTab: (tabId: string) => Promise<RightDockStatusSnapshot>;
}

const RightDockSchema = z.object({
  command: z.string().describe('Right dock command, e.g. "status", "open", "close", "tabs", "open browser", "open files", "open terminal", "select <tabId>", "close-tab <tabId>".'),
});

function success(text: string): ToolResult {
  return { content: [{ type: 'text', text }] };
}

function failure(text: string): ToolResult {
  return { content: [{ type: 'text', text: `Error: ${text}` }], isError: true };
}

function formatStatus(status: RightDockStatusSnapshot): string {
  const lines = [
    `Right dock: ${status.available ? 'available' : 'unavailable'}`,
    `Open: ${status.open}`,
    `Active tab: ${status.activeTabId ?? 'none'}`,
  ];
  if (status.reason) lines.push(`Reason: ${status.reason}`);
  if (status.tabs.length === 0) {
    lines.push('Tabs: none');
  } else {
    lines.push('Tabs:');
    for (const tab of status.tabs) {
      lines.push(`- ${tab.id} type=${tab.type}${tab.active ? ' active=true' : ''}${tab.title ? ` title=${JSON.stringify(tab.title)}` : ''}${tab.browserInstanceId ? ` browserInstanceId=${tab.browserInstanceId}` : ''}`);
    }
  }
  return lines.join('\n');
}

function parseToolType(value: string | undefined): RightDockToolType | null {
  if (value === 'browser' || value === 'files' || value === 'terminal' || value === 'inspect' || value === 'chat') return value;
  return null;
}

export async function executeRightDockCommand(command: string, fns: RightDockFns): Promise<ToolResult> {
  const parts = command.trim().split(/\s+/).filter(Boolean);
  const verb = parts[0]?.toLowerCase() ?? 'status';
  try {
    if (verb === 'status') return success(formatStatus(await fns.status()));
    if (verb === 'open') {
      if (parts[1]) {
        const toolType = parseToolType(parts[1]);
        if (!toolType) return failure(`Unknown right_dock tool type: ${parts[1]}`);
        return success(formatStatus(await fns.openTool(toolType)));
      }
      return success(formatStatus(await fns.open()));
    }
    if (verb === 'close') return success(formatStatus(await fns.close()));
    if (verb === 'tabs') return success(formatStatus(await fns.tabs()));
    if (verb === 'select') {
      const tabId = parts[1];
      if (!tabId) return failure('select requires a tab id');
      return success(formatStatus(await fns.selectTab(tabId)));
    }
    if (verb === 'close-tab') {
      const tabId = parts[1];
      if (!tabId) return failure('close-tab requires a tab id');
      return success(formatStatus(await fns.closeTab(tabId)));
    }
    return failure(`Unknown right_dock command: ${verb}`);
  } catch (error) {
    return failure(error instanceof Error ? error.message : String(error));
  }
}

export function createRightDockTool(options: { getRightDockFns: () => RightDockFns | undefined }) {
  return tool('right_dock', 'Control the visible right workspace dock: open/close it, list tabs, open/select/close dock tool tabs.', RightDockSchema.shape, async (args) => {
    const fns = options.getRightDockFns();
    if (!fns) return failure('Right dock controls are not available. This tool requires the desktop app.');
    return executeRightDockCommand(String(args.command ?? 'status'), fns);
  });
}
