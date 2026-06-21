import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Search, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { HeaderMenu } from '@/components/ui/HeaderMenu'
import { Button } from '@/components/ui/button'
import { EditPopover, getEditConfig } from '@/components/ui/EditPopover'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { routes } from '@/lib/navigate'
import { cn } from '@/lib/utils'
import { SettingsCard, SettingsRow, SettingsSection } from '@/components/settings'
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

type Filters = { type: string; scope: string }

const EMPTY_FILTERS: Filters = { type: 'all', scope: 'all' }

function parseMemoryEnabled(content: string): boolean {
  try {
    const prefs = JSON.parse(content || '{}')
    return prefs.memoryEnabled !== false
  } catch {
    return true
  }
}

function serializeMemoryEnabled(content: string, enabled: boolean): string {
  let prefs: Record<string, unknown> = {}
  try { prefs = JSON.parse(content || '{}') } catch { prefs = {} }
  prefs.memoryEnabled = enabled
  delete prefs.memoryAutomationMode
  delete prefs.autoSuggestMemories
  prefs.updatedAt = Date.now()
  return JSON.stringify(prefs, null, 2)
}

function badge(text: string) {
  return <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[11px] text-foreground/55">{text}</span>
}

function aiButton(label: React.ReactNode, disabled = false) {
  return <Button size="sm" variant="outline" disabled={disabled} className="gap-1.5"><Sparkles className="h-3.5 w-3.5" />{label}</Button>
}

