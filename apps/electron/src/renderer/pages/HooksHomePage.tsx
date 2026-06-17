import * as React from 'react'
import { ChevronDown, ChevronRight, ExternalLink, RefreshCw, ShieldCheck, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EditPopover, getEditConfig } from '@/components/ui/EditPopover'
import { Switch } from '@/components/ui/switch'
import { useAppShellContext } from '@/context/AppShellContext'
import { cn } from '@/lib/utils'
import type { BuiltinHookDefinition, CustomHookDefinition, CustomHookTrustRecord, HookRunRecord, HooksPolicy } from '@craft-agent/shared/hooks'
import { buildHookGroups, type HookListItem } from './hooks-ui-model'

type HookRow = BuiltinHookDefinition & { enabled: boolean }

type PendingTrustAction = { hook: CustomHookDefinition; enableAfterTrust: boolean } | null

function badge(text: string, tone: 'default' | 'good' | 'warn' | 'muted' = 'default') {
  return <span className={cn('rounded-full px-2 py-0.5 text-[11px]', tone === 'good' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' : tone === 'warn' ? 'bg-amber-500/10 text-amber-600 dark:text-amber-300' : tone === 'muted' ? 'bg-foreground/[0.04] text-foreground/45' : 'bg-foreground/[0.06] text-foreground/55')}>{text}</span>
}

function trustTone(status: HookListItem['trustStatus']): 'default' | 'good' | 'warn' | 'muted' {
  if (status === 'Trusted' || status === 'Built-in') return 'good'
  if (status === 'Changed' || status === 'Untrusted') return 'warn'
  return 'default'
}

function handlerSummary(hook: CustomHookDefinition): string {
  if (hook.handler.type === 'command') return `${hook.handler.executable} ${(hook.handler.args ?? []).join(' ')}`.trim()
  if (hook.handler.type === 'http') return hook.handler.url
  if (hook.handler.type === 'mcp') return `${hook.handler.target}/${hook.handler.tool}`
  return hook.handler.output?.decision ?? hook.handler.decision?.type ?? 'observe'
}

function HookDetail({ item }: { item: HookListItem }) {
  return (
    <div className="mt-3 rounded-xl border border-border/60 bg-foreground/[0.02] p-3 text-xs text-foreground/60">
      <div className="grid gap-2 sm:grid-cols-[120px_1fr]">
        <span className="text-foreground/40">Handler</span><span>{item.handlerType}</span>
        <span className="text-foreground/40">Matcher</span><span>{item.matcherSummary}</span>
        <span className="text-foreground/40">Trust</span><span>{item.trustStatus}{item.hash ? ` · ${item.hash.slice(0, 12)}` : ''}</span>
        {item.customHook && <><span className="text-foreground/40">Target</span><span className="break-all font-mono">{handlerSummary(item.customHook)}</span></>}
        {item.powers && <><span className="text-foreground/40">Powers</span><span>{item.powers.join(', ')}</span></>}
        {item.timeoutMs && <><span className="text-foreground/40">Timeout</span><span>{item.timeoutMs}ms</span></>}
        {item.lastRun && <><span className="text-foreground/40">Last run</span><span>{item.lastRun.decision} · {item.lastRun.ok ? 'ok' : 'error'} · {item.lastRun.durationMs}ms</span></>}
      </div>
    </div>
  )
}

function HookRowView({ item, workspaceRoot, onToggle, onReview }: { item: HookListItem; workspaceRoot?: string; onToggle: (item: HookListItem, checked: boolean) => void; onReview: (hook: CustomHookDefinition) => void }) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="border-t border-border/60 first:border-t-0">
      <div className="flex items-center gap-3 px-4 py-3">
        <button type="button" className="text-foreground/45 hover:text-foreground" onClick={() => setOpen(value => !value)} aria-label={open ? 'Collapse hook' : 'Expand hook'}>{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="truncate text-sm text-foreground">{item.name}</span>
            {badge(item.trustStatus, trustTone(item.trustStatus))}
            {badge(item.handlerType, 'muted')}
            {item.kind === 'custom' && item.trustStatus !== 'Trusted' && item.customHook && <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => onReview(item.customHook!)}>Review</Button>}
          </div>
          <p className="mt-1 truncate text-xs text-foreground/50">{item.matcherSummary}</p>
        </div>
        {workspaceRoot && item.kind === 'custom' && (
          <EditPopover trigger={<Button size="sm" variant="ghost">Edit</Button>} {...getEditConfig('hooks-edit', `${workspaceRoot}::${item.id}`)} />
        )}
        <Switch checked={item.enabled} onCheckedChange={checked => onToggle(item, checked)} />
      </div>
      {open && <div className="px-4 pb-4"><HookDetail item={item} /></div>}
    </div>
  )
}

