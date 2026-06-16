import { describe, expect, it } from 'bun:test';
import { resolveMemoryAutomationMode } from '../preferences';

describe('preferences.memoryAutomationMode', () => {
  it('uses explicit automation mode when present', () => {
    expect(resolveMemoryAutomationMode({ memoryAutomationMode: 'auto', autoSuggestMemories: false })).toBe('auto');
    expect(resolveMemoryAutomationMode({ memoryAutomationMode: 'review' })).toBe('review');
    expect(resolveMemoryAutomationMode({ memoryAutomationMode: 'off' })).toBe('off');
  });

  it('maps legacy autoSuggestMemories false to off', () => {
    expect(resolveMemoryAutomationMode({ autoSuggestMemories: false })).toBe('off');
  });

  it('defaults missing or legacy true preferences to review', () => {
    expect(resolveMemoryAutomationMode({})).toBe('review');
    expect(resolveMemoryAutomationMode({ autoSuggestMemories: true })).toBe('review');
  });
});
