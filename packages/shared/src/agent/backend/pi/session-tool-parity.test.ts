import { describe, it, expect } from 'bun:test';
import { SESSION_BACKEND_TOOL_NAMES } from '@craft-agent/session-tools-core';
import { getSessionToolProxyDefs } from '../pi/session-tool-defs.ts';
import { PI_BACKEND_SESSION_TOOL_NAMES } from '../../pi-agent.ts';

describe('Pi backend session tool parity', () => {
  it('implements all backend-mode session tools from core registry', () => {
    const missing = [...SESSION_BACKEND_TOOL_NAMES].filter(
      (toolName) => !PI_BACKEND_SESSION_TOOL_NAMES.has(toolName),
    );

    expect(missing).toEqual([]);
  });

  it('exposes Studio through the Pi MCP proxy surface', () => {
    expect(getSessionToolProxyDefs().some(def => def.name === 'mcp__session__studio')).toBe(true);
  });
});
