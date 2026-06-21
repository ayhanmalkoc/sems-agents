import { describe, expect, it } from 'bun:test'
import { buildCompoundRoute, parseCompoundRoute, parseRouteToNavigationState } from '../route-parser'
import { routes } from '../routes'

describe('route-parser: studio route', () => {
  it('parses studio as top-level navigator', () => {
    expect(parseCompoundRoute('studio')).toEqual({ navigator: 'studio', details: null })
    expect(parseRouteToNavigationState('studio')).toEqual({ navigator: 'studio', details: null })
  })

  it('roundtrips studio route builder', () => {
    const parsed = parseCompoundRoute(routes.view.studio())
    expect(parsed).toEqual({ navigator: 'studio', details: null })
    expect(buildCompoundRoute(parsed!)).toBe('studio')
  })
})
