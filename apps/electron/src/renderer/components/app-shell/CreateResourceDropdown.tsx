import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Folder, Globe2, Server, Zap } from 'lucide-react'
import { EditPopover, getEditConfig, type EditContextKey } from '@/components/ui/EditPopover'
import { AIAssistedButton } from '@/components/app-shell/AIAssistedButton'
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
          <AIAssistedButton label={t('common.create')} showChevron data-tutorial="add-resource-button" />
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
