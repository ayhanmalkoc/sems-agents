import * as React from 'react'
import { Bot, Copy, Save, Sparkles, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { EditPopover, getEditConfig } from '@/components/ui/EditPopover'
import { useAppShellContext } from '@/context/AppShellContext'
import type { AgentProfile, PermissionMode } from '../../shared/types'

const permissionLabels: Record<PermissionMode, string> = {
  safe: 'Explore',
  ask: 'Ask',
  'allow-all': 'Execute',
}

type ThinkingValue = 'low' | 'medium' | 'high' | 'max'
type DelegationValue = 'disabled' | 'ask' | 'auto'

interface DraftState {
  name: string
  description: string
  icon: string
  color: string
  systemPrompt: string
  model: string
  llmConnection: string
  thinkingLevel: ThinkingValue
  permissionMode: PermissionMode | ''
  enabledSourceSlugs: string[]
  skillSlugs: string[]
  delegationMode: DelegationValue
  delegationAllowedAgentIds: string[]
}

function profileKind(profile: AgentProfile): 'system' | 'template' | 'user' {
  return profile.kind || (profile.id === 'default' ? 'system' : (profile.id === 'code-reviewer' || profile.id === 'researcher') ? 'template' : 'user')
}

function draftFromProfile(profile: AgentProfile): DraftState {
  return {
    name: profile.name,
    description: profile.description || '',
    icon: profile.icon || '',
    color: profile.color || '#6366f1',
    systemPrompt: profile.systemPrompt || '',
    model: profile.model || '',
    llmConnection: profile.llmConnection || '',
    thinkingLevel: (profile.thinkingLevel as ThinkingValue | undefined) || 'medium',
    permissionMode: profile.permissionMode || '',
    enabledSourceSlugs: profile.enabledSourceSlugs || [],
    skillSlugs: profile.skillSlugs || [],
    delegationMode: (profile.delegationMode as DelegationValue | undefined) || 'disabled',
    delegationAllowedAgentIds: profile.delegationAllowedAgentIds || [],
  }
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter(item => item !== value) : [...values, value]
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="space-y-1.5 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      {children}
    </label>
  )
}

function inputClass(readOnly = false) {
  return `h-8 w-full rounded-md border border-border bg-background px-2 text-sm ${readOnly ? 'opacity-70' : ''}`
}

export interface AgentInfoPageProps {
  agentId: string
  onAgentChanged?: (agentId?: string) => void
  onDuplicateAgent?: (agent: AgentProfile) => void | Promise<void>
  onDeleteAgent?: (agent: AgentProfile) => void | Promise<void>
}

