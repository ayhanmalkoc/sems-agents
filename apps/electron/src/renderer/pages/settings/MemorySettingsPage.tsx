import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Check, ChevronDown, ChevronRight, Search, Sparkles, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { HeaderMenu } from '@/components/ui/HeaderMenu'
import { Button } from '@/components/ui/button'
import { EditPopover, getEditConfig } from '@/components/ui/EditPopover'
import { Input } from '@/components/ui/input'
import { navigate, routes } from '@/lib/navigate'
import { cn } from '@/lib/utils'
import { SettingsCard, SettingsSection, SettingsSegmentedControl } from '@/components/settings'
import { useAppShellContext } from '@/context/AppShellContext'

type MemoryRecord = {
  id: string
  type: string
  scope: string
  title: string
  content: string
  tags?: string[]
  sourceSessionId: string
  createdAt: string
  createdBy?: string
  updatedAt?: string
  updatedBy?: string
  agentProfileId?: string
  sessionId?: string
  confidence?: string
  status?: 'active' | 'stale'
  supersedes?: string[]
}

type MemorySuggestion = Omit<MemoryRecord, 'status'> & {
  status: 'pending' | 'approved' | 'rejected'
  reason?: string
  memoryId?: string
  decidedAt?: string
  decidedBy?: string
}

type WorkingMemoryNote = {
  id: string
  scope: 'session' | 'day'
  title: string
  content: string
  tags?: string[]
  sourceSessionId: string
  createdAt: string
  createdBy?: string
  sessionId?: string
  day?: string
}

type HygieneItem = { kind: 'duplicate' | 'stale'; memoryId: string; relatedMemoryId?: string; reason: string }

type Filters = { type: string; scope: string; status: string }

const EMPTY_FILTERS: Filters = { type: 'all', scope: 'all', status: 'pending' }

type MemoryAutomationMode = 'auto' | 'review' | 'off'
function parseMemoryAutomationMode(content: string): MemoryAutomationMode {
  try {
    const prefs = JSON.parse(content || '{}')
    if (prefs.memoryAutomationMode === 'auto' || prefs.memoryAutomationMode === 'review' || prefs.memoryAutomationMode === 'off') return prefs.memoryAutomationMode
    return prefs.autoSuggestMemories === false ? 'off' : 'auto'
  } catch {
    return 'auto'
  }
}

function serializeMemoryAutomationMode(content: string, mode: MemoryAutomationMode): string {
  let prefs: Record<string, unknown> = {}
  try { prefs = JSON.parse(content || '{}') } catch { prefs = {} }
  prefs.memoryAutomationMode = mode
  delete prefs.autoSuggestMemories
  prefs.updatedAt = Date.now()
  return JSON.stringify(prefs, null, 2)
}

function modeLabel(mode: MemoryAutomationMode): string {
  if (mode === 'auto') return 'Auto-save'
  if (mode === 'review') return 'Review first'
  return 'Off'
}

function badge(text: string) {
  return <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[11px] text-foreground/55">{text}</span>
}

function aiButton(label: React.ReactNode, variant: 'default' | 'outline' = 'outline') {
  return <Button size="sm" variant={variant}><Sparkles className="h-3.5 w-3.5" />{label}</Button>
}

