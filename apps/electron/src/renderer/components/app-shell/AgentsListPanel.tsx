import * as React from 'react'
import { Bot } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { EntityPanel } from '@/components/ui/entity-panel'
import { EntityListBadge } from '@/components/ui/entity-list-badge'
import { EntityListEmptyScreen } from '@/components/ui/entity-list-empty'
import { EditPopover, getEditConfig } from '@/components/ui/EditPopover'
import { agentSelection } from '@/hooks/useEntitySelection'
import { AgentMenu } from './AgentMenu'
import type { AgentProfile, PermissionMode } from '../../../shared/types'

function profileKind(profile: AgentProfile): 'system' | 'template' | 'user' {
  return profile.kind || (profile.id === 'default' ? 'system' : (profile.id === 'code-reviewer' || profile.id === 'researcher') ? 'template' : 'user')
}

const permissionLabels: Record<PermissionMode, string> = {
  safe: 'Explore',
  ask: 'Ask',
  'allow-all': 'Execute',
}

export interface AgentsListPanelProps {
  agents: AgentProfile[]
  workspaceRootPath?: string
  selectedAgentId?: string | null
  onAgentClick: (agent: AgentProfile) => void
  onDuplicateAgent: (agent: AgentProfile) => void | Promise<void>
  onDeleteAgent: (agent: AgentProfile) => void | Promise<void>
  onImproveAgent: (agent: AgentProfile) => void
  onCreateAgent: () => void | Promise<void>
}

export function AgentsListPanel({
  agents,
  workspaceRootPath,
  selectedAgentId,
  onAgentClick,
  onDuplicateAgent,
  onDeleteAgent,
  onImproveAgent,
  onCreateAgent,
}: AgentsListPanelProps) {
  const { t } = useTranslation()
  const visibleAgents = React.useMemo(() => agents.filter(agent => agent.visibility !== 'internal'), [agents])

  return (
    <EntityPanel<AgentProfile>
      items={visibleAgents}
      getId={(agent) => agent.id}
      selection={agentSelection}
      selectedId={selectedAgentId}
      onItemClick={onAgentClick}
      containerProps={{ 'data-list-role': 'agents' }}
      emptyState={
        <EntityListEmptyScreen
          icon={<Bot />}
          title="No agents configured"
          description="Create reusable agent profiles for chats."
          docKey="skills"
        >
          <div className="flex items-center gap-2">
            <button className="inline-flex items-center h-7 px-3 text-xs font-medium rounded-[8px] bg-background shadow-minimal hover:bg-foreground/[0.03] transition-colors" onClick={onCreateAgent}>
              Add Agent
            </button>
            {workspaceRootPath && (
            <EditPopover
              align="center"
              trigger={
                <button className="inline-flex items-center h-7 px-3 text-xs font-medium rounded-[8px] bg-background shadow-minimal hover:bg-foreground/[0.03] transition-colors">
                  Create with AI
                </button>
              }
              {...getEditConfig('add-agent', workspaceRootPath)}
            />
            )}
          </div>
        </EntityListEmptyScreen>
      }
      mapItem={(agent) => {
        const kind = profileKind(agent)
        const summary = [
          agent.model,
          agent.permissionMode ? permissionLabels[agent.permissionMode] : undefined,
          agent.thinkingLevel ? `Think ${agent.thinkingLevel}` : undefined,
        ].filter(Boolean).join(' · ')
        return {
          icon: (
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold" style={{ backgroundColor: agent.color || 'var(--muted)', color: agent.color ? 'white' : undefined }}>
              {agent.icon || <Bot className="h-4 w-4" />}
            </span>
          ),
          title: agent.name,
          badges: (
            <span className="flex items-center gap-1.5 min-w-0">
              <EntityListBadge colorClass={kind === 'user' ? 'bg-primary/10 text-primary' : 'bg-foreground/5 text-muted-foreground'}>{kind}</EntityListBadge>
              <span className="truncate">{agent.description || summary || 'Workspace defaults'}</span>
            </span>
          ),
          menu: (
            <AgentMenu
              agent={agent}
              onOpenInNewWindow={() => window.electronAPI.openUrl(`craftagents://agents/agent/${agent.id}?window=focused`)}
              onDuplicate={() => onDuplicateAgent(agent)}
              onDelete={kind === 'user' ? () => onDeleteAgent(agent) : undefined}
              onImprove={kind === 'user' ? () => onImproveAgent(agent) : undefined}
            />
          ),
        }
      }}
    />
  )
}