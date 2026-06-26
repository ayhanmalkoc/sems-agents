import { describe, expect, it } from 'bun:test';
import { piDriver } from './pi.ts';

describe('piDriver.buildRuntime custom endpoint models', () => {
  it('preserves explicit per-model supportsImages values', () => {
    const runtime = piDriver.buildRuntime({
      context: {
        provider: 'pi',
        authType: 'api_key',
        resolvedModel: 'vision-model',
        capabilities: { needsHttpPoolServer: false },
        connection: {
          slug: 'custom-endpoint',
          name: 'Custom Endpoint',
          providerType: 'pi',
          authType: 'api_key',
          baseUrl: 'http://127.0.0.1:11111/v1',
          customEndpoint: { api: 'anthropic-messages', supportsImages: true },
          models: [
            { id: 'vision-model', contextWindow: 262_144, supportsImages: true },
            { id: 'text-only-model', supportsImages: false },
            { id: 'plain-model' },
          ],
          createdAt: Date.now(),
        } as any,
      },
      coreConfig: {} as any,
      hostRuntime: {} as any,
      resolvedPaths: {
        piServerPath: '/tmp/pi-agent-server.js',
        interceptorBundlePath: '/tmp/interceptor.cjs',
        nodeRuntimePath: '/usr/bin/node',
      },
    });

    expect(runtime.customModels).toEqual([
      { id: 'vision-model', contextWindow: 262_144, supportsImages: true },
      { id: 'text-only-model', supportsImages: false },
      'plain-model',
    ]);
  });

  it('maps 9router to OpenAI-compatible runtime without persisting connection shims', () => {
    const runtime = piDriver.buildRuntime({
      context: {
        provider: 'pi',
        authType: 'api_key_with_endpoint',
        resolvedModel: 'openai/gpt-4.1-mini',
        capabilities: { needsHttpPoolServer: false },
        connection: {
          slug: 'nine-router',
          name: '9router Gateway',
          providerType: '9router',
          authType: 'api_key_with_endpoint',
          baseUrl: 'https://router.example.com/v1',
          models: [
            { id: 'openai/gpt-4.1-mini', contextWindow: 128_000, supportsImages: true },
            { id: 'anthropic/claude-sonnet-4', contextWindow: 200_000, supportsImages: false },
          ],
          createdAt: Date.now(),
        } as any,
      },
      coreConfig: {} as any,
      hostRuntime: {} as any,
      resolvedPaths: {
        piServerPath: '/tmp/pi-agent-server.js',
        interceptorBundlePath: '/tmp/interceptor.cjs',
        nodeRuntimePath: '/usr/bin/node',
      },
    });

    expect(runtime.baseUrl).toBe('https://router.example.com/v1');
    expect(runtime.piAuthProvider).toBe('openai');
    expect(runtime.customEndpoint).toEqual({ api: 'openai-completions' });
    expect(runtime.customModels).toEqual([
      { id: 'openai/gpt-4.1-mini', contextWindow: 128_000, supportsImages: true },
      { id: 'anthropic/claude-sonnet-4', contextWindow: 200_000, supportsImages: false },
    ]);
  });
});
