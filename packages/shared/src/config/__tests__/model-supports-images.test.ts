import { describe, expect, it } from 'bun:test'
import { listCompatibleModelsForTask, modelSupportsImages, resolveModelForTask, sanitizeDefaultModelsForConnection, type LlmConnection } from '../llm-connections.ts'

const BASE_COMPAT: LlmConnection = {
  slug: 'custom',
  name: 'Custom',
  providerType: 'pi_compat',
  authType: 'api_key_with_endpoint',
  baseUrl: 'http://localhost:8080',
  customEndpoint: { api: 'openai-completions' },
  createdAt: 1,
}

describe('modelSupportsImages — pi_compat precedence', () => {
  it('returns true when per-model supportsImages: true (override wins over connection default)', () => {
    const conn: LlmConnection = {
      ...BASE_COMPAT,
      customEndpoint: { api: 'openai-completions', supportsImages: false },
      models: [{ id: 'vision', supportsImages: true } as never],
    }
    expect(modelSupportsImages(conn, 'vision')).toBe(true)
  })

  it('returns false when per-model supportsImages: false (override wins over connection default true)', () => {
    const conn: LlmConnection = {
      ...BASE_COMPAT,
      customEndpoint: { api: 'openai-completions', supportsImages: true },
      models: [{ id: 'text-only', supportsImages: false } as never],
    }
    expect(modelSupportsImages(conn, 'text-only')).toBe(false)
  })

  it('falls back to connection-level supportsImages when no per-model override', () => {
    const conn: LlmConnection = {
      ...BASE_COMPAT,
      customEndpoint: { api: 'openai-completions', supportsImages: true },
      models: ['plain'],
    }
    expect(modelSupportsImages(conn, 'plain')).toBe(true)
  })

  it('returns false when neither per-model override nor connection default is set', () => {
    const conn: LlmConnection = { ...BASE_COMPAT, models: ['plain'] }
    expect(modelSupportsImages(conn, 'plain')).toBe(false)
  })

  it('returns false when the model is not in models[] (matches Pi default)', () => {
    const conn: LlmConnection = { ...BASE_COMPAT, models: ['plain'] }
    expect(modelSupportsImages(conn, 'unknown')).toBe(false)
  })

  it('returns connection default when the model is missing but connection default is true', () => {
    const conn: LlmConnection = {
      ...BASE_COMPAT,
      customEndpoint: { api: 'openai-completions', supportsImages: true },
      models: ['plain'],
    }
    expect(modelSupportsImages(conn, 'unknown')).toBe(true)
  })
})

describe('modelSupportsImages — non-pi_compat fallthrough', () => {
  it('returns true for anthropic regardless of override (renderer does not gate built-in catalogs)', () => {
    const conn: LlmConnection = {
      slug: 'a', name: 'a', providerType: 'anthropic', authType: 'api_key',
      models: [{ id: 'claude-haiku', supportsImages: false } as never],
      createdAt: 1,
    }
    expect(modelSupportsImages(conn, 'claude-haiku')).toBe(true)
  })

  it('returns true for pi regardless of override', () => {
    const conn: LlmConnection = {
      slug: 'p', name: 'p', providerType: 'pi', authType: 'api_key',
      models: [{ id: 'gpt-x', supportsImages: false } as never],
      createdAt: 1,
    }
    expect(modelSupportsImages(conn, 'gpt-x')).toBe(true)
  })
})

describe('resolveModelForTask', () => {
  it('uses task defaults and canonical capabilities', () => {
    const conn: LlmConnection = {
      ...BASE_COMPAT,
      models: [
        { id: 'chat', name: 'Chat', shortName: 'Chat', description: 'Chat', provider: 'pi', contextWindow: 1, capabilities: { input: { text: true }, output: { text: true } } },
        { id: 'image-gen', name: 'Image', shortName: 'Image', description: 'Image', provider: 'pi', contextWindow: 1, capabilities: { input: { text: true }, output: { image: true } } },
      ],
      defaultModels: { imageGeneration: 'image-gen' },
    }
    expect(resolveModelForTask({ connection: conn, task: 'chat' }).model.id).toBe('chat')
    expect(resolveModelForTask({ connection: conn, task: 'imageGeneration' }).model.id).toBe('image-gen')
  })

  it('maps legacy supportsImages to vision image input only', () => {
    const conn: LlmConnection = {
      ...BASE_COMPAT,
      models: [{ id: 'vision', name: 'Vision', shortName: 'Vision', description: 'Vision', provider: 'pi', contextWindow: 1, supportsImages: true }],
    }
    expect(resolveModelForTask({ connection: conn, task: 'vision' }).model.id).toBe('vision')
    expect(() => resolveModelForTask({ connection: conn, task: 'imageGeneration' })).toThrow('No imageGeneration capable model')
  })

  it('rejects incompatible explicit model', () => {
    const conn: LlmConnection = { ...BASE_COMPAT, models: ['plain'] }
    expect(() => resolveModelForTask({ connection: conn, task: 'imageGeneration', model: 'plain' })).toThrow('does not support task imageGeneration')
  })

  it('falls back when a task default is no longer compatible', () => {
    const conn: LlmConnection = {
      ...BASE_COMPAT,
      models: [
        { id: 'chat', name: 'Chat', shortName: 'Chat', description: 'Chat', provider: 'pi', contextWindow: 1, capabilities: { input: { text: true }, output: { text: true } } },
        { id: 'image-old', name: 'Old', shortName: 'Old', description: 'Old', provider: 'pi', contextWindow: 1, capabilities: { input: { text: true }, output: { text: true } } },
        { id: 'image-new', name: 'New', shortName: 'New', description: 'New', provider: 'pi', contextWindow: 1, capabilities: { input: { text: true }, output: { image: true } } },
      ],
      defaultModels: { imageGeneration: 'image-old' },
    }
    expect(resolveModelForTask({ connection: conn, task: 'imageGeneration' }).model.id).toBe('image-new')
  })

  it('lists media-only models only for compatible task routing', () => {
    const conn: LlmConnection = {
      ...BASE_COMPAT,
      models: [
        { id: 'chat', name: 'Chat', shortName: 'Chat', description: 'Chat', provider: 'pi', contextWindow: 1, capabilities: { input: { text: true }, output: { text: true } } },
        { id: 'image-only', name: 'Image', shortName: 'Image', description: 'Image', provider: 'pi', contextWindow: 1, capabilities: { input: { text: true }, output: { text: false, image: true } } },
      ],
    }
    expect(listCompatibleModelsForTask(conn, 'chat').map(model => model.id)).toEqual(['chat'])
    expect(listCompatibleModelsForTask(conn, 'imageGeneration').map(model => model.id)).toEqual(['image-only'])
  })

  it('sanitizes stale task defaults', () => {
    const conn: LlmConnection = {
      ...BASE_COMPAT,
      models: [{ id: 'chat', name: 'Chat', shortName: 'Chat', description: 'Chat', provider: 'pi', contextWindow: 1, capabilities: { input: { text: true }, output: { text: true } } }],
      defaultModels: { chat: 'chat', imageGeneration: 'chat' },
    }
    expect(sanitizeDefaultModelsForConnection(conn)).toEqual({ chat: 'chat' })
  })
})
