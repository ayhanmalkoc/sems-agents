import * as React from 'react'
import { DatabaseZap, MoreHorizontal, Zap } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { CreateResourceDropdown } from '@/components/app-shell/CreateResourceDropdown'
import { SourceMenu } from '@/components/app-shell/SourceMenu'
import { SkillMenu } from '@/components/app-shell/SkillMenu'
import { SendResourceToWorkspaceDialog, type SendResourceType } from '@/components/app-shell/SendResourceToWorkspaceDialog'
import { SidebarFilterPills } from '@/components/app-shell/SidebarFilterPills'
import { SourceAvatar } from '@/components/ui/source-avatar'
import { SkillAvatar } from '@/components/ui/skill-avatar'
import { EntityListBadge } from '@/components/ui/entity-list-badge'
import { deriveConnectionStatus } from '@/components/ui/source-status-indicator'
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { StyledDropdownMenuContent } from '@/components/ui/styled-dropdown'
import { DropdownMenuProvider } from '@/components/ui/menu-context'
import { useAppShellContext } from '@/context/AppShellContext'
import {
  isSkillsNavigation,
  isSourcesNavigation,
  useNavigationState,
} from '@/contexts/NavigationContext'
import { navigate, routes } from '@/lib/navigate'
import { CHAT_LAYOUT } from '@/config/layout'
import { cn } from '@/lib/utils'
import type { LoadedSkill, LoadedSource, SourceFilter } from '../../shared/types'

function sourceFilterType(filter?: SourceFilter | null): 'api' | 'mcp' | 'local' | undefined {
  return filter?.kind === 'type' ? filter.sourceType : undefined
}

