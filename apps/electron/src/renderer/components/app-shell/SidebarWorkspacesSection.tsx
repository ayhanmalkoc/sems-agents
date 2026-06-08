import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Cloud, Folder, FolderOpen, FolderPlus, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CrossfadeAvatar } from '@/components/ui/avatar'
import { useWorkspaceIcons } from '@/hooks/useWorkspaceIcon'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  StyledDropdownMenuContent,
  StyledDropdownMenuItem,
} from '@/components/ui/styled-dropdown'
import { DropdownMenuProvider } from '@/components/ui/menu-context'
import { SessionMenu } from './SessionMenu'
import { getSessionStatus } from '@/utils/session'
import { getStateIcon } from '@/config/session-status-config'
import { Spinner } from '@craft-agent/ui'
import { hasUnreadMeta } from '@/utils/session'
import type { SessionStatusId, SessionStatus } from '@/config/session-status-config'
import type { LabelConfig } from '@craft-agent/shared/labels'
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
  onRenameWorkspace: (workspace: Workspace, name: string) => void | Promise<void>
  onRevealWorkspace: (workspace: Workspace) => void | Promise<void>
  onRemoveWorkspace: (workspace: Workspace) => void | Promise<void>
  onNewSession: (workspaceId: string) => void | Promise<void>
  onSelectSession: (workspaceId: string, sessionId: string) => void | Promise<void>
  selectedSessionId?: string | null
  sessionStatuses: SessionStatus[]
  labels: LabelConfig[]
  onAddWorkspace: (step: CreationStep) => void
  onRenameSession: (sessionId: string, name: string) => void
  onFlagSession?: (sessionId: string) => void
  onUnflagSession?: (sessionId: string) => void
  onArchiveSession?: (sessionId: string) => void
  onUnarchiveSession?: (sessionId: string) => void
  onMarkUnread: (sessionId: string) => void
  onSessionStatusChange: (sessionId: string, state: SessionStatusId) => void
  onLabelsChange?: (sessionId: string, labels: string[]) => void
  onOpenInNewWindow: (workspaceId: string, sessionId: string) => void
  onSendToWorkspace?: (sessionIds: string[]) => void
  onDeleteSession: (sessionId: string) => Promise<boolean>
}

