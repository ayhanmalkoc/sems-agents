import * as React from 'react'
import { ShieldCheck, Search } from 'lucide-react'
import { toast } from 'sonner'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAppShellContext } from '@/context/AppShellContext'
import { cn } from '@/lib/utils'
import type { BuiltinHookDefinition, HookRunRecord } from '@craft-agent/shared/hooks'

type HookRow = BuiltinHookDefinition & { enabled: boolean }
type Tab = 'builtins' | 'runs' | 'policy'

function badge(text: string) {
  return <span className="rounded-full bg-foreground/[0.06] px-2 py-0.5 text-[11px] text-foreground/55">{text}</span>
}

function HookCard({ hook, onToggle }: { hook: HookRow; onToggle: (hook: HookRow) => void }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-sm font-medium text-foreground">{hook.name}</h3>
            {badge(hook.id)}
            {badge(hook.event)}
            {badge(hook.mode)}
            {badge(hook.scope)}
            {badge(hook.enabled ? 'enabled' : 'disabled')}
          </div>
          <p className="mt-2 text-sm leading-6 text-foreground/70">{hook.description}</p>
        </div>
        <Button size="sm" variant={hook.enabled ? 'outline' : 'default'} onClick={() => onToggle(hook)}>{hook.enabled ? 'Disable' : 'Enable'}</Button>
      </div>
    </div>
  )
}

function RunCard({ run }: { run: HookRunRecord }) {
  return (
    <div className="rounded-2xl border border-border/70 bg-background/80 p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-medium text-foreground">{run.hookId}</h3>
        {badge(run.event)}
        {badge(run.decision)}
        {badge(run.ok ? 'ok' : 'error')}
        {run.toolName && badge(`tool:${run.toolName}`)}
      </div>
      <p className="mt-2 text-sm text-foreground/65">{run.message || run.error || 'No message'}</p>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] text-foreground/45">
        <span>{run.id}</span>
        <span>{run.createdAt}</span>
        <span>{run.durationMs}ms</span>
        {run.sessionId && <span>session: {run.sessionId}</span>}
      </div>
    </div>
  )
}

export default function HooksHomePage() {
  const { activeWorkspaceId } = useAppShellContext()
  const [tab, setTab] = React.useState<Tab>('builtins')
  const [hooks, setHooks] = React.useState<HookRow[]>([])
  const [runs, setRuns] = React.useState<HookRunRecord[]>([])
  const [query, setQuery] = React.useState('')
  const [loading, setLoading] = React.useState(false)

  const refresh = React.useCallback(async () => {
    if (!activeWorkspaceId) return
    setLoading(true)
    try {
      const [hookRows, runRows] = await Promise.all([
        window.electronAPI.getHooks(activeWorkspaceId),
        window.electronAPI.getHookRuns(activeWorkspaceId),
      ])
      setHooks(hookRows as HookRow[])
      setRuns(runRows as HookRunRecord[])
    } catch (error) {
      toast.error('Failed to load hooks', { description: error instanceof Error ? error.message : String(error) })
    } finally {
      setLoading(false)
    }
  }, [activeWorkspaceId])

  React.useEffect(() => { void refresh() }, [refresh])

  const toggle = async (hook: HookRow) => {
    if (!activeWorkspaceId) return
    try {
      await window.electronAPI.setHookEnabled(activeWorkspaceId, hook.id, !hook.enabled)
      toast.success(`${hook.enabled ? 'Disabled' : 'Enabled'} ${hook.id}`)
      void refresh()
    } catch (error) {
      toast.error('Failed to update hook', { description: error instanceof Error ? error.message : String(error) })
    }
  }

  const visibleHooks = hooks.filter(hook => `${hook.id} ${hook.name} ${hook.event} ${hook.description}`.toLowerCase().includes(query.toLowerCase()))
  const visibleRuns = runs.filter(run => `${run.id} ${run.hookId} ${run.event} ${run.decision} ${run.message ?? ''}`.toLowerCase().includes(query.toLowerCase()))
  const enabledCount = hooks.filter(hook => hook.enabled).length

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader title="Hooks" />
      <div className="flex min-h-0 flex-1 flex-col gap-4 p-5">
        <div className="rounded-3xl border border-border/70 bg-card/70 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 flex-1 items-start gap-3">
              <div className="rounded-2xl bg-primary/10 p-2 text-primary"><ShieldCheck className="h-5 w-5" /></div>
              <div>
                <h2 className="text-base font-semibold text-foreground">Builtin lifecycle hooks</h2>
                <p className="mt-1 max-w-2xl text-sm leading-6 text-foreground/60">Hooks run at agent lifecycle points for policy, memory, audit, and validation. V1 supports builtin hooks only.</p>
              </div>
            </div>
            <div className="text-sm text-foreground/55">{enabledCount}/{hooks.length} enabled</div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-2">
            {(['builtins', 'runs', 'policy'] as Tab[]).map(item => <Button key={item} size="sm" variant={tab === item ? 'default' : 'outline'} onClick={() => setTab(item)}>{item === 'builtins' ? `Built-ins (${hooks.length})` : item === 'runs' ? `Runs (${runs.length})` : 'Policy'}</Button>)}
          </div>
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-foreground/35" />
            <Input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search hooks" className="pl-9" />
          </div>
        </div>

        <div className={cn('min-h-0 flex-1 space-y-3 overflow-auto', loading && 'opacity-60')}>
          {tab === 'builtins' && (visibleHooks.length ? visibleHooks.map(hook => <HookCard key={hook.id} hook={hook} onToggle={toggle} />) : <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-foreground/50">No hooks match.</div>)}
          {tab === 'runs' && (visibleRuns.length ? visibleRuns.map(run => <RunCard key={run.id} run={run} />) : <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm text-foreground/50">No hook runs yet.</div>)}
          {tab === 'policy' && (
            <div className="rounded-2xl border border-border/70 bg-background/80 p-5 text-sm leading-6 text-foreground/70">
              <h3 className="font-medium text-foreground">Policy</h3>
              <p className="mt-2">Builtin hooks are workspace-local lifecycle policy. They can enforce secret guards, observe prerequisite decisions, audit tool runs, and delegate memory learning to the memory runtime.</p>
              <p className="mt-2">Custom shell, HTTP, MCP, or user-authored hooks are intentionally out of scope for this phase.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
