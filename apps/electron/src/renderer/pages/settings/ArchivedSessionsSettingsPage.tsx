import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { useAtomValue } from 'jotai'
import { Archive, ChevronRight, Trash2, RotateCcw, ExternalLink } from 'lucide-react'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { HeaderMenu } from '@/components/ui/HeaderMenu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { SettingsSection, SettingsCard } from '@/components/settings'
import { useAppShellContext } from '@/context/AppShellContext'
import { sessionMetaMapAtom, type SessionMeta } from '@/atoms/sessions'
import { getSessionTitle } from '@/utils/session'
import { routes, navigate } from '@/lib/navigate'
import { cn } from '@/lib/utils'
import type { DetailsPageMeta } from '@/lib/navigation-registry'

export const meta: DetailsPageMeta = {
  navigator: 'settings',
  slug: 'archivedSessions',
}

const formatDate = (timestamp?: number) => {
  if (!timestamp) return ''
  return new Date(timestamp).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

export default function ArchivedSessionsSettingsPage() {
  const { t } = useTranslation()
  const sessionMetaMap = useAtomValue(sessionMetaMapAtom)
  const { workspaces, onUnarchiveSession, onDeleteSession } = useAppShellContext()
  const [openWorkspaceIds, setOpenWorkspaceIds] = React.useState<Set<string>>(() => new Set(workspaces.map(workspace => workspace.id)))

  const grouped = React.useMemo(() => {
    const archived = Array.from(sessionMetaMap.values())
      .filter(session => session.isArchived && !session.hidden)
      .sort((a, b) => (b.archivedAt ?? b.lastMessageAt ?? b.createdAt ?? 0) - (a.archivedAt ?? a.lastMessageAt ?? a.createdAt ?? 0))

    return workspaces
      .map(workspace => ({
        workspace,
        sessions: archived.filter(session => session.workspaceId === workspace.id || session.workspaceId === workspace.remoteServer?.remoteWorkspaceId),
      }))
      .filter(group => group.sessions.length > 0)
  }, [sessionMetaMap, workspaces])

  const toggleWorkspace = React.useCallback((workspaceId: string) => {
    setOpenWorkspaceIds(prev => {
      const next = new Set(prev)
      if (next.has(workspaceId)) next.delete(workspaceId)
      else next.add(workspaceId)
      return next
    })
  }, [])

  const handleOpen = React.useCallback((session: SessionMeta) => {
    navigate(routes.view.archived(session.id))
  }, [])

  const handleDelete = React.useCallback((sessionId: string) => {
    void onDeleteSession(sessionId)
  }, [onDeleteSession])

  return (
    <div className="h-full flex flex-col">
      <PanelHeader title={t('settings.archivedSessions.title')} actions={<HeaderMenu route={routes.view.settings('archivedSessions')} />} />
      <div className="flex-1 min-h-0 mask-fade-y">
        <ScrollArea className="h-full">
          <div className="px-5 py-7 max-w-3xl mx-auto">
            <SettingsSection title={t('settings.archivedSessions.title')} description={t('settings.archivedSessions.description')}>
              <SettingsCard className="p-0 overflow-hidden">
                {grouped.length === 0 ? (
                  <div className="flex min-h-28 items-center gap-3 px-4 py-5 text-sm text-muted-foreground">
                    <Archive className="h-4 w-4" />
                    {t('settings.archivedSessions.empty')}
                  </div>
                ) : grouped.map(({ workspace, sessions }) => {
                  const isOpen = openWorkspaceIds.has(workspace.id)
                  return (
                    <div key={workspace.id} className="border-b border-border/60 last:border-b-0">
                      <button
                        type="button"
                        className="flex w-full items-center gap-2 px-4 py-3 text-left text-sm hover:bg-foreground/4"
                        onClick={() => toggleWorkspace(workspace.id)}
                      >
                        <ChevronRight className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', isOpen && 'rotate-90')} />
                        <span className="min-w-0 flex-1 truncate font-medium">{workspace.name}</span>
                        <span className="text-xs text-muted-foreground tabular-nums">{sessions.length}</span>
                      </button>
                      {isOpen && (
                        <div className="pb-2">
                          {sessions.map(session => (
                            <div key={session.id} className="flex items-center gap-2 px-8 py-2 text-sm hover:bg-foreground/3">
                              <button type="button" className="min-w-0 flex-1 text-left" onClick={() => handleOpen(session)}>
                                <div className="truncate font-medium text-foreground/85">{getSessionTitle(session)}</div>
                                <div className="truncate text-xs text-muted-foreground">
                                  {formatDate(session.archivedAt ?? session.lastMessageAt ?? session.createdAt)}
                                </div>
                              </button>
                              <Button variant="ghost" size="sm" onClick={() => onUnarchiveSession(session.id)}>
                                <RotateCcw className="h-3.5 w-3.5" />
                                {t('sessionMenu.unarchive')}
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleOpen(session)} aria-label={t('common.open')}>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(session.id)} aria-label={t('common.delete')}>
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </SettingsCard>
            </SettingsSection>
          </div>
        </ScrollArea>
      </div>
    </div>
  )
}