function MemoryCard({ memory, onDelete }: { memory: MemoryRecord; onDelete: (id: string) => void }) {
  const [expanded, setExpanded] = React.useState(false)
  return (
    <div className={cn('group rounded-2xl border border-border/60 bg-background/70 p-4 shadow-sm transition hover:border-primary/25 hover:bg-foreground/[0.015]', expanded && 'border-primary/30 bg-foreground/[0.018]')}>
      <button type="button" className="block w-full text-left" onClick={() => setExpanded(value => !value)}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 shrink-0 rounded-full bg-primary/70" />
              <h3 className="truncate text-sm font-medium text-foreground">{memory.title}</h3>
            </div>
            <p className={cn('mt-2 text-sm leading-6 text-foreground/60', expanded ? 'whitespace-pre-wrap' : 'line-clamp-2')}>{memory.content}</p>
          </div>
          <div className="flex shrink-0 items-center gap-1 opacity-0 transition group-hover:opacity-100" onClick={event => event.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground/40 hover:text-destructive" onClick={() => onDelete(memory.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {badge(memory.type)}
          {memory.status === 'stale' && badge('stale')}
          {memory.tags?.slice(0, expanded ? undefined : 3).map(tag => <span key={tag} className="text-[11px] text-foreground/40">#{tag}</span>)}
        </div>
      </button>
      {expanded && (
        <div className="mt-3 border-t border-border/60 pt-3">
          <div className="flex flex-wrap gap-2 text-[11px] text-foreground/45">
            <span>{memory.updatedAt ? 'Updated' : 'Learned'} {new Date(memory.updatedAt ?? memory.createdAt).toLocaleDateString()}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function SuggestionCard({ suggestion, onApprove, onReject }: { suggestion: MemorySuggestion; onApprove: (id: string) => void; onReject: (id: string) => void }) {
  const [expanded, setExpanded] = React.useState(false)
  const pending = suggestion.status === 'pending'
  const decidedLabel = suggestion.status === 'approved' ? 'Approved' : 'Rejected'
  return (
    <div className="rounded-2xl border border-border/60 bg-background/70 p-4 shadow-sm transition hover:border-primary/25">
      <div className="flex items-start justify-between gap-3">
        <button type="button" className="min-w-0 flex-1 text-left" onClick={() => setExpanded(value => !value)}>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">Suggestion</span>
            <h3 className="truncate text-sm font-medium text-foreground">{suggestion.title}</h3>
          </div>
          <p className={cn('mt-2 text-sm leading-6 text-foreground/60', expanded ? 'whitespace-pre-wrap' : 'line-clamp-2')}>{suggestion.content}</p>
          {suggestion.reason && <p className="mt-2 line-clamp-2 text-xs text-foreground/40">Why: {suggestion.reason}</p>}
        </button>
        <div className="flex shrink-0 gap-1">
          {pending ? (
            <>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-success" title="Approve suggestion" onClick={() => onApprove(suggestion.id)}><Check className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Reject suggestion" onClick={() => onReject(suggestion.id)}><X className="h-4 w-4" /></Button>
            </>
          ) : (
            <span className="rounded-full bg-foreground/[0.04] px-2 py-1 text-[11px] text-foreground/45">{decidedLabel}</span>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">{badge(suggestion.type)}{suggestion.confidence && badge(suggestion.confidence)}</div>
      {expanded && (
        <div className="mt-3 border-t border-border/60 pt-3">
          <div className="flex flex-wrap gap-2 text-[11px] text-foreground/45">
            <span>Review before saving to long-term memory.</span>
          </div>
        </div>
      )}
    </div>
  )
}

function buildHygieneItems(memories: MemoryRecord[]): HygieneItem[] {
  const seen = new Map<string, MemoryRecord>()
  const items: HygieneItem[] = []
  for (const memory of memories) {
    if ((memory.status ?? 'active') === 'stale') items.push({ kind: 'stale', memoryId: memory.id, reason: 'Memory is marked stale.' })
    const key = `${memory.type}:${memory.title.trim().toLowerCase()}:${memory.content.trim().toLowerCase().slice(0, 120)}`
    const related = seen.get(key)
    if (related) items.push({ kind: 'duplicate', memoryId: memory.id, relatedMemoryId: related.id, reason: 'Similar type, title, and content.' })
    else seen.set(key, memory)
  }
  return items.slice(0, 5)
}

function selectOptions(values: string[]) {
  return ['all', ...Array.from(new Set(values.filter(Boolean))).sort()]
}

function matchesFilters(item: MemoryRecord | MemorySuggestion, filters: Filters, tab: 'memories' | 'suggestions') {
  if (filters.type !== 'all' && item.type !== filters.type) return false
  if (filters.scope !== 'all' && item.scope !== filters.scope) return false
  if (tab === 'suggestions' && filters.status !== 'all' && (item as MemorySuggestion).status !== filters.status) return false
  return true
}

function matchesQuery(item: MemoryRecord | MemorySuggestion | WorkingMemoryNote, query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const haystack = [item.title, item.content, ...(item.tags ?? [])].join(' ').toLowerCase()
  return haystack.includes(needle)
}

export default function MemorySettingsPage() {
  const { t } = useTranslation()
  const { activeWorkspaceId, workspaces } = useAppShellContext()
  const [query, setQuery] = React.useState('')
  const [filters, setFilters] = React.useState<Filters>(EMPTY_FILTERS)
  const [memories, setMemories] = React.useState<MemoryRecord[]>([])
  const [suggestions, setSuggestions] = React.useState<MemorySuggestion[]>([])
  const [workingNotes, setWorkingNotes] = React.useState<WorkingMemoryNote[]>([])
  const [loading, setLoading] = React.useState(false)
  const [activityOpen, setActivityOpen] = React.useState(false)
  const [memoryMode, setMemoryMode] = React.useState<MemoryAutomationMode>('auto')
  const [preferencesContent, setPreferencesContent] = React.useState('{}')
  const activeWorkspace = React.useMemo(() => workspaces.find(workspace => workspace.id === activeWorkspaceId) ?? null, [activeWorkspaceId, workspaces])
  const workspaceRoot = activeWorkspace?.rootPath ?? ''

  const refresh = React.useCallback(async () => {
    if (!activeWorkspaceId) return
    setLoading(true)
    try {
      const [memoryRows, suggestionRows, workingRows, preferences] = await Promise.all([
        query.trim() ? window.electronAPI.searchMemories(activeWorkspaceId, query.trim()) : window.electronAPI.getMemories(activeWorkspaceId),
        window.electronAPI.getMemorySuggestions(activeWorkspaceId),
        window.electronAPI.getWorkingMemoryNotes(activeWorkspaceId),
        window.electronAPI.readPreferences().catch(() => ({ content: '{}' })),
      ])
      setMemories(memoryRows as MemoryRecord[])
      setSuggestions(suggestionRows as MemorySuggestion[])
      setWorkingNotes(workingRows as WorkingMemoryNote[])
      const content = (preferences as { content?: string }).content || '{}'
      setPreferencesContent(content)
      setMemoryMode(parseMemoryAutomationMode(content))
    } catch (error) {
      toast.error('Failed to load memory', { description: error instanceof Error ? error.message : String(error) })
    } finally {
      setLoading(false)
    }
  }, [activeWorkspaceId, query])

  React.useEffect(() => { void refresh() }, [refresh])

  React.useEffect(() => {
    const cleanup = window.electronAPI.onMemoryChanged((workspaceId) => {
      if (workspaceId !== activeWorkspaceId) return
      void refresh()
    })
    return cleanup
  }, [activeWorkspaceId, refresh])

  const deleteOne = async (id: string) => {
    if (!activeWorkspaceId) return
    if (!window.confirm(`Delete memory ${id}?`)) return
    try {
      await window.electronAPI.deleteMemory(activeWorkspaceId, id)
      toast.success('Memory deleted')
      void refresh()
    } catch (error) {
      toast.error('Failed to delete memory', { description: error instanceof Error ? error.message : String(error) })
    }
  }

  const approve = async (id: string) => {
    if (!activeWorkspaceId) return
    try {
      await window.electronAPI.approveMemorySuggestion(activeWorkspaceId, id)
      toast.success('Suggestion approved')
      void refresh()
    } catch (error) {
      toast.error('Failed to approve suggestion', { description: error instanceof Error ? error.message : String(error) })
    }
  }

  const reject = async (id: string) => {
    if (!activeWorkspaceId) return
    try {
      await window.electronAPI.rejectMemorySuggestion(activeWorkspaceId, id)
      toast.success('Suggestion rejected')
      void refresh()
    } catch (error) {
      toast.error('Failed to reject suggestion', { description: error instanceof Error ? error.message : String(error) })
    }
  }

  const clearWorking = async (scope: 'session' | 'day') => {
    if (!activeWorkspaceId) return
    try {
      const count = await window.electronAPI.clearWorkingMemoryNotes(activeWorkspaceId, scope)
      toast.success(`Cleared ${count} ${scope} working note${count === 1 ? '' : 's'}`)
      void refresh()
    } catch (error) {
      toast.error('Failed to clear working memory', { description: error instanceof Error ? error.message : String(error) })
    }
  }

  const pendingCount = suggestions.filter(item => item.status === 'pending').length
  const visibleMemories = memories.filter(memory => matchesFilters(memory, filters, 'memories') && matchesQuery(memory, query))
  const visibleSuggestions = suggestions
    .filter(suggestion => matchesFilters(suggestion, { ...filters, status: 'all' }, 'suggestions') && matchesQuery(suggestion, query))
    .sort((left, right) => (left.status === 'pending' ? 0 : 1) - (right.status === 'pending' ? 0 : 1))
  const hygieneItems = React.useMemo(() => buildHygieneItems(memories), [memories])
  const staleCount = memories.filter(memory => memory.status === 'stale').length
  const visibleMemoryCards = visibleMemories.slice(0, 10)
  const hiddenMemoryCount = Math.max(visibleMemories.length - visibleMemoryCards.length, 0)
  const activeSuggestions = visibleSuggestions.filter(suggestion => suggestion.status === 'pending')
  const suggestionHistory = visibleSuggestions.filter(suggestion => suggestion.status !== 'pending')
  const typeOptions = selectOptions(memories.map(item => item.type))
  const scopeOptions = selectOptions(memories.map(item => item.scope))

  const updateMemoryMode = async (mode: MemoryAutomationMode) => {
    const next = serializeMemoryAutomationMode(preferencesContent, mode)
    const result = await window.electronAPI.writePreferences(next)
    if (result.success) {
      setPreferencesContent(next)
      setMemoryMode(mode)
      window.dispatchEvent(new CustomEvent('craft:preferences-updated'))
      toast.success('Memory policy updated')
    } else {
      toast.error('Failed to update memory policy', { description: result.error })
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader title={t('settings.memory.title')} actions={<HeaderMenu route={routes.view.settings('memory')} />} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
          <SettingsSection title={t('settings.memory.title')} description={t('settings.memory.pageDescription')} action={workspaceRoot && (
            <div className="flex gap-2">
              <EditPopover trigger={aiButton(t('settings.memory.refreshMemory'))} onInlineComplete={refresh} {...getEditConfig('memory-learn', workspaceRoot)} />
              <EditPopover trigger={aiButton(t('settings.memory.create'), 'default')} onInlineComplete={refresh} {...getEditConfig('memory-create', workspaceRoot)} />
            </div>
          )}>
            <SettingsCard>
              <div className="grid gap-3 p-4 sm:grid-cols-4">
                <div><div className="text-lg font-semibold text-foreground">{memories.length}</div><div className="text-xs text-foreground/50">{t('settings.memory.savedMemoriesMetric')}</div></div>
                <div><div className="text-lg font-semibold text-foreground">{pendingCount}</div><div className="text-xs text-foreground/50">{t('settings.memory.pendingSuggestionsMetric')}</div></div>
                <div><div className="text-lg font-semibold text-foreground">{hygieneItems.length + staleCount}</div><div className="text-xs text-foreground/50">{t('settings.memory.needsAttentionMetric')}</div></div>
                <div><div className="text-lg font-semibold text-foreground">{modeLabel(memoryMode)}</div><div className="text-xs text-foreground/50">{t('settings.memory.automationModeMetric')}</div></div>
              </div>
            </SettingsCard>
          </SettingsSection>

          <SettingsSection title={t('settings.memory.savedMemoriesTitle')} description={t('settings.memory.savedMemoriesDescription')} action={workspaceRoot && <EditPopover trigger={aiButton(t('settings.memory.edit'))} onInlineComplete={refresh} {...getEditConfig('memory-edit', `${workspaceRoot}::workspace memory`)} />}>
            <SettingsCard className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-border/60 p-3">
                <div className="relative min-w-56 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-foreground/35" />
                  <Input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('settings.memory.searchPlaceholder')} className="pl-9" />
                </div>
                <select className="h-8 rounded-md border border-border bg-background px-2 text-xs" value={filters.type} onChange={event => setFilters(value => ({ ...value, type: event.target.value }))}>
                  {typeOptions.map(value => <option key={value} value={value}>{t('settings.memory.filter.type')}: {value}</option>)}
                </select>
                <select className="h-8 rounded-md border border-border bg-background px-2 text-xs" value={filters.scope} onChange={event => setFilters(value => ({ ...value, scope: event.target.value }))}>
                  {scopeOptions.map(value => <option key={value} value={value}>{t('settings.memory.filter.scope')}: {value}</option>)}
                </select>
                <Button size="sm" variant="ghost" onClick={() => setFilters(EMPTY_FILTERS)}>{t('settings.memory.reset')}</Button>
              </div>
              <div className={cn('space-y-3 p-3', loading && 'opacity-60')}>
                {visibleMemoryCards.length ? visibleMemoryCards.map(memory => <MemoryCard key={memory.id} memory={memory} onDelete={deleteOne} />) : <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-foreground/50">{t('settings.memory.noSavedMemories')}</div>}
                {hiddenMemoryCount > 0 && <div className="text-center text-xs text-foreground/45">{t('settings.memory.moreMemories', { count: hiddenMemoryCount })}</div>}
              </div>
            </SettingsCard>
          </SettingsSection>

          {activeSuggestions.length > 0 && (
            <SettingsSection title={t('settings.memory.suggestionsTitle')} description={t('settings.memory.suggestionsDescription')} action={workspaceRoot && <EditPopover trigger={aiButton(t('settings.memory.review'))} onInlineComplete={refresh} {...getEditConfig('memory-review', workspaceRoot)} />}>
              <SettingsCard className="p-3">
                <div className="space-y-3">
                  {activeSuggestions.map(suggestion => <SuggestionCard key={suggestion.id} suggestion={suggestion} onApprove={approve} onReject={reject} />)}
                </div>
              </SettingsCard>
            </SettingsSection>
          )}

          {(hygieneItems.length > 0 || staleCount > 0) && (
            <SettingsSection title={t('settings.memory.needsAttentionTitle')} description={t('settings.memory.needsAttentionDescription')} action={workspaceRoot && <EditPopover trigger={aiButton(t('settings.memory.reviewCleanup'))} onInlineComplete={refresh} {...getEditConfig('memory-review', workspaceRoot)} />}>
              <SettingsCard className="flex flex-wrap items-center justify-between gap-3 p-4">
                <div>
                  <div className="text-sm font-medium text-foreground">{hygieneItems.length + staleCount} cleanup suggestion{hygieneItems.length + staleCount === 1 ? '' : 's'}</div>
                  <div className="text-xs text-foreground/45">The brain found stale or overlapping knowledge. Review before changing anything.</div>
                </div>
              </SettingsCard>
            </SettingsSection>
          )}

          <SettingsSection title={t('settings.memory.activityTitle')} description={t('settings.memory.activityDescription')}>
            <SettingsCard className="overflow-hidden">
              <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-foreground/[0.02]" onClick={() => setActivityOpen(value => !value)}>
                <span className="text-foreground/45">{activityOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">Brain activity</div>
                  <div className="text-xs text-foreground/45">{workingNotes.length} temporary note{workingNotes.length === 1 ? '' : 's'} · {suggestionHistory.length} reviewed suggestion{suggestionHistory.length === 1 ? '' : 's'}</div>
                </div>
              </button>
              {activityOpen && (
                <div className="border-t border-border/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-foreground/[0.025] p-3">
                    <p className="text-xs text-foreground/50">Temporary notes are scratch context, not durable knowledge.</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => clearWorking('session')}>{t('settings.memory.clearSession')}</Button>
                      <Button size="sm" variant="outline" onClick={() => clearWorking('day')}>{t('settings.memory.clearDay')}</Button>
                    </div>
                  </div>
                </div>
              )}
            </SettingsCard>
          </SettingsSection>

          <SettingsSection title="Brain mode" description="Control how Craft learns from completed work.">
            <SettingsCard className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-foreground">Learning mode</div>
                  <div className="text-xs text-foreground/45">Current mode: {modeLabel(memoryMode)}</div>
                </div>
                <SettingsSegmentedControl
                  value={memoryMode}
                  onValueChange={value => void updateMemoryMode(value as MemoryAutomationMode)}
                  options={[
                    { value: 'auto', label: t('settings.memory.mode.auto') },
                    { value: 'review', label: t('settings.memory.mode.review') },
                    { value: 'off', label: t('settings.memory.mode.off') },
                  ]}
                />
              </div>
            </SettingsCard>
          </SettingsSection>
        </div>
      </div>
    </div>
  )
}