export default function ResourcesHomePage() {
  const { t } = useTranslation()
  const navState = useNavigationState()
  const {
    activeWorkspaceId,
    workspaces,
    enabledSources = [],
    skills = [],
    activeSessionWorkingDirectory,
    localMcpEnabled = true,
  } = useAppShellContext()

  const activeWorkspace = React.useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null,
    [activeWorkspaceId, workspaces],
  )

  const sourceFilter = isSourcesNavigation(navState) ? navState.filter : undefined
  const activeSourceType = sourceFilterType(sourceFilter)
  const isSkillsActive = isSkillsNavigation(navState)
  const selectedSourceSlug = isSourcesNavigation(navState) ? navState.details?.sourceSlug ?? null : null
  const selectedSkillSlug = isSkillsNavigation(navState) ? navState.details?.skillSlug ?? null : null
  const [sendDialogOpen, setSendDialogOpen] = React.useState(false)
  const [sendResourceType, setSendResourceType] = React.useState<SendResourceType>('source')
  const [sendResourceSlug, setSendResourceSlug] = React.useState<string | null>(null)
  const [sendResourceLabel, setSendResourceLabel] = React.useState('')
  const hasOtherWorkspaces = workspaces.length > 1

  const sourceTypeCounts = React.useMemo(() => ({
    api: enabledSources.filter(source => source.config.type === 'api').length,
    mcp: enabledSources.filter(source => source.config.type === 'mcp').length,
    local: enabledSources.filter(source => source.config.type === 'local').length,
  }), [enabledSources])

  const handleSourceClick = React.useCallback((source: LoadedSource) => {
    navigate(routes.view.sources({
      sourceSlug: source.config.slug,
      type: activeSourceType,
    }))
  }, [activeSourceType])

  const handleSkillClick = React.useCallback((skill: LoadedSkill) => {
    navigate(routes.view.skills(skill.slug))
  }, [])

  const handleDeleteSource = React.useCallback(async (sourceSlug: string) => {
    if (!activeWorkspaceId) return
    try {
      await window.electronAPI.deleteSource(activeWorkspaceId, sourceSlug)
      toast.success(t('toast.deletedSource', { slug: sourceSlug }))
      if (selectedSourceSlug === sourceSlug) navigate(routes.view.sources({ type: activeSourceType }))
    } catch (err) {
      toast.error(t('toast.failedToDeleteSource'), {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }, [activeSourceType, activeWorkspaceId, selectedSourceSlug, t])

  const handleDeleteSkill = React.useCallback(async (skillSlug: string) => {
    if (!activeWorkspaceId) return
    try {
      await window.electronAPI.deleteSkill(activeWorkspaceId, skillSlug)
      toast.success(t('toast.deletedSkill', { slug: skillSlug }))
      if (selectedSkillSlug === skillSlug) navigate(routes.view.skills())
    } catch (err) {
      toast.error(t('toast.failedToDeleteSkill'), {
        description: err instanceof Error ? err.message : String(err),
      })
    }
  }, [activeWorkspaceId, selectedSkillSlug, t])

  const filterItems = [
    { key: 'all', label: t('common.all', 'All'), count: enabledSources.length + skills.length, active: isSourcesNavigation(navState) && !sourceFilter, onClick: () => navigate(routes.view.sources()) },
    { key: 'api', label: t('sidebar.apis'), count: sourceTypeCounts.api, active: activeSourceType === 'api', onClick: () => navigate(routes.view.sourcesApi()) },
    { key: 'mcp', label: t('sidebar.mcps'), count: sourceTypeCounts.mcp, active: activeSourceType === 'mcp', onClick: () => navigate(routes.view.sourcesMcp()) },
    { key: 'local', label: 'Local', count: sourceTypeCounts.local, active: activeSourceType === 'local', onClick: () => navigate(routes.view.sourcesLocal()) },
    { key: 'skills', label: t('sidebar.skills'), count: skills.length, active: isSkillsActive, onClick: () => navigate(routes.view.skills()) },
  ]

  const filteredSources = React.useMemo(() => {
    if (!sourceFilter) return enabledSources
    return enabledSources.filter(source => source.config.type === sourceFilter.sourceType)
  }, [enabledSources, sourceFilter])

  const openSendDialog = React.useCallback((type: SendResourceType, slug: string, label: string) => {
    setSendResourceType(type)
    setSendResourceSlug(slug)
    setSendResourceLabel(label)
    setSendDialogOpen(true)
  }, [])

  const renderSourceCard = React.useCallback((source: LoadedSource) => {
    const connectionStatus = deriveConnectionStatus(source, localMcpEnabled)
    const typeLabel = source.config.type === 'api' ? 'API' : source.config.type === 'mcp' ? 'MCP' : 'Local'
    const typeClass = source.config.type === 'api'
      ? 'bg-success/10 text-success'
      : source.config.type === 'mcp'
      ? 'bg-accent/10 text-accent'
      : 'bg-info/10 text-info'
    const statusLabel = connectionStatus === 'needs_auth'
      ? 'Auth required'
      : connectionStatus === 'failed'
      ? 'Disconnected'
      : connectionStatus === 'untested'
      ? 'Not tested'
      : connectionStatus === 'local_disabled'
      ? 'Disabled'
      : null
    const subtitle = source.config.tagline || source.config.provider || 'Source'
    const selected = selectedSourceSlug === source.config.slug

    return (
      <div
        key={source.config.slug}
        role="button"
        tabIndex={0}
        onClick={() => handleSourceClick(source)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            handleSourceClick(source)
          }
        }}
        className={cn(
          'group relative flex min-h-[112px] min-w-0 cursor-pointer flex-col rounded-[14px] border border-foreground/6 bg-background/55 p-4 text-left shadow-minimal transition-colors hover:bg-foreground/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
          selected && 'border-accent/35 bg-accent/[0.035]'
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          <SourceAvatar source={source} size="sm" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">{source.config.name}</div>
            <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{subtitle}</div>
          </div>
          <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button type="button" className="rounded-[6px] p-1 text-muted-foreground hover:bg-foreground/10 hover:text-foreground">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <StyledDropdownMenuContent align="end">
                <DropdownMenuProvider>
                  <SourceMenu
                    sourceSlug={source.config.slug}
                    sourceName={source.config.name}
                    onOpenInNewWindow={() => window.electronAPI.openUrl(`craftagents://sources/source/${source.config.slug}?window=focused`)}
                    onShowInFinder={() => window.electronAPI.showInFolder(source.folderPath)}
                    onDelete={() => handleDeleteSource(source.config.slug)}
                    onSendToWorkspace={hasOtherWorkspaces ? () => openSendDialog('source', source.config.slug, source.config.name) : undefined}
                  />
                </DropdownMenuProvider>
              </StyledDropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="mt-4 flex min-w-0 flex-wrap items-center gap-1.5">
          <EntityListBadge colorClass={typeClass}>{typeLabel}</EntityListBadge>
          {statusLabel && <EntityListBadge colorClass="bg-foreground/10 text-foreground/50">{statusLabel}</EntityListBadge>}
        </div>
      </div>
    )
  }, [handleSourceClick, hasOtherWorkspaces, localMcpEnabled, handleDeleteSource, openSendDialog, selectedSourceSlug])

  const renderSkillCard = React.useCallback((skill: LoadedSkill) => {
    const selected = selectedSkillSlug === skill.slug
    const subtitle = skill.metadata.description || 'Skill'

    return (
      <div
        key={skill.slug}
        role="button"
        tabIndex={0}
        onClick={() => handleSkillClick(skill)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            handleSkillClick(skill)
          }
        }}
        className={cn(
          'group relative flex min-h-[112px] min-w-0 cursor-pointer flex-col rounded-[14px] border border-foreground/6 bg-background/55 p-4 text-left shadow-minimal transition-colors hover:bg-foreground/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
          selected && 'border-accent/35 bg-accent/[0.035]'
        )}
      >
        <div className="flex min-w-0 items-start gap-3">
          <SkillAvatar skill={skill} size="sm" workspaceId={activeWorkspaceId ?? undefined} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">{skill.metadata.name}</div>
            <div className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">{subtitle}</div>
          </div>
          <div onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button type="button" className="rounded-[6px] p-1 text-muted-foreground hover:bg-foreground/10 hover:text-foreground">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <StyledDropdownMenuContent align="end">
                <DropdownMenuProvider>
                  <SkillMenu
                    skillSlug={skill.slug}
                    skillName={skill.metadata.name}
                    onOpenInNewWindow={() => window.electronAPI.openUrl(`craftagents://skills/skill/${skill.slug}?window=focused`)}
                    onShowInFinder={() => window.electronAPI.showInFolder(skill.path)}
                    canShowInFinder={!activeWorkspace?.remoteServer}
                    onDelete={skill.source === 'workspace' ? () => handleDeleteSkill(skill.slug) : undefined}
                    canDelete={skill.source === 'workspace'}
                    deleteLabel={skill.source === 'workspace' ? t('skillsList.deleteSkill') : t('skillsList.managedByProject')}
                    onSendToWorkspace={hasOtherWorkspaces && skill.source === 'workspace' ? () => openSendDialog('skill', skill.slug, skill.metadata.name) : undefined}
                  />
                </DropdownMenuProvider>
              </StyledDropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
        <div className="mt-4 flex min-w-0 flex-wrap items-center gap-1.5">
          <EntityListBadge colorClass="bg-info/10 text-info">Skill</EntityListBadge>
          {skill.source === 'project' && <EntityListBadge colorClass="bg-foreground/10 text-foreground/50">{t('skillsList.projectBadge')}</EntityListBadge>}
        </div>
      </div>
    )
  }, [activeWorkspace?.remoteServer, activeWorkspaceId, handleSkillClick, hasOtherWorkspaces, handleDeleteSkill, openSendDialog, selectedSkillSlug, t])

  const renderGrid = React.useCallback((items: React.ReactNode[], emptyLabel: string) => {
    if (items.length === 0) {
      return (
        <div className="rounded-[14px] border border-dashed border-foreground/10 bg-background/35 px-4 py-10 text-center text-sm text-muted-foreground">
          {emptyLabel}
        </div>
      )
    }
    return <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-2">{items}</div>
  }, [])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader
        title={t('sidebar.resources')}
        actions={activeWorkspace ? <CreateResourceDropdown workspaceRootPath={activeWorkspace.rootPath} /> : undefined}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={CHAT_LAYOUT.maxWidth + " mx-auto flex w-full min-w-0 flex-col px-5"}>
          <div className="shrink-0 pt-6 pb-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-foreground/5 text-muted-foreground">
                <DatabaseZap className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold tracking-tight text-foreground">
                  Workspace context
                </h2>
                <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">
                  Let agents connect APIs, MCP servers, local context, and skills with credentials and permissions for this workspace.
                </p>
              </div>
            </div>
            <SidebarFilterPills items={filterItems} className="mt-5 px-0 pb-0" />
          </div>

          <div className="flex min-w-0 flex-col border-t border-foreground/5 pt-4 pb-6">
            {isSourcesNavigation(navState) && !sourceFilter ? (
              <div className="flex min-w-0 flex-col gap-6">
                <section className="min-w-0 rounded-[12px]">
                  <div className="flex items-center gap-2 px-1 pb-3">
                    <DatabaseZap className="h-3.5 w-3.5 text-muted-foreground" />
                    <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {t('sidebar.sources')}
                    </h3>
                    <span className="text-[10px] text-muted-foreground/70">{enabledSources.length}</span>
                  </div>
                  {renderGrid(enabledSources.map(renderSourceCard), t('sourcesList.noSourcesConfigured'))}
                </section>
                <section className="min-w-0 rounded-[12px]">
                  <div className="flex items-center gap-2 px-1 pb-3">
                    <Zap className="h-3.5 w-3.5 text-muted-foreground" />
                    <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      {t('sidebar.skills')}
                    </h3>
                    <span className="text-[10px] text-muted-foreground/70">{skills.length}</span>
                  </div>
                  {renderGrid(skills.map(renderSkillCard), t('skillsList.noSkillsConfigured'))}
                </section>
              </div>
            ) : isSkillsActive && activeWorkspaceId ? (
              renderGrid(skills.map(renderSkillCard), t('skillsList.noSkillsConfigured'))
            ) : (
              renderGrid(filteredSources.map(renderSourceCard), t('sourcesList.noSourcesConfigured'))
            )}
          </div>
        </div>
      </div>
      {sendResourceSlug && (
        <SendResourceToWorkspaceDialog
          open={sendDialogOpen}
          onOpenChange={setSendDialogOpen}
          resourceType={sendResourceType}
          resourceIds={[sendResourceSlug]}
          resourceLabel={sendResourceLabel}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
        />
      )}
    </div>
  )
}
