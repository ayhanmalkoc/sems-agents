import * as React from 'react'
import { AppWindow, Copy, Sparkles, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useMenuComponents } from '@/components/ui/menu-context'
import type { AgentProfile } from '../../../shared/types'

export interface AgentMenuProps {
  agent: AgentProfile
  onOpenInNewWindow: () => void
  onDuplicate: () => void | Promise<void>
  onDelete?: () => void | Promise<void>
  onImprove?: () => void
}

export function AgentMenu({ agent, onOpenInNewWindow, onDuplicate, onDelete, onImprove }: AgentMenuProps) {
  const { t } = useTranslation()
  const { MenuItem, Separator } = useMenuComponents()
  return (
    <>
      <MenuItem onClick={onOpenInNewWindow}>
        <AppWindow className="h-3.5 w-3.5" />
        <span className="flex-1">{t('agents.openInNewWindow')}</span>
      </MenuItem>
      {onImprove && (
        <MenuItem onClick={onImprove}>
          <Sparkles className="h-3.5 w-3.5" />
          <span className="flex-1">{t('agents.improveWithAI')}</span>
        </MenuItem>
      )}
      <MenuItem onClick={onDuplicate}>
        <Copy className="h-3.5 w-3.5" />
        <span className="flex-1">{t('agents.duplicate')}</span>
      </MenuItem>
      {onDelete && (
        <>
          <Separator />
          <MenuItem onClick={onDelete} variant="destructive">
            <Trash2 className="h-3.5 w-3.5" />
            <span className="flex-1">{t('agents.deleteAgent')}</span>
          </MenuItem>
        </>
      )}
    </>
  )
}