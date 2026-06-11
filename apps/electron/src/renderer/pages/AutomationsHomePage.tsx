import * as React from 'react'
import { ListTodo, MoreHorizontal, Search, X } from 'lucide-react'
import { useAtomValue } from 'jotai'
import { useTranslation } from 'react-i18next'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { SidebarFilterPills } from '@/components/app-shell/SidebarFilterPills'
import { SessionSearchHeader } from '@/components/app-shell/SessionSearchHeader'
import { MultiSelectPanel } from '@/components/app-shell/MultiSelectPanel'
import { SendResourceToWorkspaceDialog } from '@/components/app-shell/SendResourceToWorkspaceDialog'
import { EditPopover, getEditConfig } from '@/components/ui/EditPopover'
import { AIAssistedButton } from '@/components/app-shell/AIAssistedButton'
import { EntityListBadge } from '@/components/ui/entity-list-badge'
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { StyledDropdownMenuContent } from '@/components/ui/styled-dropdown'
import { DropdownMenuProvider } from '@/components/ui/menu-context'
import { AutomationAvatar } from '@/components/automations/AutomationAvatar'
import { AutomationMenu } from '@/components/automations/AutomationMenu'
import { automationsAtom } from '@/atoms/automations'
import { useAppShellContext } from '@/context/AppShellContext'
import { automationSelection } from '@/hooks/useEntitySelection'
import { useNavigationState, isAutomationsNavigation } from '@/contexts/NavigationContext'
import { CHAT_LAYOUT } from '@/config/layout'
import { navigate, routes } from '@/lib/navigate'
import { cn } from '@/lib/utils'
import {
  APP_EVENTS,
  AGENT_EVENTS,
  getEventDisplayName,
  type AutomationListItem,
  type AutomationListFilter,
} from '@/components/automations/types'
import { formatShortRelativeTime } from '@/components/automations/utils'

type AutomationKindFilter = 'all' | 'scheduled' | 'app' | 'agent'

const automationFilterToKind: Record<NonNullable<AutomationListFilter['kind']>, AutomationKindFilter> = {
  all: 'all',
  scheduled: 'scheduled',
  app: 'app',
  agent: 'agent',
}

const {
  useSelection: useAutomationSelection,
  useIsMultiSelectActive: useIsAutomationMultiSelectActive,
  useSelectedIds: useAutomationSelectedIds,
  useSelectionCount: useAutomationSelectionCount,
} = automationSelection

function automationKind(automation: AutomationListItem): AutomationKindFilter {
  if (automation.event === 'SchedulerTick') return 'scheduled'
  if ((APP_EVENTS as string[]).includes(automation.event)) return 'app'
  if ((AGENT_EVENTS as string[]).includes(automation.event)) return 'agent'
  return 'app'
}

function kindColor(kind: AutomationKindFilter): string {
  if (kind === 'scheduled') return 'bg-success/10 text-success'
  if (kind === 'agent') return 'bg-info/10 text-info'
  if (kind === 'app') return 'bg-accent/10 text-accent'
  return 'bg-foreground/10 text-foreground/50'
}

function actionSummary(automation: AutomationListItem, t: (key: string) => string): string {
  const parts: string[] = []
  const promptCount = automation.actions.filter(action => action.type === 'prompt').length
  const webhookCount = automation.actions.filter(action => action.type === 'webhook').length
  if (promptCount > 0) parts.push(`${promptCount} ${t('automations.badgePrompt')}`)
  if (webhookCount > 0) parts.push(`${webhookCount} ${t('automations.badgeWebhook')}`)
  if (automation.lastExecutedAt) parts.push(formatShortRelativeTime(automation.lastExecutedAt))
  return parts.join(' · ')
}

