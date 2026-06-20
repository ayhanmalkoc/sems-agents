import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Search, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { HeaderMenu } from '@/components/ui/HeaderMenu'
import { Button } from '@/components/ui/button'
import { EditPopover, getEditConfig } from '@/components/ui/EditPopover'
import { Input } from '@/components/ui/input'
import { navigate, routes } from '@/lib/navigate'
import { cn } from '@/lib/utils'
import { SettingsCard, SettingsRow, SettingsSection, SettingsSegmentedControl } from '@/components/settings'
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



type MemoryBrainActivity = {
  id: string
  status: 'running' | 'done' | 'failed' | 'skipped'
  reason: string
  mode: MemoryAutomationMode | 'off-as-review'
  sourceSessionIds: string[]
  startedAt: string
  completedAt?: string
  summary?: string
  error?: string
}

type Filters = { type: string; scope: string; status: string }

const EMPTY_FILTERS: Filters = { type: 'all', scope: 'all', status: 'all' }

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

function modeLabel(mode: MemoryAutomationMode, t: (key: string) => string): string {
  if (mode === 'auto') return t('settings.memory.mode.auto')
  if (mode === 'review') return t('settings.memory.mode.review')
  return t('settings.memory.mode.off')
}

function badge(text: string) {
  return <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[11px] text-foreground/55">{text}</span>
}

function aiButton(label: React.ReactNode) {
  return <Button size="sm" variant="outline"><Sparkles className="h-3.5 w-3.5" />{label}</Button>
}

