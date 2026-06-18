import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, RefreshCw, Settings, Sparkles } from 'lucide-react'
import { toast } from 'sonner'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { HeaderMenu } from '@/components/ui/HeaderMenu'
import { routes } from '@/lib/navigate'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { EditPopover, getEditConfig } from '@/components/ui/EditPopover'
import { Switch } from '@/components/ui/switch'
import { SettingsCard, SettingsRow, SettingsSection } from '@/components/settings'
import { useAppShellContext } from '@/context/AppShellContext'
import { cn } from '@/lib/utils'
import type { BuiltinHookDefinition, CustomHookDefinition, CustomHookTrustRecord, HookRunRecord, HooksPolicy } from '@craft-agent/shared/hooks'
import { buildHookGroups, type HookListItem } from './hooks-ui-model'

type HookRow = BuiltinHookDefinition & { enabled: boolean }

type PendingTrustAction = { hook: CustomHookDefinition; enableAfterTrust: boolean } | null

function reviewBadge(status: HookListItem['trustStatus']) {
  if (status === 'Trusted' || status === 'Built-in') return null
  return <span className="rounded-full bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-600 dark:text-amber-300">Review required</span>
}

function handlerLabel(type: string): string {
  if (type === 'command') return 'Command'
  if (type === 'http') return 'URL'
  if (type === 'mcp') return 'MCP tool'
  if (type === 'prompt') return 'Prompt output'
  return 'Built-in handler'
}

function handlerSummary(hook: CustomHookDefinition): string {
  if (hook.handler.type === 'command') return `${hook.handler.executable} ${(hook.handler.args ?? []).join(' ')}`.trim()
  if (hook.handler.type === 'http') return hook.handler.url
  if (hook.handler.type === 'mcp') return `${hook.handler.target}/${hook.handler.tool}`
  return hook.handler.output?.decision ?? hook.handler.decision?.type ?? 'observe'
}

function matcherDetail(item: HookListItem): string {
  const matcher = item.customHook?.matcher
  if (!matcher) return item.matcherSummary
  const parts = [matcher.toolName, matcher.commandIncludes, matcher.pathGlob, matcher.agentProfileId, matcher.sessionScope, matcher.automationEvent].filter(Boolean)
  return parts.length ? parts.join(' | ') : 'all matching events'
}

function formatTimeout(timeoutMs?: number): string {
  if (!timeoutMs) return 'Default'
  return timeoutMs >= 1000 ? `${Math.round(timeoutMs / 1000)}s` : `${timeoutMs}ms`
}

function policyLabelKey(key: keyof HooksPolicy): string {
  return `settings.hooks.policy.${String(key)}`
}

function policyValueLabelKey(value: unknown): string {
  return `settings.hooks.policyValue.${String(value).replace(/-([a-z])/g, (_, letter: string) => letter.toUpperCase())}`
}

function DetailRow({ label, children, mono = false }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <>
      <div className="text-[11px] font-medium text-foreground/45">{label}</div>
      <div className={cn('break-words text-xs text-foreground/70', mono && 'font-mono')}>{children}</div>
    </>
  )
}

function HookDetail({ item }: { item: HookListItem }) {
  const target = item.customHook ? handlerSummary(item.customHook) : item.id
  return (
    <div className="mx-3 mb-3 rounded-md border border-border/60 bg-foreground/[0.015] p-3">
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-[120px_1fr]">
        <DetailRow label="Handler">{item.handlerType === 'builtin' ? 'Built-in' : item.handlerType}</DetailRow>
        <DetailRow label={handlerLabel(item.handlerType)} mono>{target}</DetailRow>
        <DetailRow label="Matcher" mono>{matcherDetail(item)}</DetailRow>
        <DetailRow label="Timeout">{formatTimeout(item.timeoutMs)}</DetailRow>
        {item.powers && <DetailRow label="Powers">{item.powers.join(', ')}</DetailRow>}
        <DetailRow label="Trust">{item.trustStatus}{item.hash ? ` · ${item.hash.slice(0, 12)}` : ''}</DetailRow>
        {item.lastRun && <DetailRow label="Last run">{item.lastRun.decision} · {item.lastRun.ok ? 'ok' : 'error'} · {item.lastRun.durationMs}ms</DetailRow>}
      </div>
    </div>
  )
}

function HookRowView({ item, onToggle, onReview }: { item: HookListItem; onToggle: (item: HookListItem, checked: boolean) => void; onReview: (hook: CustomHookDefinition) => void }) {
  const [open, setOpen] = React.useState(false)
  return (
    <div className="border-t border-border/60 first:border-t-0 bg-background/70">
      <div className="flex items-center gap-3 px-3 py-2.5">
        <button type="button" className="text-foreground/45 hover:text-foreground" onClick={() => setOpen(value => !value)} aria-label={open ? 'Collapse hook' : 'Expand hook'}>{open ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}</button>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm text-foreground">{item.name}</span>
            {reviewBadge(item.trustStatus)}
          </div>
        </div>
        {item.kind === 'custom' && item.trustStatus !== 'Trusted' && item.customHook && <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => onReview(item.customHook!)}>Review</Button>}
        <Switch checked={item.enabled} onCheckedChange={checked => onToggle(item, checked)} />
      </div>
      {open && <div className="px-4 pb-4"><HookDetail item={item} /></div>}
    </div>
  )
}

