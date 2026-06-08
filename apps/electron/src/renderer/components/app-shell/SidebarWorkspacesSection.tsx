import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Cloud, Folder, FolderPlus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CrossfadeAvatar } from '@/components/ui/avatar'
import { useWorkspaceIcons } from '@/hooks/useWorkspaceIcon'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  StyledDropdownMenuContent,
  StyledDropdownMenuItem,
} from '@/components/ui/styled-dropdown'
import type { SessionMeta } from '@/atoms/sessions'
import type { Workspace } from '../../../shared/types'
import type { CreationStep } from '@/components/workspace/WorkspaceCreationScreen'
import { getSessionTitle } from '@/utils/session'

const DEFAULT_VISIBLE_SESSIONS = 5

interface SidebarWorkspacesSectionProps {
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  workspaceUnreadMap?: Record<string, boolean>
  sessionsByWorkspaceId: Map<string, SessionMeta[]>
  onSelectWorkspace: (workspaceId: string) => void | Promise<void>
  onNewSession: (workspaceId: string) => void | Promise<void>
  onSelectSession: (workspaceId: string, sessionId: string) => void | Promise<void>
  onAddWorkspace: (step: CreationStep) => void
}

export function SidebarWorkspacesSection({
  workspaces,
  activeWorkspaceId,
  workspaceUnreadMap,
  sessionsByWorkspaceId,
  onSelectWorkspace,
  onNewSession,
  onSelectSession,
  onAddWorkspace,
}: SidebarWorkspacesSectionProps) {
  const { t } = useTranslation()
  const workspaceIconMap = useWorkspaceIcons(workspaces)
  const [expandedWorkspaces, setExpandedWorkspaces] = React.useState<Set<string>>(() => new Set())

  const toggleExpanded = React.useCallback((workspaceId: string) => {
    setExpandedWorkspaces(prev => {
      const next = new Set(prev)
      if (next.has(workspaceId)) next.delete(workspaceId)
      else next.add(workspaceId)
      return next
    })
  }, [])

  return (
    <section className="px-2 py-2">
      <div className="mb-1 flex items-center justify-between px-2">
        <div className="text-[11px] font-medium text-muted-foreground/70">
          {t('workspace.workspaces')}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-6 w-6 items-center justify-center rounded-[7px] text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
              aria-label={t('workspace.addWorkspace')}
            >
              <FolderPlus className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <StyledDropdownMenuContent align="end" minWidth="min-w-52">
            <StyledDropdownMenuItem onClick={() => onAddWorkspace('create')}>
              <FolderPlus className="h-3.5 w-3.5" />
              {t('workspace.createNew')}
            </StyledDropdownMenuItem>
            <StyledDropdownMenuItem onClick={() => onAddWorkspace('open')}>
              <Folder className="h-3.5 w-3.5" />
              {t('workspace.openFolder')}
            </StyledDropdownMenuItem>
            <StyledDropdownMenuItem onClick={() => onAddWorkspace('remote')}>
              <Cloud className="h-3.5 w-3.5" />
              {t('workspace.connectRemote')}
            </StyledDropdownMenuItem>
          </StyledDropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="space-y-1">
        {workspaces.map(workspace => {
          const isActive = workspace.id === activeWorkspaceId
          const allSessions = sessionsByWorkspaceId.get(workspace.id) ?? []
          const expanded = expandedWorkspaces.has(workspace.id)
          const visibleSessions = expanded ? allSessions : allSessions.slice(0, DEFAULT_VISIBLE_SESSIONS)
          const hiddenCount = Math.max(0, allSessions.length - DEFAULT_VISIBLE_SESSIONS)

          return (
            <div key={workspace.id} className="group/workspace">
              <div
                className={cn(
                  'flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-sm transition-colors',
                  isActive ? 'bg-foreground/7 text-foreground' : 'text-foreground/80 hover:bg-foreground/4 hover:text-foreground',
                )}
              >
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  onClick={() => onSelectWorkspace(workspace.id)}
                >
                  <CrossfadeAvatar
                    src={workspaceIconMap.get(workspace.id)}
                    alt={workspace.name}
                    className="h-4 w-4 shrink-0 rounded-full ring-1 ring-border/50"
                    fallbackClassName="bg-muted text-[10px] rounded-full"
                    fallback={workspace.name.charAt(0)}
                  />
                  <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                  {workspace.remoteServer && <Cloud className="h-3 w-3 shrink-0 text-muted-foreground" />}
                  {workspaceUnreadMap?.[workspace.id] && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                </button>
                <button
                  type="button"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] text-muted-foreground opacity-0 transition-opacity hover:bg-foreground/8 hover:text-foreground group-hover/workspace:opacity-100"
                  onClick={(event) => {
                    event.stopPropagation()
                    onNewSession(workspace.id)
                  }}
                  aria-label={t('session.newSession')}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {visibleSessions.length > 0 && (
                <div className="ml-6 mt-0.5 space-y-0.5 border-l border-foreground/8 pl-2">
                  {visibleSessions.map(session => (
                    <button
                      key={session.id}
                      type="button"
                      className="flex h-7 w-full items-center rounded-[7px] px-2 text-left text-[12.5px] text-foreground/70 hover:bg-foreground/4 hover:text-foreground"
                      onClick={() => onSelectSession(workspace.id, session.id)}
                    >
                      <span className="min-w-0 flex-1 truncate">{getSessionTitle(session)}</span>
                    </button>
                  ))}
                  {hiddenCount > 0 && !expanded && (
                    <button
                      type="button"
                      className="flex h-7 w-full items-center gap-1 rounded-[7px] px-2 text-left text-[12px] text-muted-foreground hover:bg-foreground/4 hover:text-foreground"
                      onClick={() => toggleExpanded(workspace.id)}
                    >
                      <ChevronDown className="h-3 w-3" />
                      {t('workspace.moreSessions', { count: hiddenCount })}
                    </button>
                  )}
                  {expanded && allSessions.length > DEFAULT_VISIBLE_SESSIONS && (
                    <button
                      type="button"
                      className="flex h-7 w-full items-center gap-1 rounded-[7px] px-2 text-left text-[12px] text-muted-foreground hover:bg-foreground/4 hover:text-foreground"
                      onClick={() => toggleExpanded(workspace.id)}
                    >
                      <ChevronRight className="h-3 w-3" />
                      {t('workspace.lessSessions')}
                    </button>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
