import * as React from 'react'
import { FolderOpen, Globe, GitCompare, Maximize2, MessageSquare, Minimize2, PanelRight, Plus, Terminal, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { TopBarButton } from '@/components/ui/TopBarButton'
import { PanelHeaderCenterButton } from '@/components/ui/PanelHeaderCenterButton'
import { cn } from '@/lib/utils'
import { WorkspaceFilesPanel } from './WorkspaceFilesPanel'
import { WorkspaceTerminalPanel } from './WorkspaceTerminalPanel'
import { WorkspaceBrowserPanel } from './WorkspaceBrowserPanel'

export type RightDockToolType = 'chat' | 'files' | 'browser' | 'inspect' | 'terminal'
export type RightDockLayoutPhase = 'idle' | 'resizing'

export interface RightDockTab {
  id: string
  type: RightDockToolType
  title?: string
  content?: React.ReactNode
  browserSessionId?: string | null
  browserWorkspaceId?: string | null
  browserDockRequestId?: string | null
  browserInstanceId?: string | null
}

interface ToolConfig {
  type: RightDockToolType
  label: string
  description: string
  shortcut?: string
  icon: React.ReactNode
}

const TOOL_CONFIGS: ToolConfig[] = [
  { type: 'chat', label: 'Chat', description: 'Open a chat in the side panel', icon: <MessageSquare className="h-4 w-4" /> },
  { type: 'files', label: 'Files', description: 'Browse session files', shortcut: 'Ctrl+P', icon: <FolderOpen className="h-4 w-4" /> },
  { type: 'browser', label: 'Browser', description: 'Open a web preview', shortcut: 'Ctrl+T', icon: <Globe className="h-4 w-4" /> },
  { type: 'inspect', label: 'Inspect', description: 'Review code changes', shortcut: 'Ctrl+Shift+G', icon: <GitCompare className="h-4 w-4" /> },
  { type: 'terminal', label: 'Terminal', description: 'Start an interactive shell', shortcut: 'Ctrl+`', icon: <Terminal className="h-4 w-4" /> },
]

const TOOL_BY_TYPE = new Map(TOOL_CONFIGS.map((tool) => [tool.type, tool]))

export interface RightWorkspacePanelProps {
  isOpen?: boolean
  tabs: RightDockTab[]
  activeTabId: string | null
  activeSessionId?: string | null
  sessionFolderPath?: string
  onAddTab: (type: RightDockToolType) => void
  onSelectTab: (id: string) => void
  onCloseTab: (id: string) => void
  onUpdateTabTitle?: (id: string, title: string) => void
  onUpdateBrowserInstanceId?: (id: string, instanceId: string | null) => void
  isExpanded?: boolean
  onToggleExpanded?: () => void
  layoutPhase?: RightDockLayoutPhase
}

function PlaceholderTool({ tool }: { tool: ToolConfig }) {
  return (
    <div className="flex h-full items-center justify-center p-6 text-center text-muted-foreground">
      <div className="max-w-[260px] space-y-2">
        <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-foreground/5 text-foreground/70">
          {tool.icon}
        </div>
        <div className="text-sm font-medium text-foreground">{tool.label}</div>
        <div className="text-xs">{tool.label} panel coming next.</div>
      </div>
    </div>
  )
}

function FilesTool({ tabId, onUpdateTabTitle }: { tabId: string; onUpdateTabTitle?: (id: string, title: string) => void }) {
  return <WorkspaceFilesPanel className="h-full" onTitleChange={(title) => onUpdateTabTitle?.(tabId, title)} />
}

function TerminalTool({ tabId, isActive, onUpdateTabTitle }: { tabId: string; isActive: boolean; onUpdateTabTitle?: (id: string, title: string) => void }) {
  return <WorkspaceTerminalPanel className="h-full" isActive={isActive} onTitleChange={(title) => onUpdateTabTitle?.(tabId, title)} />
}

function BrowserTool({ tab, isActive, onUpdateTabTitle, onUpdateBrowserInstanceId }: { tab: RightDockTab; isActive: boolean; onUpdateTabTitle?: (id: string, title: string) => void; onUpdateBrowserInstanceId?: (id: string, instanceId: string | null) => void }) {
  return <WorkspaceBrowserPanel tabId={tab.id} sessionId={tab.browserSessionId ?? null} workspaceId={tab.browserWorkspaceId ?? null} dockRequestId={tab.browserDockRequestId ?? null} className="h-full" isActive={isActive} onTitleChange={(title) => onUpdateTabTitle?.(tab.id, title)} onInstanceIdChange={(instanceId) => onUpdateBrowserInstanceId?.(tab.id, instanceId)} />
}


export function RightWorkspacePanel({
  isOpen = true,
  tabs,
  activeTabId,
  activeSessionId,
  sessionFolderPath,
  onAddTab,
  onSelectTab,
  onCloseTab,
  onUpdateTabTitle,
  onUpdateBrowserInstanceId,
  isExpanded = false,
  onToggleExpanded,
  layoutPhase = 'idle',
}: RightWorkspacePanelProps) {
  const { t } = useTranslation()
  const handleAddTool = React.useCallback(async () => {
    const selected = await window.electronAPI.rightDock.showAddToolMenu()
    if (selected) onAddTab(selected)
  }, [onAddTab])

  return (
    <aside
      data-layout-phase={layoutPhase}
      className="relative flex h-full w-full shrink-0 flex-col overflow-hidden rounded-[12px] bg-foreground-2 shadow-middle"
    >
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex h-[42px] shrink-0 items-center gap-1 border-b border-foreground/5 px-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => {
            const tool = TOOL_BY_TYPE.get(tab.type)!
            const selected = isOpen && tab.id === activeTabId
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onSelectTab(tab.id)}
                className={cn(
                  'group flex h-7 max-w-[140px] shrink-0 items-center gap-1.5 rounded-[8px] px-2 text-xs transition-colors',
                  selected ? 'bg-foreground/8 text-foreground' : 'text-muted-foreground hover:bg-foreground/4 hover:text-foreground'
                )}
              >
                <span className="grid h-3.5 w-3.5 place-items-center">
                  <span className="group-hover:hidden">{tool.icon}</span>
                  <span
                    className="hidden group-hover:grid"
                    onClick={(event) => {
                      event.stopPropagation()
                      onCloseTab(tab.id)
                    }}
                  >
                    <X className="h-3.5 w-3.5" />
                  </span>
                </span>
                <span className="truncate">{tab.title ?? tool.label}</span>
              </button>
            )
          })}
          {tabs.length > 0 && (
            <TopBarButton aria-label={t('menu.tools')} onClick={() => void handleAddTool()} className="h-7 w-7 shrink-0 rounded-lg">
              <Plus className="h-4 w-4 text-foreground/50" strokeWidth={1.5} />
            </TopBarButton>
          )}
        </div>

          <div className="flex shrink-0 items-center gap-1.5">
            {onToggleExpanded && (
              <PanelHeaderCenterButton
                aria-label={isExpanded ? 'Restore right tools panel' : 'Expand right tools panel'}
                tooltip={isExpanded ? 'Restore right tools panel' : 'Expand right tools panel'}
                onClick={onToggleExpanded}
                className={isExpanded ? 'opacity-100 bg-foreground/8' : undefined}
                icon={isExpanded ? <Minimize2 className="h-4 w-4 text-foreground/60" strokeWidth={1.6} /> : <Maximize2 className="h-4 w-4 text-foreground/60" strokeWidth={1.6} />}
              />
            )}
            <div data-right-dock-toggle-anchor="true" aria-hidden="true" className="h-7 w-7 shrink-0 overflow-hidden rounded-lg">
              <PanelHeaderCenterButton
                aria-label="Right tools panel placeholder"
                tabIndex={-1}
                disabled
                className="pointer-events-none invisible"
                icon={<PanelRight className="h-4 w-4" />}
              />
            </div>
          </div>
        </div>

        <div className="relative min-h-0 flex-1 overflow-hidden">
        {tabs.length > 0 ? (
          tabs.map((tab) => {
            const selected = isOpen && tab.id === activeTabId
            return (
              <div key={tab.id} className={cn('absolute inset-0 min-h-0', selected ? 'block' : 'hidden')}>
                {tab.content ? (
                  tab.content
                ) : tab.type === 'files' ? (
                  <FilesTool tabId={tab.id} onUpdateTabTitle={onUpdateTabTitle} />
                ) : tab.type === 'terminal' ? (
                  <TerminalTool tabId={tab.id} isActive={selected} onUpdateTabTitle={onUpdateTabTitle} />
                ) : tab.type === 'browser' ? (
                  <BrowserTool tab={tab} isActive={selected} onUpdateTabTitle={onUpdateTabTitle} onUpdateBrowserInstanceId={onUpdateBrowserInstanceId} />
                ) : (
                  <PlaceholderTool tool={TOOL_BY_TYPE.get(tab.type)!} />
                )}
              </div>
            )
          })
        ) : (
          <div className="grid h-full content-center gap-3 p-4 sm:grid-cols-2">
            {TOOL_CONFIGS.map((tool) => (
              <button
                key={tool.type}
                type="button"
                onClick={() => onAddTab(tool.type)}
                className="flex min-h-[132px] flex-col items-center justify-center gap-2 rounded-[12px] bg-foreground/[0.03] p-4 text-center transition-colors hover:bg-foreground/[0.06]"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-background shadow-minimal text-muted-foreground">
                  {tool.icon}
                </div>
                <div className="text-sm font-medium text-foreground">{tool.label}</div>
                <div className="text-xs text-muted-foreground">{tool.description}</div>
                {tool.shortcut && <div className="rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] text-muted-foreground">{tool.shortcut}</div>}
              </button>
            ))}
          </div>
        )}
        </div>
      </div>
    </aside>
  )
}

