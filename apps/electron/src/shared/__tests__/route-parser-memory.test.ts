import { describe, expect, it } from 'bun:test'
import { buildCompoundRoute, parseCompoundRoute, parseRouteToNavigationState } from '../route-parser'

describe('route-parser: memory route compatibility', () => {
  it('parses legacy memory route as settings memory', () => {
    const result = parseCompoundRoute('memory')
    expect(result).not.toBeNull()
    expect(result!.navigator).toBe('settings')
    expect(result!.details).toEqual({ type: 'memory', id: 'memory' })
  })

  it('converts legacy memory route to settings memory navigation state', () => {
    expect(parseRouteToNavigationState('memory')).toEqual({ navigator: 'settings', subpage: 'memory' })
  })

  it('roundtrips legacy memory to canonical settings memory', () => {
    expect(buildCompoundRoute(parseCompoundRoute('memory')!)).toBe('settings/memory')
  })
})
