import { describe, expect, it } from 'bun:test'
import {
  resolveBranchNewPanelForRole,
  shouldShowDockToggle,
  shouldShowOpenInNewPanel,
  shouldShowPanelClose,
} from '../panel-role'

describe('panel role behavior', () => {
  it('shows the dock toggle only for a single primary panel', () => {
    expect(shouldShowDockToggle('primary', true)).toBe(true)
    expect(shouldShowDockToggle('primary', { isOnlyPanel: true })).toBe(true)
    expect(shouldShowDockToggle('primary', false)).toBe(false)
    expect(shouldShowDockToggle('primary', { isOnlyPanel: false })).toBe(false)
    expect(shouldShowDockToggle('secondary', true)).toBe(false)
    expect(shouldShowDockToggle('dock', true)).toBe(false)
  })

  it('shows Open in New Panel only on primary panels when dock is closed', () => {
    expect(shouldShowOpenInNewPanel('primary')).toBe(true)
    expect(shouldShowOpenInNewPanel('primary', { isDockOpen: true })).toBe(false)
    expect(shouldShowOpenInNewPanel('primary', { isOnlyPanel: false })).toBe(false)
    expect(shouldShowOpenInNewPanel('secondary')).toBe(false)
    expect(shouldShowOpenInNewPanel('dock')).toBe(false)
  })

  it('shows close only on secondary panels', () => {
    expect(shouldShowPanelClose('primary')).toBe(false)
    expect(shouldShowPanelClose('secondary')).toBe(true)
    expect(shouldShowPanelClose('dock')).toBe(false)
  })

  it('keeps secondary branches in the same panel', () => {
    expect(resolveBranchNewPanelForRole('primary')).toBe(true)
    expect(resolveBranchNewPanelForRole('dock')).toBe(true)
    expect(resolveBranchNewPanelForRole('secondary')).toBe(false)
    expect(resolveBranchNewPanelForRole('primary', { newPanel: false })).toBe(false)
  })
})
