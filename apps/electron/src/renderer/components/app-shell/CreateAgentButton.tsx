import * as React from 'react'
import { Plus, Sparkles } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EditPopover, getEditConfig } from '@/components/ui/EditPopover'

interface CreateAgentButtonProps {
  workspaceRootPath: string
}

export function CreateAgentButton({ workspaceRootPath }: CreateAgentButtonProps) {
  const { t } = useTranslation()

  return (
    <EditPopover
      trigger={
        <button
          type="button"
          className="header-icon-btn titlebar-no-drag inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-[8px] border border-foreground/6 bg-background px-3 text-xs font-medium leading-none text-foreground transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
          data-tutorial="add-agent-button"
        >
          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="leading-none">{t('agents.createAgent')}</span>
          <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      }
      {...getEditConfig('add-agent', workspaceRootPath)}
    />
  )
}
