import { describe, expect, it } from 'bun:test';
import { handleCredentialPrompt } from './credential-prompt.ts';
import type { SessionToolContext } from '../context.ts';
import type { AuthRequest, SourceConfig } from '../types.ts';

function createCtx(source: SourceConfig, authRequests: AuthRequest[] = []): SessionToolContext {
  return {
    sessionId: 'test-session',
    workspacePath: '/tmp/workspace',
    sourcesPath: '/tmp/workspace/sources',
    skillsPath: '/tmp/workspace/skills',
    plansFolderPath: '/tmp/workspace/plans',
    callbacks: {
      onPlanSubmitted: () => {},
      onAuthRequest: request => authRequests.push(request),
    },
    fs: {
      exists: () => true,
      readFile: () => '',
      readFileBuffer: () => Buffer.from(''),
      writeFile: () => {},
      isDirectory: () => true,
      readdir: () => [],
      stat: () => ({ size: 0, isDirectory: () => false }),
    },
    loadSourceConfig: slug => (slug === source.slug ? source : null),
    saveSourceConfig: () => {},
  } as unknown as SessionToolContext;
}

describe('handleCredentialPrompt', () => {
  it('ignores passwordRequired and empty labels for bearer prompts', async () => {
    const authRequests: AuthRequest[] = [];
    const source: SourceConfig = {
      name: 'Luw.ai API',
      slug: 'luw-ai',
      type: 'api',
      provider: 'luw-ai',
      enabled: true,
      api: { baseUrl: 'https://api.luw.ai/v2/', authType: 'bearer' },
    };

    const result = await handleCredentialPrompt(createCtx(source, authRequests), {
      sourceSlug: 'luw-ai',
      mode: 'bearer',
      labels: {
        credential: 'Luw.ai Bearer Token',
        username: '',
        password: '',
      },
      description: 'Enter your Luw.ai bearer token securely.',
      hint: 'Get it from https://app.luw.ai/dashboard/api',
      headerNames: [],
      passwordRequired: false,
    });

    expect(result.isError).not.toBe(true);
    expect(authRequests).toHaveLength(1);
    expect(authRequests[0]).toMatchObject({
      type: 'credential',
      sourceSlug: 'luw-ai',
      sourceName: 'Luw.ai API',
      mode: 'bearer',
      labels: { credential: 'Luw.ai Bearer Token' },
      sourceUrl: 'https://api.luw.ai/v2/',
    });
    expect('passwordRequired' in authRequests[0]!).toBe(true);
    expect((authRequests[0] as { passwordRequired?: boolean }).passwordRequired).toBeUndefined();
  });

  it('preserves passwordRequired for basic prompts', async () => {
    const authRequests: AuthRequest[] = [];
    const source: SourceConfig = {
      name: 'Basic API',
      slug: 'basic-api',
      type: 'api',
      provider: 'custom',
      enabled: true,
      api: { baseUrl: 'https://api.example.com/', authType: 'basic' },
    };

    const result = await handleCredentialPrompt(createCtx(source, authRequests), {
      sourceSlug: 'basic-api',
      mode: 'basic',
      passwordRequired: false,
    });

    expect(result.isError).not.toBe(true);
    expect(authRequests).toHaveLength(1);
    expect(authRequests[0]).toMatchObject({
      type: 'credential',
      sourceSlug: 'basic-api',
      mode: 'basic',
      passwordRequired: false,
    });
  });
});
