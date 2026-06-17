import { describe, expect, it } from 'bun:test'
import { buildCompoundRoute, parseCompoundRoute, parseRouteToNavigationState } from '../route-parser'

describe('route-parser: hooks routes', () => {
  it('parses hooks as hooks navigator', () => {
    const result = parseCompoundRoute('hooks')
    expect(result).not.toBeNull()
    expect(result!.navigator).toBe('hooks')
  })

  it('converts hooks route to hooks navigation state', () => {
    expect(parseRouteToNavigationState('hooks')).toEqual({ navigator: 'hooks' })
  })

  it('roundtrips hooks', () => {
    expect(buildCompoundRoute(parseCompoundRoute('hooks')!)).toBe('hooks')
  })
})
