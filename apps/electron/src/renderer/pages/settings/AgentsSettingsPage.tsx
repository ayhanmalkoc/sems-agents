
import { useEffect, useMemo, useState } from 'react'
import { Bot, Copy, Plus, Save, Trash2 } from 'lucide-react'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppShellContext } from '@/context/AppShellContext'
import type { AgentProfile, PermissionMode } from '../../../shared/types'
import { toast } from 'sonner'

type ThinkingValue = 'low' | 'medium' | 'high' | 'max'
type SubagentsValue = 'disabled' | 'ask' | 'auto'

const permissionModeLabels: Record<PermissionMode, string> = {
  safe: 'Explore',
  ask: 'Ask',
  'allow-all': 'Execute',
}

const thinkingLabels: Record<ThinkingValue, string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  max: 'Max',
}

interface DraftState {
  id?: string
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
  delegationMode: SubagentsValue
  delegationAllowedAgentIds: string[]
}

const emptyDraft = (): DraftState => ({
  name: '',
  description: '',
  icon: '',
  color: '#6366f1',
  systemPrompt: '',
  model: '',
  llmConnection: '',
  thinkingLevel: 'medium',
  permissionMode: '',
  enabledSourceSlugs: [],
  skillSlugs: [],
  delegationMode: 'disabled',
  delegationAllowedAgentIds: [],
})

function draftFromProfile(profile: AgentProfile): DraftState {
  return {
    id: profile.id,
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
    delegationMode: (profile.delegationMode as SubagentsValue | undefined) || 'disabled',
    delegationAllowedAgentIds: profile.delegationAllowedAgentIds || [],
  }
}

function toggleValue(values: string[], value: string): string[] {
  return values.includes(value) ? values.filter(item => item !== value) : [...values, value]
}

function profileKind(profile: AgentProfile): 'system' | 'template' | 'user' {
  return profile.kind || (profile.id === 'default' ? 'system' : (profile.id === 'code-reviewer' || profile.id === 'researcher') ? 'template' : 'user')
}

function AgentCard({ profile, selected, actionLabel, onClick }: { profile: AgentProfile; selected?: boolean; actionLabel?: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className={`rounded-xl border bg-card p-3 text-left transition-colors ${selected ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/40'}`}>
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold" style={{ backgroundColor: profile.color || 'var(--muted)', color: profile.color ? 'white' : undefined }}>{profile.icon || <Bot className="h-4 w-4" />}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{profile.name}</span>
          <span className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{profile.description || 'Workspace defaults'}</span>
          {actionLabel && <span className="mt-2 inline-flex rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground">{actionLabel}</span>}
        </span>
      </div>
    </button>
  )
}