export default function AutomationsHomePage() {
  const { t } = useTranslation()
  const navState = useNavigationState()
  const automations = useAtomValue(automationsAtom)
  const {
    activeWorkspaceId,
    workspaces,
    onTestAutomation,
    onToggleAutomation,
    onDuplicateAutomation,
    onDeleteAutomation,
  } = useAppShellContext()
  const activeWorkspace = React.useMemo(
    () => workspaces.find(workspace => workspace.id === activeWorkspaceId) ?? null,
    [activeWorkspaceId, workspaces],
  )
  const hasOtherWorkspaces = workspaces.length > 1
  const routeFilter = isAutomationsNavigation(navState) ? navState.filter : undefined
  const selectedAutomationId = isAutomationsNavigation(navState) ? navState.details?.automationId ?? null : null
  const activeKindFilter = routeFilter?.kind === 'type'
    ? automationFilterToKind[routeFilter.automationType === 'agentic' ? 'agent' : routeFilter.automationType === 'event' ? 'app' : 'scheduled']
    : 'all'

  const [expanded, setExpanded] = React.useState(false)
  const [searchActive, setSearchActive] = React.useState(false)
  const [searchQuery, setSearchQuery] = React.useState('')
  const [sendDialogOpen, setSendDialogOpen] = React.useState(false)
  const [sendResourceId, setSendResourceId] = React.useState<string | null>(null)
  const [sendResourceLabel, setSendResourceLabel] = React.useState('')

  const {
    select: selectAutomation,
    toggle: toggleAutomation,
    selectRange,
    clearMultiSelect,
  } = useAutomationSelection()
  const isAutomationMultiSelectActive = useIsAutomationMultiSelectActive()
  const selectedAutomationIds = useAutomationSelectedIds()
  const automationSelectionCount = useAutomationSelectionCount()

  const counts = React.useMemo(() => ({
    all: automations.length,
    scheduled: automations.filter(automation => automationKind(automation) === 'scheduled').length,
    app: automations.filter(automation => automationKind(automation) === 'app').length,
    agent: automations.filter(automation => automationKind(automation) === 'agent').length,
  }), [automations])

  const filterItems = [
    { key: 'all', label: t('common.all'), count: counts.all, active: activeKindFilter === 'all', onClick: () => { setExpanded(false); navigate(routes.view.automations()) } },
    { key: 'scheduled', label: t('sidebar.scheduled'), count: counts.scheduled, active: activeKindFilter === 'scheduled', onClick: () => { setExpanded(false); navigate(routes.view.automationsScheduled()) } },
    { key: 'app', label: t('sidebar.eventBased'), count: counts.app, active: activeKindFilter === 'app', onClick: () => { setExpanded(false); navigate(routes.view.automationsEvent()) } },
    { key: 'agent', label: t('sidebar.agentic'), count: counts.agent, active: activeKindFilter === 'agent', onClick: () => { setExpanded(false); navigate(routes.view.automationsAgentic()) } },
  ]

  const filteredAutomations = React.useMemo(() => {
    const byKind = activeKindFilter === 'all'
      ? automations
      : automations.filter(automation => automationKind(automation) === activeKindFilter)
    const bySearch = searchQuery.trim().length >= 2
      ? byKind.filter(automation => {
        const q = searchQuery.trim().toLowerCase()
        return automation.name.toLowerCase().includes(q)
          || automation.summary.toLowerCase().includes(q)
          || getEventDisplayName(automation.event).toLowerCase().includes(q)
      })
      : byKind
    return [...bySearch].sort((a, b) => {
      if (!a.lastExecutedAt && !b.lastExecutedAt) return 0
      if (!a.lastExecutedAt) return 1
      if (!b.lastExecutedAt) return -1
      return b.lastExecutedAt - a.lastExecutedAt
    })
  }, [activeKindFilter, automations, searchQuery])

  const visibleItems = expanded ? filteredAutomations : filteredAutomations.slice(0, 6)
  const hiddenItems = filteredAutomations.slice(6)
  const previewItems = hiddenItems.slice(0, 2)
  const remainingCount = Math.max(hiddenItems.length - previewItems.length, 0)

  const handleAutomationClick = React.useCallback((automation: AutomationListItem, index: number, event: React.MouseEvent) => {
    if ((event.metaKey || event.ctrlKey)) {
      event.preventDefault()
      toggleAutomation(automation.id, index)
      return
    }
    if (event.shiftKey) {
      event.preventDefault()
      selectRange(index, filteredAutomations.map(item => item.id))
      return
    }
    selectAutomation(automation.id, index)
    const type = routeFilter?.kind === 'type' ? routeFilter.automationType : undefined
    navigate(routes.view.automations({ automationId: automation.id, type }))
  }, [filteredAutomations, routeFilter, selectAutomation, selectRange, toggleAutomation])

  const openSendDialog = React.useCallback((automation: AutomationListItem) => {
    setSendResourceId(automation.id)
    setSendResourceLabel(automation.name)
    setSendDialogOpen(true)
  }, [])

  const handleDuplicateAutomationClick = React.useCallback(async (automation: AutomationListItem) => {
    if (!onDuplicateAutomation) return
    const duplicatedId = await onDuplicateAutomation(automation.id)
    if (!duplicatedId) return
    const type = routeFilter?.kind === 'type' ? routeFilter.automationType : undefined
    selectAutomation(duplicatedId, filteredAutomations.findIndex(item => item.id === automation.id) + 1)
    navigate(routes.view.automations({ automationId: duplicatedId, type }))
  }, [filteredAutomations, onDuplicateAutomation, routeFilter, selectAutomation])

  const renderAutomationCard = React.useCallback((automation: AutomationListItem, index: number) => {
    const kind = automationKind(automation)
    const subtitle = actionSummary(automation, t) || automation.summary
    const isInMultiSelect = isAutomationMultiSelectActive && selectedAutomationIds.has(automation.id)
    return (
      <div
        key={automation.id}
        role="button"
        tabIndex={0}
        onClick={(event) => handleAutomationClick(automation, index, event)}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            const type = routeFilter?.kind === 'type' ? routeFilter.automationType : undefined
            navigate(routes.view.automations({ automationId: automation.id, type }))
          }
        }}
        className={cn(
          'group relative flex min-h-[76px] min-w-0 cursor-pointer items-center rounded-[14px] border border-foreground/6 bg-background/55 px-3 py-2.5 text-left transition-colors hover:bg-foreground/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40',
          selectedAutomationId === automation.id && 'bg-foreground/[0.035]',
          isInMultiSelect && 'bg-foreground/5 ring-1 ring-accent/30',
          !automation.enabled && 'opacity-60',
        )}
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-foreground/[0.04]">
          <AutomationAvatar event={automation.event} size="sm" />
        </div>
        <div className="min-w-0 flex-1 px-3">
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="truncate text-sm font-medium text-foreground">{automation.name}</div>
            <EntityListBadge colorClass={kindColor(kind)}>{kind === 'agent' ? t('sidebar.agentic') : kind === 'scheduled' ? t('sidebar.scheduled') : t('sidebar.eventBased')}</EntityListBadge>
            {!automation.enabled && <EntityListBadge colorClass="bg-foreground/10 text-foreground/50">{t('automations.statusDisabled')}</EntityListBadge>}
          </div>
          <div className="mt-1 truncate text-xs leading-5 text-muted-foreground">{subtitle}</div>
        </div>
        <div className="shrink-0">
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                onClick={(event) => event.stopPropagation()}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <StyledDropdownMenuContent align="end">
              <DropdownMenuProvider>
                <AutomationMenu
                  automationId={automation.id}
                  automationName={automation.name}
                  enabled={automation.enabled}
                  onToggleEnabled={onToggleAutomation ? () => onToggleAutomation(automation.id) : undefined}
                  onTest={onTestAutomation ? () => onTestAutomation(automation.id) : undefined}
                  onDuplicate={onDuplicateAutomation ? () => { void handleDuplicateAutomationClick(automation) } : undefined}
                  onDelete={onDeleteAutomation ? () => onDeleteAutomation(automation.id) : undefined}
                  onSendToWorkspace={hasOtherWorkspaces ? () => openSendDialog(automation) : undefined}
                  onEditJson={activeWorkspace ? () => undefined : undefined}
                />
              </DropdownMenuProvider>
            </StyledDropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    )
  }, [activeWorkspace, handleAutomationClick, handleDuplicateAutomationClick, hasOtherWorkspaces, isAutomationMultiSelectActive, onDeleteAutomation, onDuplicateAutomation, onTestAutomation, onToggleAutomation, openSendDialog, routeFilter, selectedAutomationId, selectedAutomationIds, t])

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader
        title={t('sidebar.automations')}
        actions={activeWorkspace ? (
          <EditPopover
            trigger={<AIAssistedButton label={t('common.create')} data-tutorial="add-automation-button" />}
            {...getEditConfig('automation-config', activeWorkspace.rootPath)}
          />
        ) : undefined}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={CHAT_LAYOUT.maxWidth + ' mx-auto flex w-full min-w-0 flex-col px-5'}>
          <div className="shrink-0 pt-6 pb-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-foreground/5 text-muted-foreground">
                <ListTodo className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold tracking-tight text-foreground">{t('automations.workspaceAutomationsTitle')}</h2>
                <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">{t('automations.workspaceAutomationsDescription')}</p>
              </div>
              <button
                type="button"
                onClick={() => setSearchActive(value => !value)}
                className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-foreground/10 hover:text-foreground"
                aria-label={t('common.search')}
              >
                {searchActive ? <X className="h-4 w-4" /> : <Search className="h-4 w-4" />}
              </button>
            </div>
            <SidebarFilterPills items={filterItems} className="mt-5 px-0 pb-0" />
            {searchActive && (
              <div className="mt-3">
                <SessionSearchHeader
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  onSearchClose={() => { setSearchActive(false); setSearchQuery('') }}
                  placeholder={t('automations.searchPlaceholder')}
                  resultCount={searchQuery.trim().length >= 2 ? filteredAutomations.length : undefined}
                />
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col border-t border-foreground/5 pt-4 pb-6">
            {isAutomationMultiSelectActive && (
              <div className="mb-3 rounded-[14px] border border-foreground/8 bg-background/55 p-3">
                <MultiSelectPanel
                  count={automationSelectionCount}
                  entityType="automation"
                  onSendToWorkspace={hasOtherWorkspaces ? () => {
                    const ids = Array.from(selectedAutomationIds)
                    if (ids.length === 1) {
                      const automation = automations.find(item => item.id === ids[0])
                      if (automation) openSendDialog(automation)
                    }
                  } : undefined}
                  onClearSelection={clearMultiSelect}
                />
              </div>
            )}
            {filteredAutomations.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-foreground/10 bg-background/35 px-4 py-10 text-center text-sm text-muted-foreground">
                {searchQuery.trim().length >= 2 ? t('automations.noAutomationsFound') : t('automations.noAutomationsConfigured')}
              </div>
            ) : (
              <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-2">
                {visibleItems.map(renderAutomationCard)}
                {hiddenItems.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setExpanded(value => !value)}
                    className="col-span-full flex min-w-0 items-center gap-2 rounded-[12px] px-3 py-2 text-left text-xs text-muted-foreground transition-colors hover:bg-foreground/[0.035] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                  >
                    {expanded ? (
                      <span className="font-medium">{t('resources.showFewer')}</span>
                    ) : (
                      <>
                        <span className="flex min-w-0 items-center gap-2">
                          {previewItems.map(automation => (
                            <span key={automation.id} className="flex min-w-0 items-center gap-1.5">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] bg-foreground/[0.04]">
                                <AutomationAvatar event={automation.event} size="sm" />
                              </span>
                              <span className="max-w-[120px] truncate">{automation.name}</span>
                            </span>
                          ))}
                        </span>
                        {remainingCount > 0 && <span className="min-w-0 truncate">{t('resources.andMore', { count: remainingCount })}</span>}
                      </>
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {sendResourceId && (
        <SendResourceToWorkspaceDialog
          open={sendDialogOpen}
          onOpenChange={setSendDialogOpen}
          resourceType="automation"
          resourceIds={[sendResourceId]}
          resourceLabel={sendResourceLabel}
          workspaces={workspaces}
          activeWorkspaceId={activeWorkspaceId}
        />
      )}
    </div>
  )
}
