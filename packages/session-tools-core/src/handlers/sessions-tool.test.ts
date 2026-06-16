import { describe, it, expect } from 'bun:test';
import type { SessionToolContext, SessionInfo } from '../context.ts';
import { handleSessionsTool } from './sessions-tool.ts';

function text(result: { content: Array<{ text?: string }> }): string {
  return result.content.map(part => part.text ?? '').join('');
}

function makeInfo(id = 's1'): SessionInfo {
  return {
    id,
    name: 'Session One',
    labels: [],
    status: 'todo',
    permissionMode: 'ask',
    createdAt: 1,
    isActive: false,
  };
}

describe('sessions domain tool', () => {
  it('status reports available callbacks', async () => {
    const result = await handleSessionsTool({ sessionId: 'current' } as SessionToolContext, { command: 'status' });
    expect(text(result)).toContain('currentSessionId');
  });

  it('list and show use read callbacks', async () => {
    const ctx = {
      sessionId: 'current',
      listSessions: () => ({ total: 1, returned: 1, sessions: [{ id: 's1', name: 'One', labels: [], status: 'todo', createdAt: 1 }] }),
      getSessionInfo: (id?: string) => id === 's1' ? makeInfo(id) : null,
    } satisfies Partial<SessionToolContext>;

    expect(text(await handleSessionsTool(ctx as SessionToolContext, { command: 'list' }))).toContain('"total": 1');
    expect(text(await handleSessionsTool(ctx as SessionToolContext, { command: 'show s1' }))).toContain('"id": "s1"');
    expect(text(await handleSessionsTool(ctx as SessionToolContext, { command: 'show missing' }))).toContain('Session not found');
  });

  it('spawn parses JSON and calls spawn callback', async () => {
    const calls: Record<string, unknown>[] = [];
    const ctx = {
      sessionId: 'current',
      spawnSession: async (input: Record<string, unknown>) => { calls.push(input); return { sessionId: 'child', status: 'started' }; },
    } satisfies Partial<SessionToolContext>;

    const result = await handleSessionsTool(ctx as SessionToolContext, { command: 'spawn {"name":"Child","prompt":"hello"}' });
    expect(text(result)).toContain('child');
    expect(calls).toEqual([{ name: 'Child', prompt: 'hello' }]);
  });

  it('maps metadata mutation commands to callbacks', async () => {
    const calls: string[] = [];
    const ctx = {
      sessionId: 'current',
      renameSession: async (id, name) => { calls.push(`rename:${id}:${name}`); },
      setSessionLabels: async (id, labels) => { calls.push(`labels:${id}:${labels.join(',')}`); },
      setSessionStatus: async (id, status) => { calls.push(`status:${id}:${status}`); },
      setSessionAgent: async (id, agent) => { calls.push(`agent:${id}:${agent}`); },
      archiveSession: async (id, archived) => { calls.push(`archive:${id}:${archived}`); },
      pinSession: async (id, pinned) => { calls.push(`pin:${id}:${pinned}`); },
    } satisfies Partial<SessionToolContext>;

    await handleSessionsTool(ctx as SessionToolContext, { command: 'rename s1 "New Name"' });
    await handleSessionsTool(ctx as SessionToolContext, { command: 'labels s1 ["qa","ui"]' });
    await handleSessionsTool(ctx as SessionToolContext, { command: 'status-set s1 done' });
    await handleSessionsTool(ctx as SessionToolContext, { command: 'agent s1 default' });
    await handleSessionsTool(ctx as SessionToolContext, { command: 'archive s1 true' });
    await handleSessionsTool(ctx as SessionToolContext, { command: 'pin s1 false' });

    expect(calls).toEqual([
      'rename:s1:New Name',
      'labels:s1:qa,ui',
      'status:s1:done',
      'agent:s1:default',
      'archive:s1:true',
      'pin:s1:false',
    ]);
  });

  it('message wraps sender and rejects self-send', async () => {
    const calls: Array<[string, string]> = [];
    const ctx = {
      sessionId: 'current',
      getSessionInfo: () => makeInfo('current'),
      sendAgentMessage: async (id, message) => { calls.push([id, message]); },
    } satisfies Partial<SessionToolContext>;

    expect(text(await handleSessionsTool(ctx as SessionToolContext, { command: 'message other "hello there"' }))).toContain('Message sent');
    expect(calls[0]![0]).toBe('other');
    expect(calls[0]![1]).toContain('hello there');
    expect(text(await handleSessionsTool(ctx as SessionToolContext, { command: 'message current nope' }))).toContain('Cannot send');
  });

  it('delete requires --confirm', async () => {
    const calls: string[] = [];
    const ctx = { sessionId: 'current', deleteSession: async (id: string) => { calls.push(id); } } satisfies Partial<SessionToolContext>;

    expect(text(await handleSessionsTool(ctx as SessionToolContext, { command: 'delete s1' }))).toContain('--confirm');
    expect(text(await handleSessionsTool(ctx as SessionToolContext, { command: 'delete s1 --confirm' }))).toContain('Deleted session s1');
    expect(calls).toEqual(['s1']);
  });

  it('returns clear errors for unknown command and invalid JSON', async () => {
    const ctx = { sessionId: 'current', spawnSession: async () => ({ sessionId: 'x' }) } satisfies Partial<SessionToolContext>;

    expect(text(await handleSessionsTool(ctx as SessionToolContext, { command: 'wat' }))).toContain('Unknown sessions command');
    expect(text(await handleSessionsTool(ctx as SessionToolContext, { command: 'spawn nope' }))).toContain('Invalid JSON');
  });
});