export function SidebarWorkspacesSection({
  workspaces,
  activeWorkspaceId,
  workspaceUnreadMap,
  sessionsByWorkspaceId,
  onSelectWorkspace,
  onRenameWorkspace,
  onRevealWorkspace,
  onRemoveWorkspace,
  onNewSession,
  onSelectSession,
  selectedSessionId,
  sessionStatuses,
  labels,
  onAddWorkspace,
  onRenameSession,
  onFlagSession,
  onUnflagSession,
  onArchiveSession,
  onUnarchiveSession,
  onMarkUnread,
  onSessionStatusChange,
  onLabelsChange,
  onOpenInNewWindow,
  onSendToWorkspace,
  onDeleteSession,
}: SidebarWorkspacesSectionProps) {
  const { t } = useTranslation()
  const workspaceIconMap = useWorkspaceIcons(workspaces)
  const [openWorkspaceIds, setOpenWorkspaceIds] = React.useState<Set<string>>(() => new Set(activeWorkspaceId ? [activeWorkspaceId] : []))
  const [expandedSessionListIds, setExpandedSessionListIds] = React.useState<Set<string>>(() => new Set())

  const toggleWorkspaceOpen = React.useCallback((workspaceId: string) => {
    setOpenWorkspaceIds(prev => {
      const next = new Set(prev)
      if (next.has(workspaceId)) next.delete(workspaceId)
      else next.add(workspaceId)
      return next
    })
  }, [])

  const toggleSessionList = React.useCallback((workspaceId: string) => {
    setExpandedSessionListIds(prev => {
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
          const isOpen = openWorkspaceIds.has(workspace.id)
          const sessionsExpanded = expandedSessionListIds.has(workspace.id)
          const visibleSessions = sessionsExpanded ? allSessions : allSessions.slice(0, DEFAULT_VISIBLE_SESSIONS)
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
                  onClick={() => {
                    if (isOpen) {
                      setOpenWorkspaceIds(prev => {
                        const next = new Set(prev)
                        next.delete(workspace.id)
                        return next
                      })
                      onSelectWorkspace(workspace.id)
                      return
                    }
                    setOpenWorkspaceIds(prev => new Set(prev).add(workspace.id))
                    const latestSession = allSessions[0]
                    if (latestSession) {
                      onSelectSession(workspace.id, latestSession.id)
                      return
                    }
                    onNewSession(workspace.id)
                  }}
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
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] text-muted-foreground opacity-0 transition-opacity hover:bg-foreground/8 hover:text-foreground group-hover/workspace:opacity-100 data-[state=open]:opacity-100"
                      onClick={(event) => event.stopPropagation()}
                      aria-label={t('common.more')}
                    >
                      <MoreHorizontal className="h-3.5 w-3.5" />
                    </button>
                  </DropdownMenuTrigger>
                  <StyledDropdownMenuContent align="end" minWidth="min-w-48">
                    <DropdownMenuProvider>
                      <StyledDropdownMenuItem
                        onClick={() => {
                          const name = window.prompt(t('workspace.renameWorkspace'), workspace.name)?.trim()
                          if (name && name !== workspace.name) onRenameWorkspace(workspace, name)
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                        {t('workspace.renameWorkspace')}
                      </StyledDropdownMenuItem>
                      {!workspace.remoteServer && workspace.rootPath && (
                        <StyledDropdownMenuItem onClick={() => onRevealWorkspace(workspace)}>
                          <FolderOpen className="h-3.5 w-3.5" />
                          {t('workspace.revealInExplorer')}
                        </StyledDropdownMenuItem>
                      )}
                      <StyledDropdownMenuItem onClick={() => onRemoveWorkspace(workspace)}>
                        <Trash2 className="h-3.5 w-3.5" />
                        {t('common.remove')}
                      </StyledDropdownMenuItem>
                    </DropdownMenuProvider>
                  </StyledDropdownMenuContent>
                </DropdownMenu>
                <button
                  type="button"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] text-muted-foreground opacity-0 transition-opacity hover:bg-foreground/8 hover:text-foreground group-hover/workspace:opacity-100"
                  onClick={(event) => {
                    event.stopPropagation()
                    setOpenWorkspaceIds(prev => new Set(prev).add(workspace.id))
                    onNewSession(workspace.id)
                  }}
                  aria-label={t('session.newSession')}
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              {isOpen && visibleSessions.length > 0 && (
                <div className="ml-6 mt-0.5 space-y-0.5 border-l border-foreground/8 pl-2">
                  {visibleSessions.map(session => {
                    const isSelected = selectedSessionId === session.id
                    return (
                    <div key={session.id} className="group/session relative flex items-center">
                      <button
                        type="button"
                        className={cn(
                          'flex h-7 w-full min-w-0 items-center gap-1.5 rounded-[7px] px-2 pr-7 text-left text-[12.5px] transition-colors',
                          isSelected ? 'bg-foreground/7 text-foreground' : 'text-foreground/70 hover:bg-foreground/4 hover:text-foreground',
                        )}
                        onClick={() => onSelectSession(workspace.id, session.id)}
                      >
                        {session.isProcessing ? <Spinner className="h-3 w-3 shrink-0" /> : <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center [&>svg]:h-3.5 [&>svg]:w-3.5">{getStateIcon(getSessionStatus(session), sessionStatuses)}</span>}
                        <span className="min-w-0 flex-1 truncate">{getSessionTitle(session)}</span>
                        {hasUnreadMeta(session) && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />}
                      </button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            type="button"
                            className="absolute right-0.5 flex h-6 w-6 items-center justify-center rounded-[7px] text-muted-foreground opacity-0 hover:bg-foreground/8 hover:text-foreground group-hover/session:opacity-100 data-[state=open]:opacity-100"
                            onClick={(event) => event.stopPropagation()}
                            aria-label={t('common.more')}
                          >
                            <MoreHorizontal className="h-3.5 w-3.5" />
                          </button>
                        </DropdownMenuTrigger>
                        <StyledDropdownMenuContent align="start">
                          <DropdownMenuProvider>
                            <SessionMenu
                              item={session}
                              sessionStatuses={sessionStatuses}
                              labels={labels}
                              onLabelsChange={onLabelsChange ? (nextLabels) => onLabelsChange(session.id, nextLabels) : undefined}
                              hasRemoteWorkspaces={workspaces.length > 1}
                              onRename={() => {
                                const nextName = window.prompt(t('chat.enterSessionName'), getSessionTitle(session))
                                if (nextName?.trim()) onRenameSession(session.id, nextName.trim())
                              }}
                              onFlag={() => onFlagSession?.(session.id)}
                              onUnflag={() => onUnflagSession?.(session.id)}
                              onArchive={() => onArchiveSession?.(session.id)}
                              onUnarchive={() => onUnarchiveSession?.(session.id)}
                              onMarkUnread={() => onMarkUnread(session.id)}
                              onSessionStatusChange={(state) => onSessionStatusChange(session.id, state)}
                              onOpenInNewWindow={() => onOpenInNewWindow(workspace.id, session.id)}
                              onSendToWorkspace={onSendToWorkspace ? () => onSendToWorkspace([session.id]) : undefined}
                              onDelete={() => { void onDeleteSession(session.id) }}
                            />
                          </DropdownMenuProvider>
                        </StyledDropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    )
                  })}
                  {hiddenCount > 0 && !sessionsExpanded && (
                    <button
                      type="button"
                      className="flex h-7 w-full items-center gap-1 rounded-[7px] px-2 text-left text-[12px] text-muted-foreground hover:bg-foreground/4 hover:text-foreground"
                      onClick={() => toggleSessionList(workspace.id)}
                    >
                      <ChevronDown className="h-3 w-3" />
                      {t('workspace.moreSessions', { count: hiddenCount })}
                    </button>
                  )}
                  {sessionsExpanded && allSessions.length > DEFAULT_VISIBLE_SESSIONS && (
                    <button
                      type="button"
                      className="flex h-7 w-full items-center gap-1 rounded-[7px] px-2 text-left text-[12px] text-muted-foreground hover:bg-foreground/4 hover:text-foreground"
                      onClick={() => toggleSessionList(workspace.id)}
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
