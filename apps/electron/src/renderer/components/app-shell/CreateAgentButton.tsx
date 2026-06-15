import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { EditPopover, getEditConfig } from '@/components/ui/EditPopover'
import { AIAssistedButton } from '@/components/app-shell/AIAssistedButton'

interface CreateAgentButtonProps {
  workspaceRootPath: string
  defaultValue?: string
  open?: boolean
  onOpenChange?: (open: boolean) => void
  onClick?: () => void
}

export function CreateAgentButton({ workspaceRootPath, defaultValue = '', open, onOpenChange, onClick }: CreateAgentButtonProps) {
  const { t } = useTranslation()

  return (
    <EditPopover
      open={open}
      onOpenChange={onOpenChange}
      defaultValue={defaultValue}
      trigger={
        <AIAssistedButton label={t('common.create')} data-tutorial="add-agent-button" onClick={onClick} />
      }
      {...getEditConfig('add-agent', workspaceRootPath)}
    />
  )
}
