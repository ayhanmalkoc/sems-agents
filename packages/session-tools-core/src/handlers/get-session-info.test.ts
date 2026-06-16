import { describe, it, expect } from 'bun:test';
import type { SessionToolContext, SessionInfo } from '../context.ts';
import { handleGetSessionInfo } from './get-session-info.ts';

function text(result: { content: Array<{ text?: string }> }): string {
  return result.content.map(part => part.text ?? '').join('');
}

function makeInfo(id: string): SessionInfo {
  return {
    id,
    name: 'Current',
    labels: [],
    status: 'todo',
    permissionMode: 'ask',
    createdAt: 1,
    isActive: true,
  };
}

describe('get_session_info', () => {
  it('treats empty sessionId as omitted current session', async () => {
    const received: Array<string | undefined> = [];
    const ctx = {
      sessionId: 'current-session',
      getSessionInfo: (sessionId?: string) => {
        received.push(sessionId);
        return makeInfo(sessionId ?? 'current-session');
      },
    } satisfies Partial<SessionToolContext>;

    const result = await handleGetSessionInfo(ctx as SessionToolContext, { sessionId: '' });

    expect(received).toEqual([undefined]);
    expect(text(result)).toContain('current-session');
  });
});
