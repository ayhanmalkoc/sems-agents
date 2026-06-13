import { resolveBranchNewPanelOption } from './branching'

export type PanelRole = 'primary' | 'secondary' | 'dock'

type DockToggleOptions = boolean | { isOnlyPanel?: boolean }

export function shouldShowDockToggle(panelRole: PanelRole = 'primary', options: DockToggleOptions = true): boolean {
  const isOnlyPanel = typeof options === 'boolean' ? options : options.isOnlyPanel ?? true
  return panelRole === 'primary' && isOnlyPanel
}

export function shouldShowOpenInNewPanel(
  panelRole: PanelRole = 'primary',
  options: { isDockOpen?: boolean; isOnlyPanel?: boolean } = {},
): boolean {
  return panelRole === 'primary' && (options.isOnlyPanel ?? true) && !options.isDockOpen
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
