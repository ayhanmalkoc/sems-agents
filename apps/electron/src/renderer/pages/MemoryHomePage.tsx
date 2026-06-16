import * as React from 'react'
import { Brain, Check, ChevronDown, ChevronRight, Search, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { navigate, routes } from '@/lib/navigate'
import { cn } from '@/lib/utils'
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
}

type MemorySuggestion = MemoryRecord & {
  status: 'pending' | 'approved' | 'rejected'
  reason?: string
  memoryId?: string
  decidedAt?: string
  decidedBy?: string
}

type Tab = 'memories' | 'suggestions'
type Filters = { type: string; scope: string; sourceSessionId: string; status: string }

const EMPTY_FILTERS: Filters = { type: 'all', scope: 'all', sourceSessionId: '', status: 'pending' }

function badge(text: string) {
  return <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[11px] text-foreground/55">{text}</span>
}

function auditRow(label: string, value?: string) {
  if (!value) return null
  const isSession = label === 'sourceSessionId' || label === 'sessionId'
  return (
    <div className="grid gap-1 sm:grid-cols-[120px_1fr]">
      <span className="text-foreground/40">{label}</span>
      {isSession ? (
        <button type="button" className="truncate text-left text-primary hover:underline" onClick={() => navigate(routes.view.allSessions(value))}>{value}</button>
      ) : (
        <span className="truncate text-foreground/65">{value}</span>
      )}
    </div>
  )
}

function AuditDetails({ item }: { item: MemoryRecord | MemorySuggestion }) {
  const [open, setOpen] = React.useState(false)
  const suggestion = item as MemorySuggestion
  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      <button type="button" className="flex items-center gap-1 text-xs text-foreground/45 hover:text-foreground/70" onClick={() => setOpen(value => !value)}>
        {open ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}
        Audit details
      </button>
      {open && (
        <div className="mt-2 space-y-1 rounded-xl bg-foreground/[0.03] p-3 text-xs">
          {auditRow('id', item.id)}
          {auditRow('type', item.type)}
          {auditRow('scope', item.scope)}
          {auditRow('sourceSessionId', item.sourceSessionId)}
          {auditRow('sessionId', item.sessionId)}
          {auditRow('agentProfileId', item.agentProfileId)}
          {auditRow('createdBy', item.createdBy)}
          {auditRow('createdAt', item.createdAt)}
          {auditRow('updatedBy', item.updatedBy)}
          {auditRow('updatedAt', item.updatedAt)}
          {auditRow('decidedBy', suggestion.decidedBy)}
          {auditRow('decidedAt', suggestion.decidedAt)}
          {auditRow('memoryId', suggestion.memoryId)}
        </div>
      )}
    </div>
  )
}

