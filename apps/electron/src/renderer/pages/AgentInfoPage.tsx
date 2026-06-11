import * as React from 'react'
import { Bot, Copy, Save, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { useTranslation } from 'react-i18next'
import { Button } from '@/components/ui/button'
import { EditPopover, EditButton, getEditConfig } from '@/components/ui/EditPopover'
import { useAppShellContext } from '@/context/AppShellContext'
import { AgentMenu } from '@/components/app-shell/AgentMenu'
import { CreateAgentButton } from '@/components/app-shell/CreateAgentButton'
import { ResourceBreadcrumbTitle } from '@/components/ui/ResourceBreadcrumbTitle'
import { Info_Page, Info_Section, Info_Table } from '@/components/info'
import { navigate, routes } from '@/lib/navigate'
import { cn } from '@/lib/utils'
import type { AgentProfile, PermissionMode } from '../../shared/types'

const permissionLabelKeys: Record<PermissionMode, string> = {
  safe: 'agents.permissionExplore',
  ask: 'agents.permissionAsk',
  'allow-all': 'agents.permissionExecute',
}

type ThinkingValue = 'low' | 'medium' | 'high' | 'max'
type DelegationValue = 'disabled' | 'ask' | 'auto'
type AgentKind = 'system' | 'template' | 'user'

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

function profileKind(profile: AgentProfile): AgentKind {
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

function inputClass(_readOnly = false) {
  return 'h-8 w-full rounded-md border border-border bg-background px-2 text-sm text-foreground'
}

function AgentAvatar({ agent, fluid = false }: { agent: AgentProfile; fluid?: boolean }) {
  return (
    <span
      className={cn('inline-flex items-center justify-center font-semibold', fluid ? 'h-full w-full rounded-[4px] text-sm' : 'h-8 w-8 rounded-[8px] text-xs')}
      style={{ backgroundColor: agent.color || 'var(--foreground-5)', color: agent.color ? 'white' : undefined }}
    >
      {agent.icon || <Bot className="h-4 w-4" />}
    </span>
  )
}

export interface AgentInfoPageProps {
  agentId: string
  onAgentChanged?: (agentId?: string) => void
  onDuplicateAgent?: (agent: AgentProfile) => void | Promise<void>
  onDeleteAgent?: (agent: AgentProfile) => void | Promise<void>
}

export default function AgentInfoPage({ agentId, onAgentChanged, onDuplicateAgent, onDeleteAgent }: AgentInfoPageProps) {
  const { t } = useTranslation()
  const { activeWorkspaceId, workspaces, agentProfiles = [], llmConnections = [], enabledSources = [], skills = [] } = useAppShellContext()
  const activeWorkspace = activeWorkspaceId ? workspaces.find(workspace => workspace.id === activeWorkspaceId) : undefined
  const profile = agentProfiles.find(agent => agent.id === agentId)
  const [draft, setDraft] = React.useState<DraftState | null>(profile ? draftFromProfile(profile) : null)

  React.useEffect(() => {
    setDraft(profile ? draftFromProfile(profile) : null)
  }, [profile])


  if (!profile || !draft) {
    return (
      <Info_Page empty={t('agents.notFound')}>
        <Info_Page.Header
          title={t('sidebar.agents')}
          titleNode={<ResourceBreadcrumbTitle rootLabel={t('sidebar.agents')} currentLabel={t('agents.notFound')} onRootClick={() => navigate(routes.view.agents())} />}
        />
      </Info_Page>
    )
  }

  const kind = profileKind(profile)
  const canEdit = kind !== 'system'
  const canDelete = kind === 'user'
  const runtimeSummary = [
    profile.model || t('agents.workspaceDefaultModel'),
    profile.permissionMode ? t(permissionLabelKeys[profile.permissionMode]) : t('agents.defaultPermission'),
    profile.thinkingLevel ? t('agents.thinkLevel', { level: profile.thinkingLevel }) : t('agents.defaultThinking'),
  ].join(' · ')
  const updateDraft = <K extends keyof DraftState>(key: K, value: DraftState[K]) => setDraft(prev => prev ? { ...prev, [key]: value } : prev)

  const saveAgent = async () => {
    if (!activeWorkspaceId || !canEdit || !draft.name.trim()) return
    const payload = {
      kind,
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
      const updated = await window.electronAPI.updateAgentProfile(activeWorkspaceId, profile.id, payload)
      setDraft(draftFromProfile(updated))
      toast.success(t('agents.agentSaved'))
      onAgentChanged?.(profile.id)
    } catch (err) {
      toast.error(t('agents.failedToSave'), { description: err instanceof Error ? err.message : String(err) })
    }
  }

  return (
    <Info_Page>
      <Info_Page.Header
        title={profile.name}
        titleNode={<ResourceBreadcrumbTitle rootLabel={t('sidebar.agents')} currentLabel={profile.name} onRootClick={() => navigate(routes.view.agents())} />}
        actions={activeWorkspace ? <CreateAgentButton workspaceRootPath={activeWorkspace.rootPath} /> : undefined}
        titleMenu={
          <AgentMenu
            agent={profile}
            onOpenInNewWindow={() => window.electronAPI.openUrl(`craftagents://agents/agent/${profile.id}?window=focused`)}
            onDuplicate={() => onDuplicateAgent?.(profile)}
            onDelete={canDelete ? () => onDeleteAgent?.(profile) : undefined}
          />
        }
      />

      <Info_Page.Content>
        <Info_Page.Hero avatar={<AgentAvatar agent={profile} fluid />} title={profile.name} tagline={profile.description || runtimeSummary} />

        <Info_Section
          title={t('agents.overview')}
          description={!canEdit ? t('agents.readOnlyDuplicateToEdit') : undefined}
          actions={!canEdit ? <Button variant="outline" size="sm" onClick={() => onDuplicateAgent?.(profile)}><Copy className="mr-1.5 h-3.5 w-3.5" />{t('agents.duplicateToEdit')}</Button> : activeWorkspace ? <EditPopover trigger={<EditButton />} {...getEditConfig('edit-agent', `${activeWorkspace.rootPath}::${profile.id}`)} /> : undefined}
        >
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <Field label={t('common.name')}><input className={inputClass(!canEdit)} value={draft.name} readOnly={!canEdit} onChange={e => updateDraft('name', e.target.value)} /></Field>
            <Field label={t('agents.icon')}><input className={inputClass(!canEdit)} value={draft.icon} readOnly={!canEdit} onChange={e => updateDraft('icon', e.target.value)} /></Field>
            <Field label={t('common.description')}><input className={inputClass(!canEdit)} value={draft.description} readOnly={!canEdit} onChange={e => updateDraft('description', e.target.value)} /></Field>
            <Field label={t('agents.color')}><input className={inputClass(!canEdit)} value={draft.color} readOnly={!canEdit} onChange={e => updateDraft('color', e.target.value)} /></Field>
          </div>
          <Info_Table>
            <Info_Table.Row label={t('agents.kind')}>
              <span className="text-sm text-foreground">{t(`agents.kind.${kind}`)}</span>
            </Info_Table.Row>
          </Info_Table>
        </Info_Section>

        <Info_Section title={t('agents.runtime')}>
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <Field label={t('agents.model')}><input className={inputClass(!canEdit)} value={draft.model} readOnly={!canEdit} onChange={e => updateDraft('model', e.target.value)} placeholder={t('agents.workspaceDefault')} /></Field>
            <Field label={t('agents.connection')}><select className={inputClass(!canEdit)} value={draft.llmConnection} disabled={!canEdit} onChange={e => updateDraft('llmConnection', e.target.value)}><option value="">{t('agents.workspaceDefault')}</option>{llmConnections.map(c => <option key={c.slug} value={c.slug}>{c.name || c.slug}</option>)}</select></Field>
            <Field label={t('agents.permission')}><select className={inputClass(!canEdit)} value={draft.permissionMode} disabled={!canEdit} onChange={e => updateDraft('permissionMode', e.target.value as PermissionMode | '')}><option value="">{t('agents.workspaceDefault')}</option><option value="safe">{t('agents.permissionExplore')}</option><option value="ask">{t('agents.permissionAsk')}</option><option value="allow-all">{t('agents.permissionExecute')}</option></select></Field>
            <Field label={t('agents.thinking')}><select className={inputClass(!canEdit)} value={draft.thinkingLevel} disabled={!canEdit} onChange={e => updateDraft('thinkingLevel', e.target.value as ThinkingValue)}><option value="low">{t('agents.thinkingLow')}</option><option value="medium">{t('agents.thinkingMedium')}</option><option value="high">{t('agents.thinkingHigh')}</option><option value="max">{t('agents.thinkingMax')}</option></select></Field>
          </div>
        </Info_Section>

        <Info_Section title={t('agents.context')}>
          <div className="grid gap-4 p-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{t('sidebar.sources')}</p>
              <div className="space-y-1.5">{enabledSources.filter(s => !s.isBuiltin).map(source => <label key={source.config.slug} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!canEdit} checked={draft.enabledSourceSlugs.includes(source.config.slug)} onChange={() => updateDraft('enabledSourceSlugs', toggleValue(draft.enabledSourceSlugs, source.config.slug))} />{source.config.name}</label>)}</div>
            </div>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{t('sidebar.skills')}</p>
              <div className="space-y-1.5">{skills.map(skill => <label key={skill.slug} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!canEdit} checked={draft.skillSlugs.includes(skill.slug)} onChange={() => updateDraft('skillSlugs', toggleValue(draft.skillSlugs, skill.slug))} />{skill.metadata.name}</label>)}</div>
            </div>
          </div>
        </Info_Section>

        <Info_Section title={t('agents.instructions')}>
          <div className="p-4">
            <textarea className="min-h-40 w-full rounded-md border border-border bg-background p-2 text-sm text-foreground" value={draft.systemPrompt} readOnly={!canEdit} onChange={e => updateDraft('systemPrompt', e.target.value)} />
          </div>
        </Info_Section>

        <Info_Section title={t('agents.delegation')}>
          <div className="grid gap-3 p-4 sm:grid-cols-2">
            <Field label={t('agents.mode')}><select className={inputClass(!canEdit)} value={draft.delegationMode} disabled={!canEdit} onChange={e => updateDraft('delegationMode', e.target.value as DelegationValue)}><option value="disabled">{t('agents.delegationDisabled')}</option><option value="ask">{t('agents.delegationAsk')}</option><option value="auto">{t('agents.delegationAuto')}</option></select></Field>
            <div>
              <p className="mb-2 text-xs font-medium text-muted-foreground">{t('agents.allowedAgents')}</p>
              <div className="space-y-1.5">{agentProfiles.filter(agent => agent.id !== profile.id && agent.visibility !== 'internal').map(agent => <label key={agent.id} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={!canEdit} checked={draft.delegationAllowedAgentIds.includes(agent.id)} onChange={() => updateDraft('delegationAllowedAgentIds', toggleValue(draft.delegationAllowedAgentIds, agent.id))} />{agent.name}</label>)}</div>
            </div>
          </div>
        </Info_Section>

        {canEdit && (
          <div className="flex justify-end gap-2">
            <Button onClick={saveAgent}><Save className="mr-1.5 h-4 w-4" />{t('agents.saveAgent')}</Button>
            {canDelete && <Button variant="destructive" onClick={() => onDeleteAgent?.(profile)}><Trash2 className="mr-1.5 h-4 w-4" />{t('agents.deleteAgent')}</Button>}
          </div>
        )}
      </Info_Page.Content>
    </Info_Page>
  )
}
