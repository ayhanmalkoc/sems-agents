import * as React from 'react'
import { Brain, Check, Search, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
}

type MemorySuggestion = MemoryRecord & {
  status: 'pending' | 'approved' | 'rejected'
  reason?: string
  memoryId?: string
}

type Tab = 'memories' | 'suggestions'

function badge(text: string) {
  return <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[11px] text-foreground/55">{text}</span>
}

function MemoryCard({ memory, onDelete }: { memory: MemoryRecord; onDelete: (id: string) => void }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-medium text-foreground">{memory.title}</h3>
            {badge(memory.type)}
            {badge(memory.scope)}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/70">{memory.content}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-foreground/45">
            <span>source: {memory.sourceSessionId}</span>
            {memory.tags?.map(tag => <span key={tag}>#{tag}</span>)}
          </div>
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
  return (
    <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-medium text-foreground">{suggestion.title}</h3>
            {badge(suggestion.status)}
            {badge(suggestion.type)}
            {badge(suggestion.scope)}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/70">{suggestion.content}</p>
          {suggestion.reason && <p className="mt-2 text-xs text-foreground/45">{suggestion.reason}</p>}
        </div>
        {pending && (
          <div className="flex shrink-0 gap-1">
            <Button variant="ghost" size="icon" className="h-8 w-8 text-success" onClick={() => onApprove(suggestion.id)}><Check className="h-4 w-4" /></Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => onReject(suggestion.id)}><X className="h-4 w-4" /></Button>
          </div>
        )}
      </div>
    </div>
  )
}

export default function MemoryHomePage() {
  const { activeWorkspaceId } = useAppShellContext()
  const [tab, setTab] = React.useState<Tab>('memories')
  const [query, setQuery] = React.useState('')
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
    await window.electronAPI.deleteMemory(activeWorkspaceId, id)
    toast.success('Memory deleted')
    void refresh()
  }

  const approve = async (id: string) => {
    if (!activeWorkspaceId) return
    await window.electronAPI.approveMemorySuggestion(activeWorkspaceId, id)
    toast.success('Suggestion approved')
    void refresh()
  }

  const reject = async (id: string) => {
    if (!activeWorkspaceId) return
    await window.electronAPI.rejectMemorySuggestion(activeWorkspaceId, id)
    toast.success('Suggestion rejected')
    void refresh()
  }

  const pendingCount = suggestions.filter(item => item.status === 'pending').length

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader title="Memory" />
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
        <div className="rounded-3xl border border-border/70 bg-card/70 p-5">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-primary/10 p-2 text-primary"><Brain className="h-5 w-5" /></div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Curated learning loop</h2>
              <p className="mt-1 max-w-2xl text-sm leading-6 text-foreground/60">Approved, scoped memories for durable project decisions, preferences, workflows, and error resolutions. Suggestions stay separate until approved.</p>
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

        <div className={cn('min-h-0 flex-1 space-y-3 overflow-auto', loading && 'opacity-60')}>
          {tab === 'memories' && (memories.length ? memories.map(memory => <MemoryCard key={memory.id} memory={memory} onDelete={deleteOne} />) : <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-foreground/50">No curated memories yet.</div>)}
          {tab === 'suggestions' && (suggestions.length ? suggestions.map(suggestion => <SuggestionCard key={suggestion.id} suggestion={suggestion} onApprove={approve} onReject={reject} />) : <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-foreground/50">No memory suggestions.</div>)}
        </div>
      </div>
    </div>
  )
}