export default function HooksHomePage() {
  const { activeWorkspaceId, workspaces } = useAppShellContext()
  const activeWorkspace = workspaces.find(workspace => workspace.id === activeWorkspaceId)
  const workspaceRoot = (activeWorkspace as { rootPath?: string; path?: string } | undefined)?.rootPath ?? (activeWorkspace as { path?: string } | undefined)?.path
  const [hooks, setHooks] = React.useState<HookRow[]>([])
  const [runs, setRuns] = React.useState<HookRunRecord[]>([])
  const [customHooks, setCustomHooks] = React.useState<CustomHookDefinition[]>([])
  const [trustRecords, setTrustRecords] = React.useState<CustomHookTrustRecord[]>([])
  const [policy, setPolicy] = React.useState<HooksPolicy | null>(null)
  const [loading, setLoading] = React.useState(false)
  const [policyOpen, setPolicyOpen] = React.useState(false)
  const [pendingTrust, setPendingTrust] = React.useState<PendingTrustAction>(null)

  const refresh = React.useCallback(async () => {
    if (!activeWorkspaceId) return
    setLoading(true)
    try {
      const [hookRows, runRows, policyRow, customRows] = await Promise.all([
        window.electronAPI.getHooks(activeWorkspaceId),
        window.electronAPI.getHookRuns(activeWorkspaceId),
        window.electronAPI.getHooksPolicy(activeWorkspaceId),
        window.electronAPI.getCustomHooks(activeWorkspaceId),
      ])
      const trustRows = await Promise.all((customRows as CustomHookDefinition[]).map(hook => window.electronAPI.reviewCustomHookTrust(activeWorkspaceId, hook.id).catch(() => undefined)))
      setHooks(hookRows as HookRow[])
      setRuns(runRows as HookRunRecord[])
      setPolicy(policyRow as HooksPolicy)
      setCustomHooks(customRows as CustomHookDefinition[])
      setTrustRecords(trustRows.filter(Boolean) as CustomHookTrustRecord[])
    } catch (error) {
      toast.error('Failed to load hooks', { description: error instanceof Error ? error.message : String(error) })
    } finally {
      setLoading(false)
    }
  }, [activeWorkspaceId])

  React.useEffect(() => { void refresh() }, [refresh])

  const groups = React.useMemo(() => buildHookGroups(hooks, customHooks, trustRecords, runs), [hooks, customHooks, trustRecords, runs])
  const customTrusted = groups.flatMap(group => group.hooks).filter(item => item.kind === 'custom' && item.trustStatus === 'Trusted').length
  const customUntrusted = customHooks.length - customTrusted

  const toggleHook = async (item: HookListItem, checked: boolean) => {
    if (!activeWorkspaceId) return
    if (item.kind === 'builtin') {
      await window.electronAPI.setHookEnabled(activeWorkspaceId, item.id, checked)
      toast.success(`${checked ? 'Enabled' : 'Disabled'} ${item.id}`)
      void refresh()
      return
    }
    if (!item.customHook) return
    if (checked && item.trustStatus !== 'Trusted') {
      setPendingTrust({ hook: item.customHook, enableAfterTrust: true })
      return
    }
    await window.electronAPI.saveCustomHook(activeWorkspaceId, { ...item.customHook, enabled: checked })
    toast.success(`${checked ? 'Enabled' : 'Disabled'} ${item.id}`)
    void refresh()
  }

  const trustHook = async (enable: boolean) => {
    if (!activeWorkspaceId || !pendingTrust) return
    await window.electronAPI.approveCustomHookTrust(activeWorkspaceId, pendingTrust.hook.id)
    if (enable) await window.electronAPI.saveCustomHook(activeWorkspaceId, { ...pendingTrust.hook, enabled: true })
    toast.success(enable ? 'Trusted and enabled hook' : 'Trusted hook')
    setPendingTrust(null)
    void refresh()
  }

  const updatePolicy = async <K extends keyof HooksPolicy>(key: K, value: HooksPolicy[K]) => {
    if (!activeWorkspaceId) return
    const next = await window.electronAPI.setHooksPolicy(activeWorkspaceId, { [key]: value })
    setPolicy(next as HooksPolicy)
    toast.success('Hooks policy updated')
  }

  const policySelect = <K extends keyof HooksPolicy>(key: K, values: HooksPolicy[K][]) => (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-border/60 bg-background/60 p-3 text-sm">
      <span className="text-foreground/70">{key}</span>
      <select className="h-8 rounded-md border border-border bg-background px-2 text-xs" value={policy?.[key] ?? ''} onChange={event => updatePolicy(key, event.target.value as HooksPolicy[K])}>
        {values.map(value => <option key={String(value)} value={String(value)}>{String(value)}</option>)}
      </select>
    </label>
  )

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader title="Hooks" />
      <div className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Hooks</h2>
            <p className="mt-2 text-sm text-foreground/60">Manage lifecycle hooks for workspace configuration. <button type="button" className="text-primary hover:underline">Learn more</button></p>
          </div>
          <div className="flex gap-2">
            {workspaceRoot && <EditPopover trigger={<Button size="sm"><Sparkles className="mr-1.5 h-3.5 w-3.5" />Create</Button>} onInlineComplete={refresh} {...getEditConfig('hooks-create', workspaceRoot)} />}
            <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={loading}><RefreshCw className="h-4 w-4" /></Button>
          </div>
        </div>

        <button type="button" className="rounded-2xl border border-border bg-background p-4 text-left transition hover:bg-foreground/[0.02]" onClick={() => setPolicyOpen(value => !value)}>
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-primary/10 p-2 text-primary"><ShieldCheck className="h-4 w-4" /></div>
              <div>
                <div className="text-sm font-medium text-foreground">Workspace configuration</div>
                <div className="mt-1 text-xs text-foreground/50">{hooks.length} built-ins · {customHooks.length} custom · {customTrusted} trusted · {customUntrusted} needs review</div>
              </div>
            </div>
            <ChevronRight className={cn('h-4 w-4 text-foreground/45 transition-transform', policyOpen && 'rotate-90')} />
          </div>
        </button>

        <div className={cn('min-h-0 flex-1 overflow-auto rounded-2xl border border-border bg-background', loading && 'opacity-60')}>
          {groups.length ? groups.map(group => (
            <section key={group.event} className="border-b border-border/70 last:border-b-0">
              <div className="flex items-start gap-3 px-4 py-4">
                <span className="mt-1 text-foreground/45">⌘</span>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{group.title}</h3>
                  <p className="mt-1 text-xs text-foreground/50">{group.description}</p>
                </div>
              </div>
              <div className="border-t border-border/60">
                {group.hooks.map(item => <HookRowView key={`${item.kind}:${item.id}`} item={item} workspaceRoot={workspaceRoot} onToggle={toggleHook} onReview={hook => setPendingTrust({ hook, enableAfterTrust: false })} />)}
              </div>
            </section>
          )) : <div className="p-8 text-center text-sm text-foreground/50">No hooks configured.</div>}
        </div>

        {policyOpen && policy && (
          <div className="rounded-2xl border border-border/70 bg-background/80 p-4">
            <h3 className="text-sm font-medium text-foreground">Policy</h3>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {policySelect('secretGuard', ['strict', 'standard', 'off'])}
              {policySelect('workspaceBoundary', ['block', 'ask', 'observe'])}
              {policySelect('prerequisiteGuard', ['enforce', 'observe'])}
              {policySelect('toolAudit', ['on', 'off'])}
              {policySelect('memoryLearn', ['auto', 'review', 'off'])}
              {policySelect('customHooks', ['trusted-only', 'off'])}
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!pendingTrust} onOpenChange={open => !open && setPendingTrust(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Trust custom hook?</DialogTitle>
            <DialogDescription>This hook can run only after you trust the current configuration. If it changes later, review is required again.</DialogDescription>
          </DialogHeader>
          {pendingTrust && (
            <div className="space-y-2 rounded-xl border border-border/70 bg-foreground/[0.02] p-3 text-sm">
              <div className="font-medium text-foreground">{pendingTrust.hook.name}</div>
              <div className="text-xs text-foreground/55">Handler: {pendingTrust.hook.handler.type}</div>
              <div className="text-xs text-foreground/55">Event: {pendingTrust.hook.matcher.event}</div>
              <div className="text-xs text-foreground/55">Powers: {pendingTrust.hook.powers.join(', ')}</div>
              <div className="text-xs text-foreground/55">Timeout: {pendingTrust.hook.timeoutMs ?? policy?.customMaxDurationMs ?? 2000}ms</div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPendingTrust(null)}>Cancel</Button>
            <Button variant="outline" onClick={() => void trustHook(false)}>Trust Only</Button>
            <Button onClick={() => void trustHook(true)}>Trust & Enable</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