function MemoryCard({ memory, onDelete }: { memory: MemoryRecord; onDelete: (id: string) => void }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-medium text-foreground">{memory.title}</h3>
            {badge(memory.type)}
            {badge(memory.scope)}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/70">{memory.content}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-foreground/45">
            <button type="button" className="hover:text-primary hover:underline" onClick={() => navigate(routes.view.allSessions(memory.sourceSessionId))}>source: {memory.sourceSessionId}</button>
            {memory.tags?.map(tag => <span key={tag}>#{tag}</span>)}
          </div>
          <AuditDetails item={memory} />
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-foreground/45 hover:text-destructive" onClick={() => onDelete(memory.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}

function SuggestionCard({ suggestion, onApprove, onReject }: { suggestion: MemorySuggestion; onApprove: (id: string) => void; onReject: (id: string) => void }) {
  const pending = suggestion.status === 'pending'
  const decidedLabel = suggestion.status === 'approved' ? 'Approved' : 'Rejected'
  return (
    <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-medium text-foreground">{suggestion.title}</h3>
            {badge(suggestion.status)}
            {badge(suggestion.type)}
            {badge(suggestion.scope)}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/70">{suggestion.content}</p>
          {suggestion.reason && <p className="mt-2 text-xs text-foreground/45">{suggestion.reason}</p>}
          <AuditDetails item={suggestion} />
        </div>
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
    </div>
  )
}

function selectOptions(values: string[]) {
  return ['all', ...Array.from(new Set(values.filter(Boolean))).sort()]
}

function matchesFilters(item: MemoryRecord | MemorySuggestion, filters: Filters, tab: Tab) {
  if (filters.type !== 'all' && item.type !== filters.type) return false
  if (filters.scope !== 'all' && item.scope !== filters.scope) return false
  if (filters.sourceSessionId.trim() && !item.sourceSessionId.toLowerCase().includes(filters.sourceSessionId.trim().toLowerCase())) return false
  if (tab === 'suggestions' && filters.status !== 'all' && (item as MemorySuggestion).status !== filters.status) return false
  return true
}

export default function MemoryHomePage() {
  const { activeWorkspaceId } = useAppShellContext()
  const [tab, setTab] = React.useState<Tab>('memories')
  const [query, setQuery] = React.useState('')
  const [filters, setFilters] = React.useState<Filters>(EMPTY_FILTERS)
  const [memories, setMemories] = React.useState<MemoryRecord[]>([])
  const [suggestions, setSuggestions] = React.useState<MemorySuggestion[]>([])
  const [loading, setLoading] = React.useState(false)

  const refresh = React.useCallback(async () => {
    if (!activeWorkspaceId) return
    setLoading(true)
    try {
      const [memoryRows, suggestionRows] = await Promise.all([
        query.trim() ? window.electronAPI.searchMemories(activeWorkspaceId, query.trim()) : window.electronAPI.getMemories(activeWorkspaceId),
        window.electronAPI.getMemorySuggestions(activeWorkspaceId),
      ])
      setMemories(memoryRows as MemoryRecord[])
      setSuggestions(suggestionRows as MemorySuggestion[])
    } catch (error) {
      toast.error('Failed to load memory', { description: error instanceof Error ? error.message : String(error) })
    } finally {
      setLoading(false)
    }
  }, [activeWorkspaceId, query])

  React.useEffect(() => { void refresh() }, [refresh])

  const deleteOne = async (id: string) => {
    if (!activeWorkspaceId) return
    if (!window.confirm(`Delete memory ${id}?`)) return
    await window.electronAPI.deleteMemory(activeWorkspaceId, id)
    toast.success('Memory deleted')
    void refresh()
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

  const pendingCount = suggestions.filter(item => item.status === 'pending').length
  const visibleMemories = memories.filter(memory => matchesFilters(memory, filters, 'memories'))
  const visibleSuggestions = suggestions.filter(suggestion => matchesFilters(suggestion, filters, 'suggestions'))
  const activeRows = tab === 'memories' ? memories : suggestions
  const typeOptions = selectOptions(activeRows.map(item => item.type))
  const scopeOptions = selectOptions(activeRows.map(item => item.scope))

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader title="Memory" />
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
        <div className="rounded-3xl border border-border/70 bg-card/70 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-primary/10 p-2 text-primary"><Brain className="h-5 w-5" /></div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Agent-managed memory</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-foreground/60">The agent can remember explicit instructions directly. Inferred learnings stay reviewable as scoped suggestions with audit history.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {(['memories', 'suggestions'] as Tab[]).map(item => (
              <Button key={item} size="sm" variant={tab === item ? 'default' : 'outline'} onClick={() => setTab(item)}>
                {item === 'memories' ? `Memories (${memories.length})` : `Suggestions (${pendingCount})`}
              </Button>
            ))}
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-foreground/35" />
            <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search memories" className="pl-9" />
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-border/60 bg-background/60 p-3">
          <select className="h-8 rounded-md border border-border bg-background px-2 text-xs" value={filters.type} onChange={event => setFilters(value => ({ ...value, type: event.target.value }))}>
            {typeOptions.map(value => <option key={value} value={value}>type: {value}</option>)}
          </select>
          <select className="h-8 rounded-md border border-border bg-background px-2 text-xs" value={filters.scope} onChange={event => setFilters(value => ({ ...value, scope: event.target.value }))}>
            {scopeOptions.map(value => <option key={value} value={value}>scope: {value}</option>)}
          </select>
          {tab === 'suggestions' && (
            <select className="h-8 rounded-md border border-border bg-background px-2 text-xs" value={filters.status} onChange={event => setFilters(value => ({ ...value, status: event.target.value }))}>
              {['all', 'pending', 'approved', 'rejected'].map(value => <option key={value} value={value}>status: {value}</option>)}
            </select>
          )}
          <Input value={filters.sourceSessionId} onChange={event => setFilters(value => ({ ...value, sourceSessionId: event.target.value }))} placeholder="Filter source session" className="h-8 w-48 text-xs" />
          <Button size="sm" variant="ghost" onClick={() => setFilters(EMPTY_FILTERS)}>Reset</Button>
        </div>

        <div className={cn('min-h-0 flex-1 space-y-3 overflow-auto', loading && 'opacity-60')}>
          {tab === 'memories' && (visibleMemories.length ? visibleMemories.map(memory => <MemoryCard key={memory.id} memory={memory} onDelete={deleteOne} />) : <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-foreground/50">No curated memories match.</div>)}
          {tab === 'suggestions' && (visibleSuggestions.length ? visibleSuggestions.map(suggestion => <SuggestionCard key={suggestion.id} suggestion={suggestion} onApprove={approve} onReject={reject} />) : <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-foreground/50">No memory suggestions match.</div>)}
        </div>
      </div>
    </div>
  )
}