export default function HooksSettingsPage() {
  const { t } = useTranslation()
  const { activeWorkspaceId, workspaces } = useAppShellContext()
  const activeWorkspace = workspaces.find(workspace => workspace.id === activeWorkspaceId)
  const workspaceRoot = (activeWorkspace as { rootPath?: string; path?: string } | undefined)?.rootPath ?? (activeWorkspace as { path?: string } | undefined)?.path
  const [hooks, setHooks] = React.useState<HookRow[]>([])
  const [runs, setRuns] = React.useState<HookRunRecord[]>([])
  const [customHooks, setCustomHooks] = React.useState<CustomHookDefinition[]>([])
  const [trustRecords, setTrustRecords] = React.useState<CustomHookTrustRecord[]>([])
  const [policy, setPolicy] = React.useState<HooksPolicy | null>(null)
  const [loading, setLoading] = React.useState(false)
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
      <span className="text-foreground/70">{t(policyLabelKey(key))}</span>
      <select className="h-8 rounded-md border border-border bg-background px-2 text-xs" value={policy?.[key] ?? ''} onChange={event => updatePolicy(key, event.target.value as HooksPolicy[K])}>
        {values.map(value => <option key={String(value)} value={String(value)}>{t(policyValueLabelKey(value))}</option>)}
      </select>
    </label>
  )

  return (
    <div className="flex h-full flex-col bg-background">
      <PanelHeader title={t('settings.hooks.title')} actions={<HeaderMenu route={routes.view.settings('hooks')} />} />
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 p-6">
          <SettingsSection title={t('settings.hooks.title')} description={t('settings.hooks.pageDescription')}>
            <SettingsCard>
              <SettingsRow
                label={
                  <span className="flex items-center gap-2">
                    <span className="rounded-lg bg-foreground/[0.04] p-1.5 text-foreground/55"><Settings className="h-3.5 w-3.5" /></span>
                    {t('settings.hooks.workspaceConfiguration')}
                  </span>
                }
                description={`${hooks.length} built-ins · ${customHooks.length} custom · ${customTrusted} trusted · ${customUntrusted} needs review`}
                action={
                  <div className="flex gap-2">
                    {workspaceRoot && <EditPopover trigger={<Button size="sm" variant="outline"><Sparkles className="mr-1 h-3.5 w-3.5" />Create</Button>} onInlineComplete={refresh} {...getEditConfig('hooks-create', workspaceRoot)} />}
                    <Button size="sm" variant="outline" onClick={() => void refresh()} disabled={loading}><RefreshCw className="h-3.5 w-3.5" /></Button>
                  </div>
                }
              />
            </SettingsCard>
          </SettingsSection>

          <SettingsSection title={t('settings.hooks.lifecycleTitle')} description={t('settings.hooks.lifecycleDescription')} action={workspaceRoot ? <EditPopover trigger={<Button size="sm" variant="outline"><Sparkles className="mr-1 h-3.5 w-3.5" />{t('settings.hooks.editHooks')}</Button>} onInlineComplete={refresh} {...getEditConfig('hooks-edit', `${workspaceRoot}::workspace hooks`)} /> : undefined}>
            <SettingsCard className={cn('overflow-hidden', loading && 'opacity-60')}>
              {groups.length ? (
                <div className="space-y-1 p-3">
                  {groups.map(group => (
                    <section key={group.event} className="rounded-lg px-1 py-2">
                      <div className="flex items-start gap-3 px-2 pb-2">
                        <span className="mt-0.5 text-foreground/35">⌘</span>
                        <div>
                          <h3 className="text-sm font-medium text-foreground">{group.title}</h3>
                          <p className="mt-0.5 text-xs text-foreground/45">{group.description}</p>
                        </div>
                      </div>
                      <div className="ml-6 overflow-hidden rounded-lg border border-border/70 bg-foreground/[0.018]">
                        {group.hooks.map(item => <HookRowView key={`${item.kind}:${item.id}`} item={item} onToggle={toggleHook} onReview={hook => setPendingTrust({ hook, enableAfterTrust: false })} />)}
                      </div>
                    </section>
                  ))}
                </div>
              ) : <div className="p-8 text-center text-sm text-foreground/50">{t('settings.hooks.empty')}</div>}
            </SettingsCard>
          </SettingsSection>

          <SettingsSection title={t('settings.hooks.policyTitle')} description={t('settings.hooks.policyDescription')}>
            <SettingsCard>
              <SettingsRow
                label={t('settings.hooks.advancedPolicy')}
                description={t('settings.hooks.advancedPolicyDescription')}
              />
              {policy && (
                <div className="border-t border-border/60 p-4">
                  <div className="grid gap-2 md:grid-cols-2">
                    {policySelect('secretGuard', ['strict', 'standard', 'off'])}
                    {policySelect('workspaceBoundary', ['block', 'ask', 'observe'])}
                    {policySelect('prerequisiteGuard', ['enforce', 'observe'])}
                    {policySelect('toolAudit', ['on', 'off'])}
                    {policySelect('memoryLearn', ['auto', 'review', 'off'])}
                    {policySelect('customHooks', ['trusted-only', 'off'])}
                  </div>
                </div>
              )}
            </SettingsCard>
          </SettingsSection>
        </div>
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
