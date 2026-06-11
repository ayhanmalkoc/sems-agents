import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { EditPopover, getEditConfig } from '@/components/ui/EditPopover'
import { AIAssistedButton } from '@/components/app-shell/AIAssistedButton'

interface CreateAgentButtonProps {
  workspaceRootPath: string
}

export function CreateAgentButton({ workspaceRootPath }: CreateAgentButtonProps) {
  const { t } = useTranslation()

  return (
    <EditPopover
      trigger={
        <AIAssistedButton label={t('common.create')} data-tutorial="add-agent-button" />
      }
      {...getEditConfig('add-agent', workspaceRootPath)}
    />
  )
}
