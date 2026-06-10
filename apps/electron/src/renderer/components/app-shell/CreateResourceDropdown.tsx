import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Folder, Globe2, Plus, Server, Zap } from 'lucide-react'
import { EditPopover, getEditConfig, type EditContextKey } from '@/components/ui/EditPopover'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  StyledDropdownMenuContent,
  StyledDropdownMenuItem,
} from '@/components/ui/styled-dropdown'

interface CreateResourceDropdownProps {
  workspaceRootPath: string
}

export function CreateResourceDropdown({ workspaceRootPath }: CreateResourceDropdownProps) {
  const { t } = useTranslation()
  const [addContext, setAddContext] = React.useState<EditContextKey>('add-source-api')
  const [addPopoverOpen, setAddPopoverOpen] = React.useState(false)

  const handleAddResource = React.useCallback((context: EditContextKey) => {
    setAddContext(context)
    setAddPopoverOpen(true)
  }, [])

  return (
    <div className="relative">
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="header-icon-btn titlebar-no-drag inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-[8px] border border-foreground/6 bg-background px-3 text-xs font-medium leading-none text-foreground transition-colors hover:bg-foreground/5 data-[state=open]:bg-foreground/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            data-tutorial="add-resource-button"
          >
            <Plus className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="leading-none">{t('resources.create')}</span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
        </DropdownMenuTrigger>
        <StyledDropdownMenuContent align="end" minWidth="min-w-40">
          <StyledDropdownMenuItem onClick={() => handleAddResource('add-source-api')}>
            <Globe2 className="h-4 w-4" />
            <span>{t('resources.typeApi')}</span>
          </StyledDropdownMenuItem>
          <StyledDropdownMenuItem onClick={() => handleAddResource('add-source-mcp')}>
            <Server className="h-4 w-4" />
            <span>{t('resources.typeMcp')}</span>
          </StyledDropdownMenuItem>
          <StyledDropdownMenuItem onClick={() => handleAddResource('add-source-local')}>
            <Folder className="h-4 w-4" />
            <span>{t('resources.typeLocal')}</span>
          </StyledDropdownMenuItem>
          <StyledDropdownMenuItem onClick={() => handleAddResource('add-skill')}>
            <Zap className="h-4 w-4" />
            <span>{t('resources.typeSkill')}</span>
          </StyledDropdownMenuItem>
        </StyledDropdownMenuContent>
      </DropdownMenu>
      <EditPopover
        open={addPopoverOpen}
        onOpenChange={setAddPopoverOpen}
        trigger={<button type="button" aria-hidden="true" tabIndex={-1} className="pointer-events-none absolute right-0 top-0 h-px w-px opacity-0" />}
        {...getEditConfig(addContext, workspaceRootPath)}
      />
    </div>
  )
}
