import { describe, expect, it } from 'bun:test'
import { DEFAULT_CONTEXT_WINDOW, getContextFillPercent, isMemoryContextPressure, resolveContextWindow } from '../context-window'

describe('context window helpers', () => {
  it('uses 262k fallback', () => {
    expect(resolveContextWindow()).toBe(DEFAULT_CONTEXT_WINDOW)
  })

  it('calculates fill percent', () => {
    expect(getContextFillPercent(131_072, 262_144)).toBe(50)
  })

  it('triggers memory at 90 percent', () => {
    expect(isMemoryContextPressure(235_930, 262_144)).toBe(true)
    expect(isMemoryContextPressure(200_000, 262_144)).toBe(false)
  })
})

