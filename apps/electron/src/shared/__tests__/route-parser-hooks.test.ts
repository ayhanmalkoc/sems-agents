import { describe, expect, it } from 'bun:test'
import { buildCompoundRoute, parseCompoundRoute, parseRouteToNavigationState } from '../route-parser'

describe('route-parser: hooks route compatibility', () => {
  it('parses legacy hooks route as settings hooks', () => {
    const result = parseCompoundRoute('hooks')
    expect(result).not.toBeNull()
    expect(result!.navigator).toBe('settings')
    expect(result!.details).toEqual({ type: 'hooks', id: 'hooks' })
  })

  it('converts legacy hooks route to settings hooks navigation state', () => {
    expect(parseRouteToNavigationState('hooks')).toEqual({ navigator: 'settings', subpage: 'hooks' })
  })

  it('roundtrips legacy hooks to canonical settings hooks', () => {
    expect(buildCompoundRoute(parseCompoundRoute('hooks')!)).toBe('settings/hooks')
  })
})