function MemoryCard({ memory }: { memory: MemoryRecord }) {
  const [expanded, setExpanded] = React.useState(false)
  return (
    <div className={cn('group rounded-2xl border border-border/60 bg-background/70 p-4 shadow-sm transition hover:border-primary/25 hover:bg-foreground/[0.015]', expanded && 'border-primary/30 bg-foreground/[0.018]')}>
      <button type="button" className="block w-full text-left" onClick={() => setExpanded(value => !value)}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary/70" />
            <h3 className="truncate text-sm font-medium text-foreground">{memory.title}</h3>
          </div>
          <p className={cn('mt-2 text-sm leading-6 text-foreground/60', expanded ? 'whitespace-pre-wrap' : 'line-clamp-2')}>{memory.content}</p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {badge(memory.type)}
          {memory.status === 'stale' && badge('stale')}
          {memory.tags?.slice(0, expanded ? undefined : 3).map(tag => <span key={tag} className="text-[11px] text-foreground/40">#{tag}</span>)}
        </div>
      </button>
      {expanded && (
        <div className="mt-3 border-t border-border/60 pt-3 text-[11px] text-foreground/45">
          {memory.updatedAt ? 'Updated' : 'Learned'} {new Date(memory.updatedAt ?? memory.createdAt).toLocaleDateString()}
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
  const haystack = [item.title, item.content, item.type, item.scope, ...(item.tags ?? [])].join(' ').toLowerCase()
  return haystack.includes(needle)
}

export default function MemorySettingsPage() {
  const { t } = useTranslation()
  const { activeWorkspaceId, workspaces } = useAppShellContext()
  const [query, setQuery] = React.useState('')
  const [filters, setFilters] = React.useState<Filters>(EMPTY_FILTERS)
  const [memories, setMemories] = React.useState<MemoryRecord[]>([])
  const [loading, setLoading] = React.useState(false)
  const [memoryEnabled, setMemoryEnabled] = React.useState(true)
  const [preferencesContent, setPreferencesContent] = React.useState('{}')
  const activeWorkspace = React.useMemo(() => workspaces.find(workspace => workspace.id === activeWorkspaceId) ?? null, [activeWorkspaceId, workspaces])
  const workspaceRoot = activeWorkspace?.rootPath ?? ''

  const refresh = React.useCallback(async () => {
    if (!activeWorkspaceId) return
    setLoading(true)
    try {
      const [memoryRows, preferences] = await Promise.all([
        query.trim() ? window.electronAPI.searchMemories(activeWorkspaceId, query.trim()) : window.electronAPI.getMemories(activeWorkspaceId),
        window.electronAPI.readPreferences().catch(() => ({ content: '{}' })),
      ])
      setMemories(memoryRows as MemoryRecord[])
      const content = (preferences as { content?: string }).content || '{}'
      setPreferencesContent(content)
      setMemoryEnabled(parseMemoryEnabled(content))
    } catch (error) {
      toast.error(t('settings.memory.loadFailed'), { description: error instanceof Error ? error.message : String(error) })
    } finally {
      setLoading(false)
    }
  }, [activeWorkspaceId, query, t])

  React.useEffect(() => { void refresh() }, [refresh])
  React.useEffect(() => {
    const dispose = window.electronAPI.onMemoryChanged((workspaceId) => {
      if (workspaceId === activeWorkspaceId) void refresh()
    })
    const onPrefs = () => void refresh()
    window.addEventListener('craft:preferences-updated', onPrefs)
    return () => { dispose(); window.removeEventListener('craft:preferences-updated', onPrefs) }
  }, [activeWorkspaceId, refresh])

  const updateMemoryEnabled = async (enabled: boolean) => {
    const next = serializeMemoryEnabled(preferencesContent, enabled)
    const result = await window.electronAPI.writePreferences(next)
    if (result.success) {
      setPreferencesContent(next)
      setMemoryEnabled(enabled)
      window.dispatchEvent(new CustomEvent('craft:preferences-updated'))
      toast.success(enabled ? t('settings.memory.enabledToast') : t('settings.memory.disabledToast'))
    } else {
      toast.error(t('settings.memory.policyUpdateFailed'), { description: result.error })
    }
  }

  const activeMemories = React.useMemo(() => memories.filter(item => (item.status ?? 'active') === 'active'), [memories])
  const filteredMemories = React.useMemo(() => memories.filter(item => matchesFilters(item, filters) && matchesQuery(item, query)), [memories, filters, query])
  const visibleMemoryCards = filteredMemories.slice(0, 10)
  const hiddenMemoryCount = Math.max(0, filteredMemories.length - visibleMemoryCards.length)
  const typeOptions = selectOptions(memories.map(item => item.type))
  const scopeOptions = selectOptions(memories.map(item => item.scope))

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader title={t('settings.memory.title')} actions={<HeaderMenu route={routes.view.settings('memory')} />} />

      <div className="flex-1 overflow-auto">
        <div className="mx-auto w-full max-w-3xl space-y-6 p-6">
          <section className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-4 p-5">
              <div className="min-w-0">
                <h1 className="text-base font-semibold text-foreground">{t('settings.memory.workspaceMemoryTitle')}</h1>
                <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{t('settings.memory.workspaceMemoryDescription')}</p>
              </div>
              <div className="flex items-center gap-2">
                {workspaceRoot && (
                  <EditPopover trigger={aiButton(t('settings.memory.refreshMemory'), !memoryEnabled)} onInlineComplete={refresh} {...getEditConfig('memory-learn', workspaceRoot)} />
                )}
                {workspaceRoot && (
                  <EditPopover trigger={aiButton(t('settings.memory.create'), !memoryEnabled)} onInlineComplete={refresh} {...getEditConfig('memory-create', workspaceRoot)} />
                )}
              </div>
            </div>
            <div className="border-t border-border/60">
              <SettingsRow label={t('settings.memory.memoryStatusTitle')} description={memoryEnabled ? t('settings.memory.memoryOnDescription') : t('settings.memory.memoryOffDescription')}>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-foreground/55">{memoryEnabled ? t('settings.memory.memoryOn') : t('settings.memory.memoryOff')}</span>
                  <Switch checked={memoryEnabled} onCheckedChange={checked => void updateMemoryEnabled(checked)} />
                </div>
              </SettingsRow>
              <SettingsRow label={t('settings.memory.savedCount')} description={t('settings.memory.savedCountDescription', { active: activeMemories.length, total: memories.length })} />
            </div>
          </section>

          <SettingsSection title={t('settings.memory.savedMemoriesTitle')} description={t('settings.memory.savedMemoriesDescription')} action={workspaceRoot && <EditPopover trigger={aiButton(t('settings.memory.edit'), !memoryEnabled)} onInlineComplete={refresh} {...getEditConfig('memory-edit', `${workspaceRoot}::workspace memory`)} />}>
            <SettingsCard className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-2 border-b border-border/60 p-3">
                <div className="relative min-w-56 flex-1">
                  <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-foreground/35" />
                  <Input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('settings.memory.searchPlaceholder')} className="pl-9" />
                </div>
                <select className="h-8 rounded-md border border-border bg-background px-2 text-xs" value={filters.type} onChange={event => setFilters(value => ({ ...value, type: event.target.value }))}>
                  {typeOptions.map(value => <option key={value} value={value}>{value === 'all' ? t('settings.memory.filter.allTypes') : `${t('settings.memory.filter.type')}: ${value}`}</option>)}
                </select>
                <select className="h-8 rounded-md border border-border bg-background px-2 text-xs" value={filters.scope} onChange={event => setFilters(value => ({ ...value, scope: event.target.value }))}>
                  {scopeOptions.map(value => <option key={value} value={value}>{value === 'all' ? t('settings.memory.filter.allScopes') : `${t('settings.memory.filter.scope')}: ${value}`}</option>)}
                </select>
                <Button size="sm" variant="ghost" onClick={() => setFilters(EMPTY_FILTERS)}>{t('settings.memory.reset')}</Button>
              </div>
              <div className={cn('space-y-3 p-3', loading && 'opacity-60')}>
                {visibleMemoryCards.length ? visibleMemoryCards.map(memory => <MemoryCard key={memory.id} memory={memory} />) : <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-foreground/50">{t('settings.memory.noSavedMemories')}</div>}
                {hiddenMemoryCount > 0 && <div className="text-center text-xs text-foreground/45">{t('settings.memory.moreMemories', { count: hiddenMemoryCount })}</div>}
              </div>
            </SettingsCard>
          </SettingsSection>
        </div>
      </div>
    </div>
  )
}
