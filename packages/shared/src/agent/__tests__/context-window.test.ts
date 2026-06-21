import { describe, expect, it } from 'bun:test'
import { DEFAULT_CONTEXT_WINDOW, getContextFillPercent, resolveContextWindow } from '../context-window'

describe('context window helpers', () => {
  it('uses 262k fallback', () => {
    expect(resolveContextWindow()).toBe(DEFAULT_CONTEXT_WINDOW)
  })

  it('calculates fill percent', () => {
    expect(getContextFillPercent(131_072, 262_144)).toBe(50)
  })
})

