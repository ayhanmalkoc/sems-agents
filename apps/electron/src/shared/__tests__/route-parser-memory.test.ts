import { describe, expect, it } from 'bun:test'
import { buildCompoundRoute, parseCompoundRoute, parseRouteToNavigationState } from '../route-parser'

describe('route-parser: memory routes', () => {
  it('parses memory as memory navigator', () => {
    const result = parseCompoundRoute('memory')
    expect(result).not.toBeNull()
    expect(result!.navigator).toBe('memory')
    expect(result!.details).toBeNull()
  })

  it('converts memory route to memory navigation state', () => {
    expect(parseRouteToNavigationState('memory')).toEqual({ navigator: 'memory' })
  })

  it('roundtrips memory', () => {
    expect(buildCompoundRoute(parseCompoundRoute('memory')!)).toBe('memory')
  })
})
