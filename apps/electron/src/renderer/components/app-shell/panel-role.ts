import { resolveBranchNewPanelOption } from './branching'

export type PanelRole = 'primary' | 'secondary' | 'dock'

export function shouldShowDockToggle(panelRole: PanelRole = 'primary', isOnlyPanel = true): boolean {
  return panelRole === 'primary' && isOnlyPanel
}

export function shouldShowOpenInNewPanel(panelRole: PanelRole = 'primary'): boolean {
  return panelRole === 'primary'
}

export function shouldShowPanelClose(panelRole: PanelRole = 'primary'): boolean {
  return panelRole === 'secondary'
}

export function resolveBranchNewPanelForRole(
  panelRole: PanelRole = 'primary',
  options?: { newPanel?: boolean },
): boolean {
  return panelRole === 'secondary' ? false : resolveBranchNewPanelOption(options)
}
