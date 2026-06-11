import * as React from 'react'
import { Bot, DatabaseZap, MoreHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { AgentMenu } from '@/components/app-shell/AgentMenu'
import { CreateAgentButton } from '@/components/app-shell/CreateAgentButton'
import { SidebarFilterPills } from '@/components/app-shell/SidebarFilterPills'
import { EntityListBadge } from '@/components/ui/entity-list-badge'
import { DropdownMenu, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { StyledDropdownMenuContent } from '@/components/ui/styled-dropdown'
import { DropdownMenuProvider } from '@/components/ui/menu-context'
import { useAppShellContext } from '@/context/AppShellContext'
import { CHAT_LAYOUT } from '@/config/layout'
import { navigate, routes } from '@/lib/navigate'
import { cn } from '@/lib/utils'
import { getAgentProfileKind } from '@craft-agent/shared/agent-profiles'
import type { AgentProfile, PermissionMode } from '../../shared/types'

type AgentKind = 'system' | 'template' | 'user'

const permissionLabelKeys: Record<PermissionMode, string> = {
  safe: 'agents.permissionExplore',
  ask: 'agents.permissionAsk',
  'allow-all': 'agents.permissionExecute',
}


function kindColor(kind: AgentKind): string {
  if (kind === 'user') return 'bg-primary/10 text-primary'
  if (kind === 'template') return 'bg-info/10 text-info'
  return 'bg-foreground/10 text-foreground/50'
}

function AgentAvatar({ agent, size = 'lg' }: { agent: AgentProfile; size?: 'md' | 'lg' }) {
  const className = size === 'md' ? 'h-5 w-5 text-[11px]' : 'h-7 w-7 text-xs'
  return (
    <span
      className={cn('inline-flex shrink-0 items-center justify-center rounded-[8px] font-semibold', className)}
      style={{ backgroundColor: agent.color || 'var(--foreground-5)', color: agent.color ? 'white' : undefined }}
    >
      {agent.icon || <Bot className={size === 'md' ? 'h-3.5 w-3.5' : 'h-4 w-4'} />}
    </span>
  )
}

export default function AgentsHomePage() {
  const { t } = useTranslation()
  const { activeWorkspaceId, workspaces, agentProfiles = [] } = useAppShellContext()
  const activeWorkspace = React.useMemo(
    () => workspaces.find(workspace => workspace.id === activeWorkspaceId) ?? null,
    [activeWorkspaceId, workspaces],
  )
  const [expanded, setExpanded] = React.useState(false)
  const [activeKindFilter, setActiveKindFilter] = React.useState<AgentKind | 'all'>('all')

  const visibleAgents = React.useMemo(
    () => agentProfiles.filter(agent => agent.visibility !== 'internal'),
    [agentProfiles],
  )

  const kindCounts = React.useMemo(() => ({
    system: visibleAgents.filter(agent => getAgentProfileKind(agent) === 'system').length,
    template: visibleAgents.filter(agent => getAgentProfileKind(agent) === 'template').length,
    user: visibleAgents.filter(agent => getAgentProfileKind(agent) === 'user').length,
  }), [visibleAgents])

  const filterItems = [
    { key: 'all', label: t('common.all', 'All'), count: visibleAgents.length, active: activeKindFilter === 'all', onClick: () => { setActiveKindFilter('all'); setExpanded(false) } },
    { key: 'user', label: t('agents.filterUser'), count: kindCounts.user, active: activeKindFilter === 'user', onClick: () => { setActiveKindFilter('user'); setExpanded(false) } },
    { key: 'template', label: t('agents.filterTemplates'), count: kindCounts.template, active: activeKindFilter === 'template', onClick: () => { setActiveKindFilter('template'); setExpanded(false) } },
    { key: 'system', label: t('agents.filterSystem'), count: kindCounts.system, active: activeKindFilter === 'system', onClick: () => { setActiveKindFilter('system'); setExpanded(false) } },
  ]

  const filteredAgents = React.useMemo(() => (
    activeKindFilter === 'all' ? visibleAgents : visibleAgents.filter(agent => getAgentProfileKind(agent) === activeKindFilter)
  ), [activeKindFilter, visibleAgents])


  const handleDuplicateAgent = React.useCallback(async (agent: AgentProfile) => {
    if (!activeWorkspaceId) return
    try {
      const created = await window.electronAPI.createAgentProfile(activeWorkspaceId, {
        ...agent,
        id: undefined,
        kind: 'user',
        name: t('agents.copyName', { name: agent.name }),
        visibility: 'user-selectable',
      })
      toast.success(t('agents.agentDuplicated'))
      navigate(routes.view.agents(created.id))
    } catch (err) {
      toast.error(t('agents.failedToDuplicate'), { description: err instanceof Error ? err.message : String(err) })
    }
  }, [activeWorkspaceId, t])

  const handleDeleteAgent = React.useCallback(async (agent: AgentProfile) => {
    if (!activeWorkspaceId) return
    try {
      await window.electronAPI.deleteAgentProfile(activeWorkspaceId, agent.id)
      toast.success(t('agents.agentDeleted'))
      navigate(routes.view.agents())
    } catch (err) {
      toast.error(t('agents.failedToDelete'), { description: err instanceof Error ? err.message : String(err) })
    }
  }, [activeWorkspaceId, t])

  const renderAgentCard = React.useCallback((agent: AgentProfile) => {
    const kind = getAgentProfileKind(agent)
    const summary = [
      agent.model,
      agent.permissionMode ? t(permissionLabelKeys[agent.permissionMode]) : undefined,
      agent.thinkingLevel ? t('agents.thinkLevel', { level: agent.thinkingLevel }) : undefined,
    ].filter(Boolean).join(' · ')
    const subtitle = agent.description || summary || t('agents.workspaceDefaults')

    return (
      <div
        key={agent.id}
        role="button"
        tabIndex={0}
        onClick={() => navigate(routes.view.agents(agent.id))}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            navigate(routes.view.agents(agent.id))
          }
        }}
        className="group relative flex min-h-[76px] min-w-0 cursor-pointer items-center rounded-[14px] border border-foreground/6 bg-background/55 px-3 py-2.5 text-left transition-colors hover:bg-foreground/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
      >
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-foreground/[0.04]">
          <AgentAvatar agent={agent} />
        </div>
        <div className="min-w-0 flex-1 px-3">
          <div className="flex min-w-0 items-center gap-1.5">
            <div className="truncate text-sm font-medium text-foreground">{agent.name}</div>
            <EntityListBadge colorClass={kindColor(kind)}>{t(`agents.kind.${kind}`)}</EntityListBadge>
          </div>
          <div className="mt-1 truncate text-xs leading-5 text-muted-foreground">{subtitle}</div>
        </div>
        <div className="shrink-0 self-center" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <button type="button" className="rounded-[6px] p-1 text-muted-foreground hover:bg-foreground/10 hover:text-foreground">
                <MoreHorizontal className="h-3.5 w-3.5" />
              </button>
            </DropdownMenuTrigger>
            <StyledDropdownMenuContent align="end">
              <DropdownMenuProvider>
                <AgentMenu
                  agent={agent}
                  onOpenInNewWindow={() => window.electronAPI.openUrl(`craftagents://agents/agent/${agent.id}?window=focused`)}
                  onDuplicate={() => handleDuplicateAgent(agent)}
                  onDelete={kind === 'user' ? () => handleDeleteAgent(agent) : undefined}
                  onImprove={kind !== 'system' ? () => navigate(routes.view.agents(agent.id)) : undefined}
                />
              </DropdownMenuProvider>
            </StyledDropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    )
  }, [handleDeleteAgent, handleDuplicateAgent, t])

  const visibleItems = expanded ? filteredAgents : filteredAgents.slice(0, 6)
  const hiddenItems = filteredAgents.slice(6)
  const previewItems = hiddenItems.slice(0, 2)
  const remainingCount = Math.max(hiddenItems.length - previewItems.length, 0)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <PanelHeader
        title={t('sidebar.agents')}
        actions={activeWorkspace ? <CreateAgentButton workspaceRootPath={activeWorkspace.rootPath} /> : undefined}
      />

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className={CHAT_LAYOUT.maxWidth + ' mx-auto flex w-full min-w-0 flex-col px-5'}>
          <div className="shrink-0 pt-6 pb-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] bg-foreground/5 text-muted-foreground">
                <Bot className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold tracking-tight text-foreground">{t('agents.workspaceAgentsTitle')}</h2>
                <p className="mt-1 max-w-2xl text-sm leading-5 text-muted-foreground">{t('agents.workspaceAgentsDescription')}</p>
              </div>
            </div>
            <SidebarFilterPills items={filterItems} className="mt-5 px-0 pb-0" />
          </div>

          <div className="flex min-w-0 flex-col border-t border-foreground/5 pt-4 pb-6">
            {filteredAgents.length === 0 ? (
              <div className="rounded-[14px] border border-dashed border-foreground/10 bg-background/35 px-4 py-10 text-center text-sm text-muted-foreground">
                {t('agents.noAgentsConfigured')}
              </div>
            ) : (
              <div className="grid min-w-0 grid-cols-1 gap-3 xl:grid-cols-2">
                {visibleItems.map(renderAgentCard)}
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
                          {previewItems.map(agent => (
                            <span key={agent.id} className="flex min-w-0 items-center gap-1.5">
                              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] bg-foreground/[0.04]">
                                <AgentAvatar agent={agent} size="md" />
                              </span>
                              <span className="max-w-[120px] truncate">{agent.name}</span>
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
    </div>
  )
}
