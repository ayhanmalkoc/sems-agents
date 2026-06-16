import { describe, it, expect } from 'bun:test';
import type { SessionToolContext } from '../context.ts';
import { handleSetSessionAgent } from './set-session-agent.ts';
import { handleRenameSession } from './rename-session.ts';
import { handleArchiveSession } from './archive-session.ts';
import { handlePinSession } from './pin-session.ts';
import { handleDeleteSession } from './delete-session.ts';

function text(result: { content: Array<{ text?: string }> }): string {
  return result.content.map(part => part.text ?? '').join('');
}

describe('session mutation tools', () => {
  it('set_session_agent calls callback for current and explicit sessions', async () => {
    const calls: Array<[string | undefined, string]> = [];
    const ctx = { setSessionAgent: (sessionId, agentId) => calls.push([sessionId, agentId]) } satisfies Partial<SessionToolContext>;

    const current = await handleSetSessionAgent(ctx as SessionToolContext, { agentId: 'default' });
    const explicit = await handleSetSessionAgent(ctx as SessionToolContext, { sessionId: 's2', agentId: 'reviewer' });

    expect(text(current)).toContain('Agent set to "default"');
    expect(text(explicit)).toContain('session s2');
    expect(calls).toEqual([[undefined, 'default'], ['s2', 'reviewer']]);
  });

  it('set_session_agent rejects missing agentId and unavailable callback', async () => {
    expect(text(await handleSetSessionAgent({} as SessionToolContext, { agentId: 'default' }))).toContain('not available');
    expect(text(await handleSetSessionAgent({ setSessionAgent: () => {} } as SessionToolContext, { agentId: '   ' }))).toContain('Missing agentId');
  });

  it('rename_session trims names and rejects empty names', async () => {
    const calls: Array<[string | undefined, string]> = [];
    const ctx = { renameSession: (sessionId, name) => calls.push([sessionId, name]) } satisfies Partial<SessionToolContext>;

    expect(text(await handleRenameSession(ctx as SessionToolContext, { name: '  Focus Work  ' }))).toContain('Focus Work');
    expect(calls).toEqual([[undefined, 'Focus Work']]);
    expect(text(await handleRenameSession(ctx as SessionToolContext, { name: '   ' }))).toContain('cannot be empty');
  });

  it('archive_session passes archived boolean through', async () => {
    const calls: Array<[string | undefined, boolean]> = [];
    const ctx = { archiveSession: (sessionId, archived) => calls.push([sessionId, archived]) } satisfies Partial<SessionToolContext>;

    expect(text(await handleArchiveSession(ctx as SessionToolContext, { sessionId: 's1', archived: true }))).toContain('Archived session s1');
    expect(text(await handleArchiveSession(ctx as SessionToolContext, { sessionId: 's1', archived: false }))).toContain('Unarchived session s1');
    expect(calls).toEqual([['s1', true], ['s1', false]]);
  });

  it('pin_session passes pinned boolean through', async () => {
    const calls: Array<[string | undefined, boolean]> = [];
    const ctx = { pinSession: (sessionId, pinned) => calls.push([sessionId, pinned]) } satisfies Partial<SessionToolContext>;

    expect(text(await handlePinSession(ctx as SessionToolContext, { pinned: true }))).toContain('Pinned current session');
    expect(text(await handlePinSession(ctx as SessionToolContext, { pinned: false }))).toContain('Unpinned current session');
    expect(calls).toEqual([[undefined, true], [undefined, false]]);
  });

  it('delete_session requires explicit target and confirmation', async () => {
    const calls: string[] = [];
    const ctx = { deleteSession: (sessionId) => calls.push(sessionId) } satisfies Partial<SessionToolContext>;

    expect(text(await handleDeleteSession(ctx as SessionToolContext, { sessionId: 's1', confirm: true }))).toContain('Deleted session s1');
    expect(calls).toEqual(['s1']);

    expect(text(await handleDeleteSession(ctx as SessionToolContext, { sessionId: ' ', confirm: true }))).toContain('Missing sessionId');
    expect(text(await handleDeleteSession(ctx as SessionToolContext, { sessionId: 's2' }))).toContain('confirm: true');
    expect(text(await handleDeleteSession({} as SessionToolContext, { sessionId: 's2', confirm: true }))).toContain('not available');
  });

  it('delete_session preserves callback errors', async () => {
    const ctx = { deleteSession: () => { throw new Error('Session not found: missing'); } } satisfies Partial<SessionToolContext>;

    expect(text(await handleDeleteSession(ctx as SessionToolContext, { sessionId: 'missing', confirm: true }))).toContain('Session not found: missing');
  });
});
