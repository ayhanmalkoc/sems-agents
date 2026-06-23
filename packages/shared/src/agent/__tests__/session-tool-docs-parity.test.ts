import { describe, expect, it } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { getSessionToolRegistry } from '@craft-agent/session-tools-core';

const DOC_TOOL_NAMES = ['studio', 'hooks', 'memory', 'resources', 'agents', 'automations', 'sessions'] as const;

const DOC_FILE_BY_TOOL: Partial<Record<(typeof DOC_TOOL_NAMES)[number], string>> = {
  sessions: 'session-tools.md',
};

describe('session tool docs parity', () => {
  it('keeps documented backend surfaces in the core session tool registry', () => {
    const registry = getSessionToolRegistry();
    for (const toolName of DOC_TOOL_NAMES) {
      const docPath = join(process.cwd(), 'apps', 'electron', 'resources', 'docs', DOC_FILE_BY_TOOL[toolName] ?? `${toolName}-tools.md`);
      expect(existsSync(docPath)).toBe(true);
      expect(registry.has(toolName)).toBe(true);
    }
  });
});
