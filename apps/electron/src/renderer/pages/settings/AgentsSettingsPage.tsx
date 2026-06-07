import { useEffect, useMemo, useState } from 'react'
import { Bot, Plus, Save, Trash2 } from 'lucide-react'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useAppShellContext } from '@/context/AppShellContext'
import type { AgentProfile } from '../../../shared/types'
import { toast } from 'sonner'

type ThinkingValue = 'low' | 'medium' | 'high' | 'max'

const protectedIds = new Set(['default', 'code-reviewer', 'researcher'])

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
  }
}

export default function AgentsSettingsPage() {
  const { activeWorkspaceId, llmConnections } = useAppShellContext()
  const [profiles, setProfiles] = useState<AgentProfile[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [draft, setDraft] = useState<DraftState>(() => emptyDraft())

  const visibleProfiles = useMemo(() => profiles.filter(p => p.visibility !== 'internal'), [profiles])
  const selectedProfile = visibleProfiles.find(profile => profile.id === selectedId)
  const isEditing = !!draft.id
  const isProtected = !!draft.id && protectedIds.has(draft.id)

  const loadProfiles = async () => {
    if (!activeWorkspaceId) return
    const nextProfiles = await window.electronAPI.listAgentProfiles(activeWorkspaceId)
    setProfiles(nextProfiles)
    if (!selectedId && nextProfiles.length) {
      const firstEditable = nextProfiles.find(profile => profile.id !== 'default') || nextProfiles[0]
      setSelectedId(firstEditable.id)
      setDraft(draftFromProfile(firstEditable))
    }
  }

  useEffect(() => { void loadProfiles() }, [activeWorkspaceId])

  useEffect(() => {
    if (!selectedId) return
    const profile = visibleProfiles.find(item => item.id === selectedId)
    if (profile) setDraft(draftFromProfile(profile))
  }, [selectedId, visibleProfiles])

  const updateDraft = <K extends keyof DraftState>(key: K, value: DraftState[K]) => {
    setDraft(prev => ({ ...prev, [key]: value }))
  }

  const resetForCreate = () => {
    setSelectedId(null)
    setDraft(emptyDraft())
  }

  const saveProfile = async () => {
    if (!activeWorkspaceId || !draft.name.trim()) return
    const payload = {
      name: draft.name.trim(),
      description: draft.description.trim() || undefined,
      icon: draft.icon.trim() || undefined,
      color: draft.color || undefined,
      systemPrompt: draft.systemPrompt.trim() || `You are ${draft.name.trim()} Agent. Follow this role carefully and stay focused on the user's request.`,
      model: draft.model.trim() || undefined,
      llmConnection: draft.llmConnection || undefined,
      thinkingLevel: draft.thinkingLevel,
      visibility: 'user-selectable' as const,
      delegationMode: 'disabled' as const,
    }

    try {
      const saved = isEditing
        ? await window.electronAPI.updateAgentProfile(activeWorkspaceId, draft.id!, payload)
        : await window.electronAPI.createAgentProfile(activeWorkspaceId, payload)
      toast.success(isEditing ? 'Agent updated' : 'Agent created')
      setSelectedId(saved.id)
      setDraft(draftFromProfile(saved))
      await loadProfiles()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save agent')
    }
  }

  const deleteProfile = async (id: string) => {
    if (!activeWorkspaceId || protectedIds.has(id)) return
    try {
      await window.electronAPI.deleteAgentProfile(activeWorkspaceId, id)
      toast.success('Agent deleted')
      resetForCreate()
      await loadProfiles()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete agent')
    }
  }

  return (
    <div className="h-full flex flex-col">
      <PanelHeader title="Agents" />
      <ScrollArea className="flex-1">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-6 p-6 lg:grid-cols-[300px_1fr]">
          <section className="space-y-3">
            <Button className="w-full justify-start gap-2" onClick={resetForCreate}>
              <Plus className="h-4 w-4" /> New agent
            </Button>
            <div className="space-y-2">
              {visibleProfiles.map(profile => (
                <button
                  key={profile.id}
                  onClick={() => setSelectedId(profile.id)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${selectedId === profile.id ? 'border-primary bg-primary/5' : 'border-border bg-card hover:bg-muted/40'}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold" style={{ backgroundColor: profile.color || 'var(--muted)', color: profile.color ? 'white' : undefined }}>
                      {profile.icon || <Bot className="h-4 w-4" />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{profile.name}</span>
                      <span className="block truncate text-xs text-muted-foreground">{profile.description || 'Workspace defaults'}</span>
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </section>

          <section className="rounded-xl border border-border bg-card p-5">
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <div className="text-base font-semibold">{isEditing ? 'Edit agent' : 'Create agent'}</div>
                <div className="text-sm text-muted-foreground">Define the persona, model overrides, reasoning, and instructions used by chat sessions.</div>
              </div>
              {selectedProfile && !isProtected && (
                <Button variant="ghost" size="icon" onClick={() => deleteProfile(selectedProfile.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Name</span>
                <input className="w-full rounded-md border bg-background px-3 py-2" placeholder="Code Reviewer" value={draft.name} onChange={e => updateDraft('name', e.target.value)} disabled={isProtected} />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Description</span>
                <input className="w-full rounded-md border bg-background px-3 py-2" placeholder="What this agent is best at" value={draft.description} onChange={e => updateDraft('description', e.target.value)} />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Icon</span>
                <input className="w-full rounded-md border bg-background px-3 py-2" placeholder="CR" value={draft.icon} onChange={e => updateDraft('icon', e.target.value.slice(0, 3))} />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Color</span>
                <input className="h-10 w-full rounded-md border bg-background px-2" type="color" value={draft.color} onChange={e => updateDraft('color', e.target.value)} />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">LLM connection</span>
                <select className="w-full rounded-md border bg-background px-3 py-2" value={draft.llmConnection} onChange={e => updateDraft('llmConnection', e.target.value)}>
                  <option value="">Workspace default connection</option>
                  {llmConnections.map(conn => <option key={conn.slug} value={conn.slug}>{conn.name}</option>)}
                </select>
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Model override</span>
                <input className="w-full rounded-md border bg-background px-3 py-2" placeholder="Optional model id" value={draft.model} onChange={e => updateDraft('model', e.target.value)} />
              </label>
              <label className="space-y-1.5 text-sm">
                <span className="font-medium">Thinking level</span>
                <select className="w-full rounded-md border bg-background px-3 py-2" value={draft.thinkingLevel} onChange={e => updateDraft('thinkingLevel', e.target.value as ThinkingValue)}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="max">Max</option>
                </select>
              </label>
            </div>

            <label className="mt-4 block space-y-1.5 text-sm">
              <span className="font-medium">Agent instructions</span>
              <textarea className="min-h-40 w-full rounded-md border bg-background px-3 py-2" placeholder="Describe how this agent should behave, what to prioritize, and what to avoid." value={draft.systemPrompt} onChange={e => updateDraft('systemPrompt', e.target.value)} />
            </label>

            <div className="mt-5 flex items-center justify-end gap-2">
              <Button variant="ghost" onClick={resetForCreate}>Clear</Button>
              <Button onClick={saveProfile} disabled={!draft.name.trim()} className="gap-2">
                <Save className="h-4 w-4" /> {isEditing ? 'Save changes' : 'Create agent'}
              </Button>
            </div>
          </section>
        </div>
      </ScrollArea>
    </div>
  )
}
