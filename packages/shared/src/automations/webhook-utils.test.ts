/**
 * Tests for webhook utility functions (expandWebhookAction, etc.)
 */

import { describe, it, expect } from 'bun:test';
import { createPromptHistoryEntry, createWebhookHistoryEntry, expandWebhookAction } from './webhook-utils.ts';
import type { WebhookAction } from './types.ts';

const env = {
  CRAFT_WH_SESSION_ID: 'sess-123',
  CRAFT_WH_EVENT: 'LabelAdd',
  API_TOKEN: 'tok-secret',
};

describe('expandWebhookAction', () => {
  it('expands URL templates', () => {
    const action: WebhookAction = {
      type: 'webhook',
      url: 'https://api.example.com/hook/${CRAFT_WH_SESSION_ID}',
    };
    const result = expandWebhookAction(action, env);
    expect(result.url).toBe('https://api.example.com/hook/sess-123');
  });

  it('expands header values', () => {
    const action: WebhookAction = {
      type: 'webhook',
      url: 'https://api.example.com',
      headers: { 'X-Event': '${CRAFT_WH_EVENT}', 'X-Static': 'unchanged' },
    };
    const result = expandWebhookAction(action, env);
    expect(result.headers).toEqual({ 'X-Event': 'LabelAdd', 'X-Static': 'unchanged' });
  });

  it('expands string body', () => {
    const action: WebhookAction = {
      type: 'webhook',
      url: 'https://api.example.com',
      body: 'session=${CRAFT_WH_SESSION_ID}',
      bodyFormat: 'raw',
    };
    const result = expandWebhookAction(action, env);
    expect(result.body).toBe('session=sess-123');
  });

  it('expands object body (JSON)', () => {
    const action: WebhookAction = {
      type: 'webhook',
      url: 'https://api.example.com',
      body: { id: '${CRAFT_WH_SESSION_ID}', event: '${CRAFT_WH_EVENT}' },
    };
    const result = expandWebhookAction(action, env);
    expect(result.body).toEqual({ id: 'sess-123', event: 'LabelAdd' });
  });

  it('expands basic auth credentials', () => {
    const action: WebhookAction = {
      type: 'webhook',
      url: 'https://api.example.com',
      auth: { type: 'basic', username: '${CRAFT_WH_SESSION_ID}', password: '${API_TOKEN}' },
    };
    const result = expandWebhookAction(action, env);
    expect(result.auth).toEqual({ type: 'basic', username: 'sess-123', password: 'tok-secret' });
  });

  it('expands bearer auth token', () => {
    const action: WebhookAction = {
      type: 'webhook',
      url: 'https://api.example.com',
      auth: { type: 'bearer', token: '${API_TOKEN}' },
    };
    const result = expandWebhookAction(action, env);
    expect(result.auth).toEqual({ type: 'bearer', token: 'tok-secret' });
  });

  it('passes through fields without templates unchanged', () => {
    const action: WebhookAction = {
      type: 'webhook',
      url: 'https://api.example.com/static',
      method: 'PUT',
      bodyFormat: 'json',
      captureResponse: true,
    };
    const result = expandWebhookAction(action, env);
    expect(result.url).toBe('https://api.example.com/static');
    expect(result.method).toBe('PUT');
    expect(result.bodyFormat).toBe('json');
    expect(result.captureResponse).toBe(true);
  });
});

describe('history entry metadata', () => {
  it('adds metadata and outcome to prompt history entries', () => {
    const entry = createPromptHistoryEntry({
      matcherId: 'abc123',
      ok: true,
      metadata: {
        event: 'LabelAdd',
        triggerSummary: 'LabelAdd: urgent',
        matcherSummary: 'Matcher matched: urgent',
        conditionSummary: 'No conditions',
      },
      sessionId: 'session-1',
      prompt: 'Triage urgent label',
    });

    expect(entry).toMatchObject({
      id: 'abc123',
      ok: true,
      event: 'LabelAdd',
      triggerSummary: 'LabelAdd: urgent',
      matcherSummary: 'Matcher matched: urgent',
      conditionSummary: 'No conditions',
      outcome: 'action_completed',
      sessionId: 'session-1',
    });
  });

  it('adds metadata and failed outcome to webhook history entries', () => {
    const entry = createWebhookHistoryEntry({
      matcherId: 'def456',
      ok: false,
      metadata: {
        event: 'SessionStatusChange',
        triggerSummary: 'SessionStatusChange: done',
        matcherSummary: 'Matcher matched: done',
        conditionSummary: 'Conditions passed (1)',
      },
      method: 'POST',
      url: 'https://hooks.example.com/secret/path',
      statusCode: 401,
      durationMs: 120,
      error: 'Unauthorized',
    });

    expect(entry).toMatchObject({
      id: 'def456',
      ok: false,
      event: 'SessionStatusChange',
      triggerSummary: 'SessionStatusChange: done',
      matcherSummary: 'Matcher matched: done',
      conditionSummary: 'Conditions passed (1)',
      outcome: 'action_failed',
      webhook: {
        method: 'POST',
        statusCode: 401,
        durationMs: 120,
        error: 'Unauthorized',
      },
    });
  });
});
