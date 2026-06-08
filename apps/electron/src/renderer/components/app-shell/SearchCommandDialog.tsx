import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Bot, CalendarClock, DatabaseZap, Folder, Layers, Search, Workflow, Zap } from 'lucide-react'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { getSessionTitle } from '@/utils/session'
import type { SessionMeta } from '@/atoms/sessions'
import type { AgentProfile, LoadedSkill, LoadedSource, Workspace, SessionSearchResult } from '../../../shared/types'
import type { AutomationListItem } from '../automations/types'

const GROUP_LIMIT = 5

type SearchResultKind = 'session' | 'workspace' | 'agent' | 'source' | 'skill' | 'automation'

interface SearchResult {
  id: string
  kind: SearchResultKind
  title: string
  subtitle?: string
  badge: string
  icon: React.ReactNode
  onSelect: () => void
}

interface SearchCommandDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  sessions: SessionMeta[]
  workspaces: Workspace[]
  agents: AgentProfile[]
  sources: LoadedSource[]
  skills: LoadedSkill[]
  automations: AutomationListItem[]
  activeWorkspaceId?: string
  onOpenSession: (workspaceId: string, sessionId: string) => void | Promise<void>
  onOpenWorkspace: (workspaceId: string) => void | Promise<void>
  onOpenAgent: (agentId: string) => void
  onOpenSource: (sourceSlug: string, sourceType?: 'api' | 'mcp' | 'local') => void
  onOpenSkill: (skillSlug: string) => void
  onOpenAutomation: (automationId: string) => void
}

function textMatches(query: string, ...values: Array<string | undefined | null>): boolean {
  if (!query) return true
  const haystack = values.filter(Boolean).join(' ').toLowerCase()
  return haystack.includes(query)
}

function sourceTitle(source: LoadedSource): string {
  return source.config.name || source.config.slug
}

function sourceKind(source: LoadedSource): 'api' | 'mcp' | 'local' | undefined {
  return source.config.type as 'api' | 'mcp' | 'local' | undefined
}

function skillTitle(skill: LoadedSkill): string {
  return skill.metadata?.name || skill.slug
}

function groupResults(label: string, results: SearchResult[]) {
  if (!results.length) return null
  return { label, results: results.slice(0, GROUP_LIMIT) }
}