export default function AgentInfoPage({ agentId, onAgentChanged, onDuplicateAgent, onDeleteAgent }: AgentInfoPageProps) {
  const { activeWorkspaceId, workspaces, agentProfiles = [], llmConnections = [], enabledSources = [], skills = [] } = useAppShellContext()
  const activeWorkspace = activeWorkspaceId ? workspaces.find(workspace => workspace.id === activeWorkspaceId) : undefined
  const profile = agentProfiles.find(agent => agent.id === agentId)
  const [draft, setDraft] = React.useState<DraftState | null>(profile ? draftFromProfile(profile) : null)

  React.useEffect(() => {
    setDraft(profile ? draftFromProfile(profile) : null)
  }, [profile])

  if (!profile || !draft) {
    return <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Agent not found</div>
  }

  const kind = profileKind(profile)
  const canEdit = kind === 'user'
  const updateDraft = <K extends keyof DraftState>(key: K, value: DraftState[K]) => setDraft(prev => prev ? { ...prev, [key]: value } : prev)

  const saveAgent = async () => {
    if (!activeWorkspaceId || !canEdit || !draft.name.trim()) return
    const payload = {
      kind: 'user' as const,
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      icon: draft.icon.trim() || undefined,
      color: draft.color || undefined,
      systemPrompt: draft.systemPrompt.trim() || `You are ${draft.name.trim()} Agent. Follow this role carefully and stay focused on the user's request.`,
      model: draft.model.trim() || undefined,
      llmConnection: draft.llmConnection || undefined,
      thinkingLevel: draft.thinkingLevel,
      permissionMode: draft.permissionMode || undefined,
      enabledSourceSlugs: draft.enabledSourceSlugs.length ? draft.enabledSourceSlugs : undefined,
      skillSlugs: draft.skillSlugs.length ? draft.skillSlugs : undefined,
      delegationMode: draft.delegationMode,
      delegationAllowedAgentIds: draft.delegationAllowedAgentIds.length ? draft.delegationAllowedAgentIds : undefined,
      visibility: 'user-selectable' as const,
    }
    await window.electronAPI.updateAgentProfile(activeWorkspaceId, profile.id, payload)
    toast.success('Agent saved')
    onAgentChanged?.(profile.id)
  }

  const runtimeSummary = [
    profile.model || 'Workspace default model',
    profile.permissionMode ? permissionLabels[profile.permissionMode] : 'Default permission',
    profile.thinkingLevel ? `Think ${profile.thinkingLevel}` : 'Default thinking',
  ].join(' · ')

  return (
    <ScrollArea className="h-full">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-6">
        <div className="rounded-xl border bg-card p-4">
          <div className="flex items-start gap-4">
            <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-sm font-semibold" style={{ backgroundColor: profile.color || 'var(--muted)', color: profile.color ? 'white' : undefined }}>
              {profile.icon || <Bot className="h-5 w-5" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="truncate text-lg font-semibold">{profile.name}</h2>
                <span className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">{kind}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{profile.description || runtimeSummary}</p>
            </div>
            <div className="flex shrink-0 gap-2">
              {canEdit && (
                <EditPopover
                  trigger={<Button variant="outline" size="sm"><Sparkles className="mr-1.5 h-3.5 w-3.5" />Improve with AI</Button>}
                  {...getEditConfig('edit-agent', activeWorkspace ? `${activeWorkspace.rootPath}::${profile.id}` : `::${profile.id}`)}
                />
              )}
              <Button variant="outline" size="sm" onClick={() => onDuplicateAgent?.(profile)}><Copy className="mr-1.5 h-3.5 w-3.5" />Duplicate{!canEdit ? ' to edit' : ''}</Button>
              {canEdit && <Button variant="destructive" size="sm" onClick={() => onDeleteAgent?.(profile)}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete</Button>}
            </div>
          </div>
        </div>

        <section className="rounded-xl border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">Overview</h3>
            {!canEdit && <span className="text-xs text-muted-foreground">Read-only · duplicate to edit</span>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Name"><input className={inputClass(!canEdit)} value={draft.name} readOnly={!canEdit} onChange={e => updateDraft('name', e.target.value)} /></Field>
            <Field label="Icon"><input className={inputClass(!canEdit)} value={draft.icon} readOnly={!canEdit} onChange={e => updateDraft('icon', e.target.value)} placeholder="🤖" /></Field>
            <Field label="Description"><input className={inputClass(!canEdit)} value={draft.description} readOnly={!canEdit} onChange={e => updateDraft('description', e.target.value)} /></Field>
            <Field label="Color"><input className={inputClass(!canEdit)} value={draft.color} readOnly={!canEdit} onChange={e => updateDraft('color', e.target.value)} /></Field>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Runtime</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Model"><input className={inputClass(!canEdit)} value={draft.model} readOnly={!canEdit} onChange={e => updateDraft('model', e.target.value)} placeholder="Workspace default" /></Field>
            <Field label="LLM Connection"><select className={inputClass(!canEdit)} value={draft.llmConnection} disabled={!canEdit} onChange={e => updateDraft('llmConnection', e.target.value)}><option value="">Workspace default</option>{llmConnections.map(c => <option key={c.slug} value={c.slug}>{c.name || c.slug}</option>)}</select></Field>
            <Field label="Permission"><select className={inputClass(!canEdit)} value={draft.permissionMode} disabled={!canEdit} onChange={e => updateDraft('permissionMode', e.target.value as PermissionMode | '')}><option value="">Workspace default</option><option value="safe">Explore</option><option value="ask">Ask</option><option value="allow-all">Execute</option></select></Field>
            <Field label="Thinking"><select className={inputClass(!canEdit)} value={draft.thinkingLevel} disabled={!canEdit} onChange={e => updateDraft('thinkingLevel', e.target.value as ThinkingValue)}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option><option value="max">Max</option></select></Field>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Context</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Sources</p>
              <div className="space-y-1.5">{enabledSources.filter(s => !s.isBuiltin).map(source => <label key={source.config.slug} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!canEdit} checked={draft.enabledSourceSlugs.includes(source.config.slug)} onChange={() => updateDraft('enabledSourceSlugs', toggleValue(draft.enabledSourceSlugs, source.config.slug))} />{source.config.name}</label>)}</div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Skills</p>
              <div className="space-y-1.5">{skills.map(skill => <label key={skill.slug} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!canEdit} checked={draft.skillSlugs.includes(skill.slug)} onChange={() => updateDraft('skillSlugs', toggleValue(draft.skillSlugs, skill.slug))} />{skill.metadata.name}</label>)}</div>
            </div>
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Instructions</h3>
          <textarea className="min-h-40 w-full rounded-md border border-border bg-background p-2 text-sm" value={draft.systemPrompt} readOnly={!canEdit} onChange={e => updateDraft('systemPrompt', e.target.value)} />
        </section>

        <section className="rounded-xl border bg-card p-4">
          <h3 className="mb-3 text-sm font-semibold">Delegation</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Mode"><select className={inputClass(!canEdit)} value={draft.delegationMode} disabled={!canEdit} onChange={e => updateDraft('delegationMode', e.target.value as DelegationValue)}><option value="disabled">Disabled</option><option value="ask">Ask first</option><option value="auto">Auto</option></select></Field>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">Allowed agents</p>
              <div className="space-y-1.5">{agentProfiles.filter(agent => agent.id !== profile.id && agent.visibility !== 'internal').map(agent => <label key={agent.id} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!canEdit} checked={draft.delegationAllowedAgentIds.includes(agent.id)} onChange={() => updateDraft('delegationAllowedAgentIds', toggleValue(draft.delegationAllowedAgentIds, agent.id))} />{agent.name}</label>)}</div>
            </div>
          </div>
        </section>

        {canEdit && <div className="flex justify-end"><Button onClick={saveAgent}><Save className="mr-1.5 h-4 w-4" />Save Agent</Button></div>}
      </div>
    </ScrollArea>
  )
}
