import { describe, expect, it } from 'bun:test';
import { resolveMemoryEnabled } from '../preferences';

describe('preferences.memoryEnabled', () => {
  it('defaults memory on', () => {
    expect(resolveMemoryEnabled({})).toBe(true);
  });

  it('honors explicit off', () => {
    expect(resolveMemoryEnabled({ memoryEnabled: false })).toBe(false);
    expect(resolveMemoryEnabled({ memoryEnabled: true })).toBe(true);
  });
});