export function SearchCommandDialog({
  open,
  onOpenChange,
  sessions,
  workspaces,
  agents,
  sources,
  skills,
  automations,
  activeWorkspaceId,
  onOpenSession,
  onOpenWorkspace,
  onOpenAgent,
  onOpenSource,
  onOpenSkill,
  onOpenAutomation,
}: SearchCommandDialogProps) {
  const { t } = useTranslation()
  const [query, setQuery] = React.useState('')
  const [activeIndex, setActiveIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [contentResults, setContentResults] = React.useState<SessionSearchResult[]>([])
  const [isSearchingContent, setIsSearchingContent] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    setQuery('')
    setActiveIndex(0)
    window.setTimeout(() => inputRef.current?.focus(), 0)
  }, [open])

  const workspaceById = React.useMemo(() => new Map(workspaces.map(workspace => [workspace.id, workspace])), [workspaces])
  const normalizedQuery = query.trim().toLowerCase()


  React.useEffect(() => {
    if (!open || !activeWorkspaceId || query.trim().length < 2) {
      setContentResults([])
      setIsSearchingContent(false)
      return
    }

    const searchId = Date.now().toString(36)
    let cancelled = false
    setIsSearchingContent(true)
    const timer = window.setTimeout(async () => {
      try {
        const results = await window.electronAPI.searchSessionContent(activeWorkspaceId, query.trim(), searchId)
        if (!cancelled) setContentResults(results)
      } catch {
        if (!cancelled) setContentResults([])
      } finally {
        if (!cancelled) setIsSearchingContent(false)
      }
    }, 150)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
      setIsSearchingContent(false)
    }
  }, [activeWorkspaceId, open, query])

  const groups = React.useMemo(() => {
    const contentResultBySessionId = new Map(contentResults.map(result => [result.sessionId, result]))
    const metadataSessions = sessions
      .filter(session => !session.hidden && !session.isArchived)
      .sort((a, b) => (b.lastMessageAt ?? b.createdAt ?? 0) - (a.lastMessageAt ?? a.createdAt ?? 0))
      .filter(session => {
        const workspace = workspaceById.get(session.workspaceId)
        return textMatches(normalizedQuery, getSessionTitle(session), session.preview, workspace?.name)
      })
      .map<SearchResult>(session => {
        const workspace = workspaceById.get(session.workspaceId)
        const contentResult = contentResultBySessionId.get(session.id)
        return {
          id: `session:${session.id}`,
          kind: 'session',
          title: getSessionTitle(session),
          subtitle: contentResult?.matches[0]?.snippet || workspace?.name || session.preview,
          badge: contentResult ? `${contentResult.matchCount} matches` : 'Session',
          icon: <Layers className="h-4 w-4" />,
          onSelect: () => onOpenSession(workspace?.id ?? session.workspaceId, session.id),
        }
      })

    const metadataSessionIds = new Set(metadataSessions.map(result => result.id.replace('session:', '')))
    const contentSessions = contentResults
      .filter(result => !metadataSessionIds.has(result.sessionId))
      .map<SearchResult | null>(result => {
        const session = sessions.find(item => item.id === result.sessionId)
        if (!session || session.hidden || session.isArchived) return null
        const workspace = workspaceById.get(session.workspaceId)
        return {
          id: `session-content:${session.id}`,
          kind: 'session',
          title: getSessionTitle(session),
          subtitle: result.matches[0]?.snippet || workspace?.name || session.preview,
          badge: `${result.matchCount} matches`,
          icon: <Layers className="h-4 w-4" />,
          onSelect: () => onOpenSession(workspace?.id ?? session.workspaceId, session.id),
        }
      })
      .filter(Boolean) as SearchResult[]

    const visibleSessions = [...metadataSessions, ...contentSessions]

    const workspaceResults = workspaces
      .filter(workspace => textMatches(normalizedQuery, workspace.name, workspace.rootPath, workspace.remoteServer?.url))
      .map<SearchResult>(workspace => ({
        id: `workspace:${workspace.id}`,
        kind: 'workspace',
        title: workspace.name,
        subtitle: workspace.remoteServer?.url || workspace.rootPath,
        badge: 'Workspace',
        icon: <Folder className="h-4 w-4" />,
        onSelect: () => onOpenWorkspace(workspace.id),
      }))

    const agentResults = agents
      .filter(agent => agent.visibility !== 'internal')
      .filter(agent => textMatches(normalizedQuery, agent.name, agent.description, agent.kind, agent.model, agent.llmConnection))
      .map<SearchResult>(agent => ({
        id: `agent:${agent.id}`,
        kind: 'agent',
        title: agent.name,
        subtitle: agent.description || agent.model || agent.kind,
        badge: 'Agent',
        icon: <Bot className="h-4 w-4" />,
        onSelect: () => onOpenAgent(agent.id),
      }))

    const sourceResults = sources
      .filter(source => !source.isBuiltin)
      .filter(source => textMatches(normalizedQuery, sourceTitle(source), source.config.tagline, source.config.slug, source.config.type))
      .map<SearchResult>(source => ({
        id: `source:${source.config.slug}`,
        kind: 'source',
        title: sourceTitle(source),
        subtitle: source.config.tagline || source.config.slug,
        badge: 'Source',
        icon: <DatabaseZap className="h-4 w-4" />,
        onSelect: () => onOpenSource(source.config.slug, sourceKind(source)),
      }))

    const skillResults = skills
      .filter(skill => textMatches(normalizedQuery, skillTitle(skill), skill.metadata?.description, skill.slug))
      .map<SearchResult>(skill => ({
        id: `skill:${skill.slug}`,
        kind: 'skill',
        title: skillTitle(skill),
        subtitle: skill.metadata?.description || skill.slug,
        badge: 'Skill',
        icon: <Zap className="h-4 w-4" />,
        onSelect: () => onOpenSkill(skill.slug),
      }))

    const automationResults = automations
      .filter(automation => textMatches(normalizedQuery, automation.name, automation.summary, automation.event, automation.matcher, automation.cron))
      .map<SearchResult>(automation => ({
        id: `automation:${automation.id}`,
        kind: 'automation',
        title: automation.name,
        subtitle: automation.summary || automation.event,
        badge: 'Automation',
        icon: automation.event === 'SchedulerTick' ? <CalendarClock className="h-4 w-4" /> : <Workflow className="h-4 w-4" />,
        onSelect: () => onOpenAutomation(automation.id),
      }))

    return [
      groupResults('Sessions', visibleSessions),
      groupResults('Workspaces', workspaceResults),
      groupResults('Agents', agentResults),
      groupResults('Sources', sourceResults),
      groupResults('Skills', skillResults),
      groupResults('Automations', automationResults),
    ].filter(Boolean) as Array<{ label: string; results: SearchResult[] }>
  }, [agents, automations, contentResults, normalizedQuery, onOpenAgent, onOpenAutomation, onOpenSession, onOpenSkill, onOpenSource, onOpenWorkspace, sessions, skills, sources, workspaceById, workspaces])

  const flatResults = React.useMemo(() => groups.flatMap(group => group.results), [groups])

  React.useEffect(() => {
    setActiveIndex(0)
  }, [query])

  const selectResult = React.useCallback((result: SearchResult | undefined) => {
    if (!result) return
    result.onSelect()
    onOpenChange(false)
  }, [onOpenChange])

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActiveIndex(index => Math.min(index + 1, Math.max(0, flatResults.length - 1)))
    } else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActiveIndex(index => Math.max(index - 1, 0))
    } else if (event.key === 'Enter') {
      event.preventDefault()
      selectResult(flatResults[activeIndex])
    }
  }

  let itemIndex = 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="gap-0 overflow-hidden p-0 sm:max-w-2xl" showCloseButton={false}>
        <DialogTitle className="sr-only">Search</DialogTitle>
        <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search sessions, chat content, workspaces, agents, sources, skills, automations..."
            className="h-8 border-0 bg-transparent px-0 shadow-none focus-visible:ring-0"
          />
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {groups.length === 0 ? (
            <div className="flex min-h-32 items-center justify-center text-sm text-muted-foreground">
              {isSearchingContent ? 'Searching sessions...' : 'No results'}
            </div>
          ) : groups.map(group => (
            <div key={group.label} className="mb-2 last:mb-0">
              <div className="px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/70">{group.label}</div>
              <div className="space-y-0.5">
                {group.results.map(result => {
                  const currentIndex = itemIndex++
                  const active = currentIndex === activeIndex
                  return (
                    <button
                      key={result.id}
                      type="button"
                      className={cn(
                        'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors',
                        active ? 'bg-foreground/7 text-foreground' : 'text-foreground/85 hover:bg-foreground/4 hover:text-foreground',
                      )}
                      onMouseEnter={() => setActiveIndex(currentIndex)}
                      onClick={() => selectResult(result)}
                    >
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-foreground/5 text-muted-foreground">{result.icon}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{result.title}</span>
                        {result.subtitle && <span className="block truncate text-xs text-muted-foreground">{result.subtitle}</span>}
                      </span>
                      <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[11px] text-muted-foreground">{result.badge}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
