import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { EditPopover, getEditConfig } from '@/components/ui/EditPopover'
import { AIAssistedButton } from '@/components/app-shell/AIAssistedButton'
import { useAppShellContext } from '@/context/AppShellContext'

interface CreateAgentButtonProps {
  workspaceRootPath: string
  defaultValue?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onClick?: () => void
}

export function CreateAgentButton({ workspaceRootPath, defaultValue = '', open, onOpenChange, onClick }: CreateAgentButtonProps) {
  const { t } = useTranslation()
  const { refreshAgentProfiles } = useAppShellContext()

  const handleOpenChange = React.useCallback((nextOpen: boolean) => {
    onOpenChange?.(nextOpen)
    if (!nextOpen) void refreshAgentProfiles?.()
  }, [onOpenChange, refreshAgentProfiles])

  return (
    <EditPopover
      open={open}
      onOpenChange={handleOpenChange}
      defaultValue={defaultValue}
      onInlineComplete={refreshAgentProfiles}
      trigger={
        <AIAssistedButton label={t('common.create')} data-tutorial="add-agent-button" onClick={onClick} />
      }
      {...getEditConfig('add-agent', workspaceRootPath)}
    />
  )
}