function MemoryCard({ memory }: { memory: MemoryRecord }) {
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

function selectOptions(values: string[]) {
  return ['all', ...Array.from(new Set(values.filter(Boolean))).sort()]
}

function matchesFilters(item: MemoryRecord, filters: Filters) {
  if (filters.type !== 'all' && item.type !== filters.type) return false
  if (filters.scope !== 'all' && item.scope !== filters.scope) return false
  return true
}

function matchesQuery(item: MemoryRecord, query: string) {
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
  const [brainActivity, setBrainActivity] = React.useState<MemoryBrainActivity[]>([])
  const [loading, setLoading] = React.useState(false)
  const [advancedOpen, setAdvancedOpen] = React.useState<'activity' | null>(null)
  const [memoryMode, setMemoryMode] = React.useState<MemoryAutomationMode>('auto')
  const [preferencesContent, setPreferencesContent] = React.useState('{}')
  const activeWorkspace = React.useMemo(() => workspaces.find(workspace => workspace.id === activeWorkspaceId) ?? null, [activeWorkspaceId, workspaces])
  const workspaceRoot = activeWorkspace?.rootPath ?? ''

  const refresh = React.useCallback(async () => {
    if (!activeWorkspaceId) return
    setLoading(true)
    try {
      const [memoryRows, activityRows, preferences] = await Promise.all([
        query.trim() ? window.electronAPI.searchMemories(activeWorkspaceId, query.trim()) : window.electronAPI.getMemories(activeWorkspaceId),
        window.electronAPI.getMemoryBrainActivity(activeWorkspaceId),
        window.electronAPI.readPreferences().catch(() => ({ content: '{}' })),
      ])
      setMemories(memoryRows as MemoryRecord[])
      setBrainActivity(activityRows as MemoryBrainActivity[])
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




  const visibleMemories = memories.filter(memory => matchesFilters(memory, filters) && matchesQuery(memory, query))
  const visibleMemoryCards = visibleMemories.slice(0, 10)
  const hiddenMemoryCount = Math.max(visibleMemories.length - visibleMemoryCards.length, 0)
  const selectedModeDescriptionKey = memoryMode === 'auto' ? 'settings.memory.mode.autoDescription' : memoryMode === 'review' ? 'settings.memory.mode.reviewDescription' : 'settings.memory.mode.offDescription'
  const typeOptions = selectOptions(memories.map(item => item.type))
  const scopeOptions = selectOptions(memories.map(item => item.scope))

  const updateMemoryMode = async (mode: MemoryAutomationMode) => {
    const next = serializeMemoryAutomationMode(preferencesContent, mode)
    const result = await window.electronAPI.writePreferences(next)
    if (result.success) {
      setPreferencesContent(next)
      setMemoryMode(mode)
      window.dispatchEvent(new CustomEvent('craft:preferences-updated'))
      toast.success(t('settings.memory.policyUpdated'))
    } else {
      toast.error(t('settings.memory.policyUpdateFailed'), { description: result.error })
    }
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader title={t('settings.memory.title')} actions={<HeaderMenu route={routes.view.settings('memory')} />} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
          <SettingsSection
            title={t('settings.memory.title')}
            description={t('settings.memory.pageDescription')}
            action={workspaceRoot && (
              <div className="flex items-center gap-2">
                <EditPopover trigger={aiButton(t('settings.memory.refreshMemory'))} onInlineComplete={refresh} {...getEditConfig('memory-learn', workspaceRoot)} />
                <EditPopover trigger={aiButton(t('settings.memory.create'))} onInlineComplete={refresh} {...getEditConfig('memory-create', workspaceRoot)} />
              </div>
            )}
          >
            <SettingsCard>
              <SettingsRow
                label={t('settings.memory.workspaceMemoryTitle')}
                description={t('settings.memory.workspaceMemorySummary', {
                  saved: memories.length,
                  mode: modeLabel(memoryMode, t),
                })}
              />
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
                {visibleMemoryCards.length ? visibleMemoryCards.map(memory => <MemoryCard key={memory.id} memory={memory} />) : <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-foreground/50">{t('settings.memory.noSavedMemories')}</div>}
                {hiddenMemoryCount > 0 && <div className="text-center text-xs text-foreground/45">{t('settings.memory.moreMemories', { count: hiddenMemoryCount })}</div>}
              </div>
            </SettingsCard>
          </SettingsSection>



          <SettingsSection title={t('settings.memory.advancedTitle')} description={t('settings.memory.advancedDescription')}>
            <SettingsCard>
              <SettingsRow label={t('settings.memory.brainModeTitle')} description={t(selectedModeDescriptionKey)}>
                <SettingsSegmentedControl
                  value={memoryMode}
                  onValueChange={value => void updateMemoryMode(value as MemoryAutomationMode)}
                  options={[
                    { value: 'auto', label: t('settings.memory.mode.auto') },
                    { value: 'review', label: t('settings.memory.mode.review') },
                    { value: 'off', label: t('settings.memory.mode.off') },
                  ]}
                />
              </SettingsRow>
              <SettingsRow
                label={t('settings.memory.brainActivityTitle')}
                description={t('settings.memory.brainActivitySummary', { tasks: brainActivity.length, reviewed: 0 })}
                onClick={() => setAdvancedOpen(advancedOpen === 'activity' ? null : 'activity')}
                action={advancedOpen === 'activity' ? <ChevronDown className="h-4 w-4 text-foreground/40" /> : <ChevronRight className="h-4 w-4 text-foreground/40" />}
              />
              {advancedOpen === 'activity' && (
                <div className="space-y-2 border-t border-border/60 p-3">
                  {brainActivity.slice(0, 5).map(item => (
                    <div key={item.id} className="rounded-xl border border-border/60 bg-background p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-medium text-foreground">{item.reason}</div>
                          <div className="text-xs text-foreground/45">{new Date(item.startedAt).toLocaleString()} · {item.id}</div>
                        </div>
                        {badge(item.status)}
                      </div>
                      {(item.summary || item.error) && <p className="mt-2 text-xs text-foreground/55">{item.error ?? item.summary}</p>}
                    </div>
                  ))}
                  {brainActivity.length === 0 && <div className="rounded-xl border border-dashed border-border p-4 text-sm text-foreground/50">{t('settings.memory.noBrainActivity')}</div>}
                </div>
              )}

            </SettingsCard>
          </SettingsSection>
        </div>
      </div>
    </div>
  )
}
