import * as React from 'react'
import { useTranslation } from 'react-i18next'
import ReactFlow, { Background, Controls, Handle, MiniMap, Position, type Edge, type Node, type NodeProps } from 'reactflow'
import 'reactflow/dist/style.css'
import { Brain, Check, ChevronDown, ChevronRight, RotateCcw, RotateCw, Search, Sparkles, Trash2, X } from 'lucide-react'
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

type Filters = { type: string; scope: string; sourceSessionId: string; status: string }

const EMPTY_FILTERS: Filters = { type: 'all', scope: 'all', sourceSessionId: '', status: 'pending' }

type MemoryAutomationMode = 'auto' | 'review' | 'off'
type MemoryViewMode = 'map' | 'list'

const MAX_MAP_MEMORIES = 100

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
          {auditRow('confidence', item.confidence)}
          {auditRow('status', item.status)}
          {auditRow('supersedes', item.supersedes?.join(', '))}
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

function MemoryCard({ memory, workspaceRoot, onDelete, onRefresh }: { memory: MemoryRecord; workspaceRoot: string; onDelete: (id: string) => void; onRefresh: () => void }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-medium text-foreground">{memory.title}</h3>
            {badge(memory.type)}
            {badge(memory.scope)}
            {badge(memory.status ?? 'active')}
            {memory.confidence && badge(memory.confidence)}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/70">{memory.content}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-foreground/45">
            <button type="button" className="hover:text-primary hover:underline" onClick={() => navigate(routes.view.allSessions(memory.sourceSessionId))}>source: {memory.sourceSessionId}</button>
            {memory.tags?.map(tag => <span key={tag}>#{tag}</span>)}
          </div>
          <AuditDetails item={memory} />
        </div>
        <div className="flex shrink-0 gap-1">
          {workspaceRoot && (
            <EditPopover
              trigger={<Button variant="ghost" size="sm" className="h-8 px-2 text-xs">Edit</Button>}
              onInlineComplete={onRefresh}
              {...getEditConfig('memory-edit', `${workspaceRoot}::${memory.id}`)}
            />
          )}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground/45 hover:text-destructive" onClick={() => onDelete(memory.id)}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function memoryPreview(content: string, max = 72) {
  const compact = content.replace(/\s+/g, ' ').trim()
  return compact.length > max ? `${compact.slice(0, max)}…` : compact
}

function MemoryNode({ data }: NodeProps<{ memory: MemoryRecord; selected: boolean }>) {
  const memory = data.memory
  return (
    <div className="group relative">
      <div className={cn('max-w-44 rounded-full border bg-background/95 px-3 py-2 text-left shadow-sm transition duration-150', data.selected ? 'scale-[1.04] border-primary/70 shadow-lg shadow-primary/10' : 'border-border/80 hover:border-primary/35')}>
      <Handle type="target" position={Position.Left} className="!h-2 !w-2 !border-0 !bg-primary/40" />
      <div className="truncate text-xs font-semibold text-foreground">{memory.title || memory.id}</div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-primary/40" />
      </div>
      <div className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 hidden w-64 -translate-x-1/2 rounded-2xl border border-border/80 bg-background/95 p-3 text-left shadow-xl group-hover:block">
        <div className="text-xs font-semibold text-foreground">{memory.title || memory.id}</div>
        <div className="mt-1 line-clamp-3 text-[11px] leading-4 text-foreground/60">{memoryPreview(memory.content, 120)}</div>
        <div className="mt-2 flex flex-wrap gap-1">{badge(memory.type)}{badge(memory.status ?? 'active')}{memory.confidence && badge(memory.confidence)}</div>
      </div>
    </div>
  )
}

function CenterMemoryNode() {
  return (
    <div className="flex h-32 w-32 items-center justify-center rounded-full border border-primary/35 bg-primary/10 text-center shadow-lg shadow-primary/10">
      <div>
        <Brain className="mx-auto h-5 w-5 text-primary" />
        <div className="mt-2 text-xs font-semibold text-foreground">Workspace memory</div>
      </div>
      <Handle type="source" position={Position.Right} className="!h-2 !w-2 !border-0 !bg-primary/50" />
    </div>
  )
}

function buildMemoryGraph(memories: MemoryRecord[], hygieneItems: HygieneItem[], selectedId: string, rotation: number): { nodes: Node[]; edges: Edge[] } {
  const mapMemories = memories.slice(0, MAX_MAP_MEMORIES)
  const types = Array.from(new Set(mapMemories.map(memory => memory.type || 'memory'))).sort()
  const typeIndex = new Map(types.map((type, index) => [type, index]))
  const typeCounts = new Map<string, number>()
  const nodeIds = new Set(mapMemories.map(memory => memory.id))
  const nodes: Node[] = [{ id: '__workspace_memory__', type: 'center', position: { x: 0, y: 0 }, data: {}, draggable: true, selectable: true }]
  for (const memory of mapMemories) {
    const type = memory.type || 'memory'
    const clusterIndex = typeIndex.get(type) ?? 0
    const clusterCount = Math.max(types.length, 1)
    const withinTypeIndex = typeCounts.get(type) ?? 0
    typeCounts.set(type, withinTypeIndex + 1)
    const baseAngle = (clusterIndex / clusterCount) * Math.PI * 2 - Math.PI / 2 + rotation
    const spread = Math.min(1.05, Math.PI / Math.max(clusterCount, 2))
    const offset = ((withinTypeIndex % 6) - 2.5) * (spread / 5)
    const ring = 360 + Math.floor(withinTypeIndex / 6) * 230 + (withinTypeIndex % 2) * 72
    const angle = baseAngle + offset
    nodes.push({
      id: memory.id,
      type: 'memory',
      position: { x: Math.round(Math.cos(angle) * ring), y: Math.round(Math.sin(angle) * ring) },
      data: { memory, selected: memory.id === selectedId },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
    })
  }
  const edges: Edge[] = mapMemories.map(memory => ({ id: `core-${memory.id}`, source: '__workspace_memory__', target: memory.id, type: 'smoothstep', className: '!stroke-primary/15' }))
  const seen = new Set<string>()
  const addEdge = (source: string, target: string, label: string) => {
    if (source === target || !nodeIds.has(source) || !nodeIds.has(target)) return
    const key = [source, target].sort().join('::')
    if (seen.has(key)) return
    seen.add(key)
    edges.push({ id: `${label}-${key}`, source, target, label, type: 'smoothstep', className: '!stroke-border', labelStyle: { fill: 'currentColor', fontSize: 10, opacity: 0.55 } })
  }
  for (let i = 0; i < mapMemories.length; i += 1) {
    for (let j = i + 1; j < mapMemories.length; j += 1) {
      const left = mapMemories[i]
      const right = mapMemories[j]
      const tagOverlap = (left.tags ?? []).some(tag => (right.tags ?? []).includes(tag))
      if (tagOverlap) addEdge(left.id, right.id, 'tag')
      else if (left.type && left.type === right.type) addEdge(left.id, right.id, 'type')
      else if (left.sourceSessionId && left.sourceSessionId === right.sourceSessionId) addEdge(left.id, right.id, 'session')
      if (edges.length > mapMemories.length * 3) break
    }
  }
  for (const item of hygieneItems) {
    if (item.relatedMemoryId) addEdge(item.memoryId, item.relatedMemoryId, item.kind)
  }
  return { nodes, edges }
}

function FloatingMemoryDetail({ memory, workspaceRoot, onDelete, onRefresh, onClose }: { memory: MemoryRecord; workspaceRoot: string; onDelete: (id: string) => void; onRefresh: () => void; onClose: () => void }) {
  return (
    <div className="absolute right-4 top-4 z-10 w-[min(420px,calc(100%-2rem))] rounded-2xl border border-border/80 bg-background/95 p-4 shadow-2xl backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-foreground">{memory.title}</h3>
          <div className="mt-2 flex flex-wrap gap-1.5">{badge(memory.type)}{badge(memory.scope)}{badge(memory.status ?? 'active')}{memory.confidence && badge(memory.confidence)}</div>
        </div>
        <div className="flex shrink-0 gap-1">
          {workspaceRoot && <EditPopover trigger={<Button variant="ghost" size="sm" className="h-8 px-2 text-xs"><Sparkles className="h-3.5 w-3.5" />Edit</Button>} onInlineComplete={onRefresh} {...getEditConfig('memory-edit', `${workspaceRoot}::${memory.id}`)} />}
          <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground/45 hover:text-destructive" onClick={() => onDelete(memory.id)}><Trash2 className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-foreground/45" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
      </div>
      <p className="mt-3 max-h-48 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-foreground/70">{memory.content}</p>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-foreground/45">
        <button type="button" className="hover:text-primary hover:underline" onClick={() => navigate(routes.view.allSessions(memory.sourceSessionId))}>source: {memory.sourceSessionId}</button>
        {memory.tags?.map(tag => <span key={tag}>#{tag}</span>)}
      </div>
      <AuditDetails item={memory} />
    </div>
  )
}

const memoryNodeTypes = { memory: MemoryNode, center: CenterMemoryNode }

function MemoryMap({ memories, hygieneItems, workspaceRoot, onDelete, onRefresh }: { memories: MemoryRecord[]; hygieneItems: HygieneItem[]; workspaceRoot: string; onDelete: (id: string) => void; onRefresh: () => void }) {
  const [selectedId, setSelectedId] = React.useState('')
  const [rotation, setRotation] = React.useState(0)
  React.useEffect(() => {
    if (selectedId && !memories.some(memory => memory.id === selectedId)) setSelectedId('')
  }, [memories, selectedId])
  const { nodes, edges } = React.useMemo(() => buildMemoryGraph(memories, hygieneItems, selectedId, rotation), [memories, hygieneItems, selectedId, rotation])
  const selectedMemory = memories.find(memory => memory.id === selectedId)
  if (!memories.length) return <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-foreground/50">No saved memories yet</div>
  return (
    <div className="p-3">
      <div className="relative h-[640px] overflow-hidden rounded-2xl border border-border/70 bg-[radial-gradient(circle_at_center,rgba(125,125,125,0.08),transparent_55%)]">
        <div className="absolute left-4 top-4 z-10 flex gap-1 rounded-full border border-border/70 bg-background/90 p-1 shadow-sm backdrop-blur">
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Rotate left" onClick={() => setRotation(value => value - Math.PI / 12)}><RotateCcw className="h-4 w-4" /></Button>
          <Button variant="ghost" size="icon" className="h-8 w-8" title="Rotate right" onClick={() => setRotation(value => value + Math.PI / 12)}><RotateCw className="h-4 w-4" /></Button>
        </div>
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={memoryNodeTypes} fitView fitViewOptions={{ padding: 0.22 }} nodesDraggable nodesConnectable={false} elementsSelectable onNodeClick={(_, node) => node.id !== '__workspace_memory__' && setSelectedId(node.id)} onPaneClick={() => setSelectedId('')} proOptions={{ hideAttribution: true }}>
          <Background gap={28} size={1} />
          <Controls showInteractive={false} position="bottom-left" />
          <MiniMap pannable zoomable nodeStrokeWidth={3} position="bottom-right" className="!bg-background/95" />
        </ReactFlow>
        {selectedMemory && <FloatingMemoryDetail memory={selectedMemory} workspaceRoot={workspaceRoot} onDelete={onDelete} onRefresh={onRefresh} onClose={() => setSelectedId('')} />}
      </div>
      {memories.length > MAX_MAP_MEMORIES && <p className="mt-2 text-xs text-foreground/45">Showing first {MAX_MAP_MEMORIES} memories. Use search/filter for a smaller map.</p>}
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
            {suggestion.confidence && badge(suggestion.confidence)}
          </div>
          <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/70">{suggestion.content}</p>
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-foreground/45">
            <button type="button" className="hover:text-primary hover:underline" onClick={() => navigate(routes.view.allSessions(suggestion.sourceSessionId))}>source: {suggestion.sourceSessionId}</button>
            {suggestion.reason && <span>reason: {suggestion.reason}</span>}
          </div>
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


function WorkingCard({ note }: { note: WorkingMemoryNote }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="truncate text-sm font-medium text-foreground">{note.title}</h3>
        {badge(note.scope)}
        {note.day && badge(note.day)}
      </div>
      <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground/70">{note.content}</p>
      <p className="mt-2 text-xs text-foreground/45">Temporary context only. Use Review or Edit with the agent to promote durable learnings.</p>
      <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-foreground/45">
        <button type="button" className="hover:text-primary hover:underline" onClick={() => navigate(routes.view.allSessions(note.sourceSessionId))}>source: {note.sourceSessionId}</button>
        {note.tags?.map(tag => <span key={tag}>#{tag}</span>)}
      </div>
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
  if (filters.sourceSessionId.trim() && !item.sourceSessionId.toLowerCase().includes(filters.sourceSessionId.trim().toLowerCase())) return false
  if (tab === 'suggestions' && filters.status !== 'all' && (item as MemorySuggestion).status !== filters.status) return false
  return true
}

function matchesQuery(item: MemoryRecord | MemorySuggestion | WorkingMemoryNote, query: string) {
  const needle = query.trim().toLowerCase()
  if (!needle) return true
  const haystack = [item.id, item.title, item.content, item.sourceSessionId, ...(item.tags ?? [])].join(' ').toLowerCase()
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
  const [policyOpen, setPolicyOpen] = React.useState(false)
  const [memoryViewMode, setMemoryViewMode] = React.useState<MemoryViewMode>('map')
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
  const visibleWorkingNotes = workingNotes.filter(note => matchesQuery(note, query))
  const hygieneItems = React.useMemo(() => buildHygieneItems(memories), [memories])
  const staleCount = memories.filter(memory => memory.status === 'stale').length
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
                  {typeOptions.map(value => <option key={value} value={value}>type: {value}</option>)}
                </select>
                <select className="h-8 rounded-md border border-border bg-background px-2 text-xs" value={filters.scope} onChange={event => setFilters(value => ({ ...value, scope: event.target.value }))}>
                  {scopeOptions.map(value => <option key={value} value={value}>scope: {value}</option>)}
                </select>
                <Input value={filters.sourceSessionId} onChange={event => setFilters(value => ({ ...value, sourceSessionId: event.target.value }))} placeholder="Source session" className="h-8 w-40 text-xs" />
                <Button size="sm" variant="ghost" onClick={() => setFilters(EMPTY_FILTERS)}>{t('settings.memory.reset')}</Button>
                <SettingsSegmentedControl
                  value={memoryViewMode}
                  onValueChange={value => setMemoryViewMode(value as MemoryViewMode)}
                  options={[
                    { value: 'map', label: t('settings.memory.map') },
                    { value: 'list', label: t('settings.memory.list') },
                  ]}
                />
              </div>
              <div className={cn(loading && 'opacity-60')}>
                {memoryViewMode === 'map' ? (
                  <MemoryMap memories={visibleMemories} hygieneItems={hygieneItems} workspaceRoot={workspaceRoot} onDelete={deleteOne} onRefresh={refresh} />
                ) : (
                  <div className="space-y-3 p-3">
                    {visibleMemories.length ? visibleMemories.map(memory => <MemoryCard key={memory.id} memory={memory} workspaceRoot={workspaceRoot} onDelete={deleteOne} onRefresh={refresh} />) : <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-foreground/50">{t('settings.memory.noSavedMemories')}</div>}
                  </div>
                )}
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

          {hygieneItems.length > 0 && (
            <SettingsSection title={t('settings.memory.needsAttentionTitle')} description={t('settings.memory.needsAttentionDescription')} action={workspaceRoot && <EditPopover trigger={aiButton(t('settings.memory.reviewCleanup'))} onInlineComplete={refresh} {...getEditConfig('memory-review', workspaceRoot)} />}>
              <SettingsCard className="p-4 text-sm">
                <div className="space-y-1 text-xs text-foreground/60">
                  {hygieneItems.map(item => (
                    <div key={`${item.kind}-${item.memoryId}-${item.relatedMemoryId ?? ''}`}>{item.kind}: {item.memoryId}{item.relatedMemoryId ? ` ↔ ${item.relatedMemoryId}` : ''} — {item.reason}</div>
                  ))}
                </div>
              </SettingsCard>
            </SettingsSection>
          )}

          <SettingsSection title={t('settings.memory.activityTitle')} description={t('settings.memory.activityDescription')}>
            <SettingsCard className="overflow-hidden">
              <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-foreground/[0.02]" onClick={() => setActivityOpen(value => !value)}>
                <span className="text-foreground/45">{activityOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">{t('settings.memory.workingMemoryTitle')}</div>
                  <div className="text-xs text-foreground/45">{t('settings.memory.workingMemorySummary', { count: workingNotes.length })}</div>
                </div>
              </button>
              {activityOpen && (
                <div className="space-y-3 border-t border-border/60 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-foreground/[0.025] p-3">
                    <p className="text-xs text-foreground/50">{t('settings.memory.workingMemoryDescription')}</p>
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => clearWorking('session')}>{t('settings.memory.clearSession')}</Button>
                      <Button size="sm" variant="outline" onClick={() => clearWorking('day')}>{t('settings.memory.clearDay')}</Button>
                    </div>
                  </div>
                  {visibleWorkingNotes.length ? visibleWorkingNotes.map(note => <WorkingCard key={note.id} note={note} />) : <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-foreground/50">{t('settings.memory.noWorkingNotes')}</div>}
                  {suggestionHistory.length > 0 && <div className="pt-2 text-xs text-foreground/45">{suggestionHistory.length} {t('settings.memory.suggestionHistory')}</div>}
                </div>
              )}
            </SettingsCard>
          </SettingsSection>

          <SettingsSection title={t('settings.memory.policyTitle')} description={t('settings.memory.policyDescription')}>
            <SettingsCard className="overflow-hidden">
              <button type="button" className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-foreground/[0.02]" onClick={() => setPolicyOpen(value => !value)}>
                <span className="text-foreground/45">{policyOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">{t('settings.memory.memoryAutomation')}</div>
                  <div className="text-xs text-foreground/45">{t('settings.memory.currentMode', { mode: modeLabel(memoryMode) })}</div>
                </div>
              </button>
              {policyOpen && (
                <div className="border-t border-border/60 p-4">
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
              )}
            </SettingsCard>
          </SettingsSection>
        </div>
      </div>
    </div>
  )
}