export default function AgentsSettingsPage() {
  const { activeWorkspaceId, llmConnections, enabledSources = [], skills = [], enabledModes = ['safe', 'ask', 'allow-all'], agentProfiles = [] } = useAppShellContext()
  const [profiles, setProfiles] = useState<AgentProfile[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftState>(() => emptyDraft())
  const [isCreating, setIsCreating] = useState(false)

  const visibleProfiles = useMemo(() => profiles.filter(p => p.visibility !== 'internal'), [profiles])
  const myAgents = useMemo(() => visibleProfiles.filter(p => profileKind(p) === 'user'), [visibleProfiles])
  const templates = useMemo(() => visibleProfiles.filter(p => profileKind(p) === 'template'), [visibleProfiles])
  const systemAgents = useMemo(() => visibleProfiles.filter(p => profileKind(p) === 'system'), [visibleProfiles])
  const visibleSources = useMemo(() => enabledSources.filter(source => !source.isBuiltin), [enabledSources])
  const selectedProfile = visibleProfiles.find(profile => profile.id === selectedId)
  const selectedKind = selectedProfile ? profileKind(selectedProfile) : 'user'
  const canEdit = isCreating || selectedKind === 'user'
  const isEditing = !!draft.id && selectedKind === 'user' && !isCreating

  const loadProfiles = async () => {
    if (!activeWorkspaceId) return
    const nextProfiles = await window.electronAPI.listAgentProfiles(activeWorkspaceId)
    setProfiles(nextProfiles)
    if (!selectedId && !isCreating) {
      const firstUser = nextProfiles.find(profile => profileKind(profile) === 'user')
      if (firstUser) {
        setSelectedId(firstUser.id)
        setDraft(draftFromProfile(firstUser))
      }
    }
  }

  useEffect(() => { void loadProfiles() }, [activeWorkspaceId])

  useEffect(() => {
    if (!selectedId || isCreating) return
    const profile = visibleProfiles.find(item => item.id === selectedId)
    if (profile) setDraft(draftFromProfile(profile))
  }, [selectedId, visibleProfiles, isCreating])

  const updateDraft = <K extends keyof DraftState>(key: K, value: DraftState[K]) => {
    setDraft(prev => ({ ...prev, [key]: value }))
  }

  const startNewAgent = () => {
    setSelectedId(null)
    setIsCreating(true)
    setDraft(emptyDraft())
  }

  const duplicateProfile = async (profile: AgentProfile) => {
    if (!activeWorkspaceId) return
    const copy = await window.electronAPI.createAgentProfile(activeWorkspaceId, {
      ...profile,
      id: undefined,
      kind: 'user',
      name: `${profile.name} Copy`,
      visibility: 'user-selectable',
    })
    toast.success('Agent created')
    setSelectedId(copy.id)
    setDraft(draftFromProfile(copy))
    setIsCreating(false)
    await loadProfiles()
  }

  const saveProfile = async () => {
    if (!activeWorkspaceId || !draft.name.trim()) return
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

    try {
      const saved = isEditing && draft.id
        ? await window.electronAPI.updateAgentProfile(activeWorkspaceId, draft.id, payload)
        : await window.electronAPI.createAgentProfile(activeWorkspaceId, payload)
      toast.success(isEditing ? 'Agent updated' : 'Agent created')
      setSelectedId(saved.id)
      setDraft(draftFromProfile(saved))
      setIsCreating(false)
      await loadProfiles()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save agent')
    }
  }

  const deleteProfile = async () => {
    if (!activeWorkspaceId || !selectedProfile || selectedKind !== 'user') return
    if (!window.confirm(`Delete ${selectedProfile.name}?`)) return
    try {
      await window.electronAPI.deleteAgentProfile(activeWorkspaceId, selectedProfile.id)
      toast.success('Agent deleted')
      startNewAgent()
      await loadProfiles()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete agent')
    }
  }

  const previewItems = [
    draft.llmConnection ? `Connection: ${llmConnections.find(item => item.slug === draft.llmConnection)?.name || draft.llmConnection}` : 'Connection: Workspace default',
    draft.model ? `Model: ${draft.model}` : 'Model: Workspace default',
    `Thinking: ${thinkingLabels[draft.thinkingLevel]}`,
    draft.permissionMode ? `Default mode: ${permissionModeLabels[draft.permissionMode]}` : 'Default mode: Workspace default',
    draft.enabledSourceSlugs.length ? `Sources: ${draft.enabledSourceSlugs.length}` : 'Sources: Workspace default',
    draft.skillSlugs.length ? `Skills: ${draft.skillSlugs.length}` : 'Skills: none',
    `Subagents: ${draft.delegationMode}`,
  ]

  const disabled = !canEdit

  return (
    <div className="h-full flex flex-col">
      <PanelHeader title="Agents" />
      <ScrollArea className="flex-1">
        <div className="mx-auto max-w-3xl space-y-6 p-6">
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Agents</h2>
                <p className="text-sm text-muted-foreground">Create lightweight agent profiles for chat sessions.</p>
              </div>
              <Button className="gap-2" onClick={startNewAgent}><Plus className="h-4 w-4" /> New agent</Button>
            </div>

            {myAgents.length > 0 && (
              <div className="space-y-2">
                <div className="text-sm font-semibold">My agents</div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {myAgents.map(profile => <AgentCard key={profile.id} profile={profile} selected={selectedId === profile.id} onClick={() => { setSelectedId(profile.id); setIsCreating(false) }} />)}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="text-sm font-semibold">Templates</div>
              <div className="grid gap-2 sm:grid-cols-2">
                {templates.map(profile => <AgentCard key={profile.id} profile={profile} actionLabel="Use template" onClick={() => { void duplicateProfile(profile) }} />)}
              </div>
            </div>

            {systemAgents.length > 0 && (
              <details className="rounded-xl border bg-card p-3">
                <summary className="cursor-pointer text-sm font-semibold">System agents</summary>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {systemAgents.map(profile => <AgentCard key={profile.id} profile={profile} selected={selectedId === profile.id} actionLabel="Read only" onClick={() => { setSelectedId(profile.id); setIsCreating(false) }} />)}
                </div>
              </details>
            )}
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">{isCreating ? 'Create agent' : selectedProfile ? (canEdit ? 'Edit agent' : 'Agent template') : 'Create agent'}</div>
                <div className="text-sm text-muted-foreground">{canEdit ? 'Configure the agent profile used by chat input controls.' : 'Templates are read-only. Use template to create an editable agent.'}</div>
              </div>
              <div className="flex items-center gap-1">
                {selectedProfile && <Button variant="ghost" size="icon" onClick={() => { void duplicateProfile(selectedProfile) }} title="Duplicate"><Copy className="h-4 w-4" /></Button>}
                {selectedProfile && selectedKind === 'user' && <Button variant="ghost" size="icon" onClick={deleteProfile} title="Delete"><Trash2 className="h-4 w-4" /></Button>}
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <div className="text-sm font-semibold">Agent details</div>
                <div className="grid gap-4 sm:grid-cols-[88px_1fr]">
                  <label className="space-y-1.5 text-sm"><span className="font-medium">Color</span><input disabled={disabled} className="h-10 w-full rounded-md border bg-background px-2 disabled:opacity-60" type="color" value={draft.color} onChange={e => updateDraft('color', e.target.value)} /></label>
                  <label className="space-y-1.5 text-sm"><span className="font-medium">Name</span><input disabled={disabled} className="w-full rounded-md border bg-background px-3 py-2 disabled:opacity-60" placeholder="Code Reviewer" value={draft.name} onChange={e => updateDraft('name', e.target.value)} /></label>
                </div>
                <div className="grid gap-4 sm:grid-cols-[88px_1fr]">
                  <label className="space-y-1.5 text-sm"><span className="font-medium">Icon</span><input disabled={disabled} className="w-full rounded-md border bg-background px-3 py-2 disabled:opacity-60" placeholder="CR" value={draft.icon} onChange={e => updateDraft('icon', e.target.value.slice(0, 3))} /></label>
                  <label className="space-y-1.5 text-sm"><span className="font-medium">Description</span><input disabled={disabled} className="w-full rounded-md border bg-background px-3 py-2 disabled:opacity-60" placeholder="What this agent is best at" value={draft.description} onChange={e => updateDraft('description', e.target.value)} /></label>
                </div>
              </div>

              <div className="space-y-3">
                <div className="text-sm font-semibold">Instructions</div>
                <label className="space-y-1.5 text-sm"><span className="font-medium">System prompt</span><textarea disabled={disabled} className="min-h-36 w-full rounded-md border bg-background px-3 py-2 text-sm disabled:opacity-60" placeholder="Tell this agent how to behave, what to prioritize, and what to avoid." value={draft.systemPrompt} onChange={e => updateDraft('systemPrompt', e.target.value)} /></label>
              </div>

              <div className="space-y-3">
                <div className="text-sm font-semibold">AI settings</div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="space-y-1.5 text-sm"><span className="font-medium">Connection</span><select disabled={disabled} className="w-full rounded-md border bg-background px-3 py-2 disabled:opacity-60" value={draft.llmConnection} onChange={e => updateDraft('llmConnection', e.target.value)}><option value="">Workspace default</option>{llmConnections.map(conn => <option key={conn.slug} value={conn.slug}>{conn.name}</option>)}</select></label>
                  <label className="space-y-1.5 text-sm"><span className="font-medium">Model</span><input disabled={disabled} className="w-full rounded-md border bg-background px-3 py-2 disabled:opacity-60" placeholder="Workspace default" value={draft.model} onChange={e => updateDraft('model', e.target.value)} /></label>
                  <label className="space-y-1.5 text-sm"><span className="font-medium">Thinking</span><select disabled={disabled} className="w-full rounded-md border bg-background px-3 py-2 disabled:opacity-60" value={draft.thinkingLevel} onChange={e => updateDraft('thinkingLevel', e.target.value as ThinkingValue)}>{(['low', 'medium', 'high', 'max'] as ThinkingValue[]).map(level => <option key={level} value={level}>{thinkingLabels[level]}</option>)}</select></label>
                  <label className="space-y-1.5 text-sm"><span className="font-medium">Default mode</span><select disabled={disabled} className="w-full rounded-md border bg-background px-3 py-2 disabled:opacity-60" value={draft.permissionMode} onChange={e => updateDraft('permissionMode', e.target.value as PermissionMode | '')}><option value="">Workspace default</option>{enabledModes.map(mode => <option key={mode} value={mode}>{permissionModeLabels[mode]}</option>)}</select></label>
                </div>
              </div>

              <details className="rounded-lg border p-3">
                <summary className="cursor-pointer text-sm font-semibold">Advanced capabilities</summary>
                <div className="mt-4 space-y-4">
                  <div className="rounded-lg border p-3"><div className="mb-2 text-xs font-medium text-muted-foreground">Sources</div><div className="grid gap-2 sm:grid-cols-2">{visibleSources.map(source => <label key={source.config.slug} className="flex items-center gap-2 text-sm"><input disabled={disabled} type="checkbox" checked={draft.enabledSourceSlugs.includes(source.config.slug)} onChange={() => updateDraft('enabledSourceSlugs', toggleValue(draft.enabledSourceSlugs, source.config.slug))} /> <span>{source.config.name || source.config.slug}</span></label>)}</div>{visibleSources.length === 0 && <div className="text-xs text-muted-foreground">No configurable sources.</div>}</div>
                  <div className="rounded-lg border p-3"><div className="mb-2 text-xs font-medium text-muted-foreground">Skills</div><div className="grid gap-2 sm:grid-cols-2">{skills.map(skill => <label key={skill.slug} className="flex items-center gap-2 text-sm"><input disabled={disabled} type="checkbox" checked={draft.skillSlugs.includes(skill.slug)} onChange={() => updateDraft('skillSlugs', toggleValue(draft.skillSlugs, skill.slug))} /> <span>{skill.metadata.name || skill.slug}</span></label>)}</div>{skills.length === 0 && <div className="text-xs text-muted-foreground">No skills loaded.</div>}</div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="space-y-1.5 text-sm"><span className="font-medium">Subagent mode</span><select disabled={disabled} className="w-full rounded-md border bg-background px-3 py-2 disabled:opacity-60" value={draft.delegationMode} onChange={e => updateDraft('delegationMode', e.target.value as SubagentsValue)}><option value="disabled">Disabled</option><option value="ask">Ask first</option><option value="auto">Automatic</option></select></label>
                    <div className="rounded-lg border p-3"><div className="mb-2 text-xs font-medium text-muted-foreground">Allowed subagents</div>{agentProfiles.filter(profile => profile.id !== draft.id && profile.visibility !== 'internal').map(profile => <label key={profile.id} className="flex items-center gap-2 text-sm"><input disabled={disabled} type="checkbox" checked={draft.delegationAllowedAgentIds.includes(profile.id)} onChange={() => updateDraft('delegationAllowedAgentIds', toggleValue(draft.delegationAllowedAgentIds, profile.id))} /> <span>{profile.name}</span></label>)}</div>
                  </div>
                </div>
              </details>

              <div className="rounded-lg border bg-muted/30 p-3"><div className="mb-2 text-sm font-semibold">Effective summary</div><div className="flex flex-wrap gap-2">{previewItems.map(item => <span key={item} className="rounded-full border bg-background px-2.5 py-1 text-xs text-muted-foreground">{item}</span>)}</div></div>
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={startNewAgent}>New agent</Button>
              {canEdit && <Button onClick={saveProfile} disabled={!draft.name.trim()} className="gap-2"><Save className="h-4 w-4" /> {isEditing ? 'Save changes' : 'Create agent'}</Button>}
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  )
}
