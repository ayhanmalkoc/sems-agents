import { describe, it, expect } from 'bun:test';
import { SESSION_BACKEND_TOOL_NAMES } from '@craft-agent/session-tools-core';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getSessionToolProxyDefs } from '../pi/session-tool-defs.ts';
import { PI_BACKEND_SESSION_TOOL_NAMES } from '../../pi-agent.ts';

describe('Pi backend session tool parity', () => {
  it('implements all backend-mode session tools from core registry', () => {
    const missing = [...SESSION_BACKEND_TOOL_NAMES].filter(
      (toolName) => !PI_BACKEND_SESSION_TOOL_NAMES.has(toolName),
    );

    expect(missing).toEqual([]);
  });

  it('exposes Studio and Media through the Pi MCP proxy surface', () => {
    expect(getSessionToolProxyDefs().some(def => def.name === 'mcp__session__studio')).toBe(true);
    expect(getSessionToolProxyDefs().some(def => def.name === 'mcp__session__media')).toBe(true);
  });

  it('routes Studio and Media through PiAgent backend adapter implementations', () => {
    const source = readFileSync(join(__dirname, '..', '..', 'pi-agent.ts'), 'utf-8');

    expect(source).toContain("if (toolName === 'studio')");
    expect(source).toContain('callbacks?.studioFns');
    expect(source).toContain('executeStudioCommand');
    expect(source).toContain("if (toolName === 'media')");
    expect(source).toContain('callbacks?.mediaFns');
    expect(source).toContain('executeMediaCommand');
  });
});
