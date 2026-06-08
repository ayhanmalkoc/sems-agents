import * as React from 'react'
import { FolderOpen, Globe, GitCompare, Plus, Terminal, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { DropdownMenu, DropdownMenuTrigger, StyledDropdownMenuContent, StyledDropdownMenuItem } from '@/components/ui/styled-dropdown'
import { TopBarButton } from '@/components/ui/TopBarButton'
import { cn } from '@/lib/utils'
import { SessionFilesSection } from './SessionFilesSection'

export type RightDockToolType = 'files' | 'browser' | 'inspect' | 'terminal'

export interface RightDockTab {
  id: string
  type: RightDockToolType
}

interface ToolConfig {
  type: RightDockToolType
  label: string
  description: string
  shortcut?: string
  icon: React.ReactNode
}

const TOOL_CONFIGS: ToolConfig[] = [
  { type: 'files', label: 'Files', description: 'Browse session files', shortcut: 'Ctrl+P', icon: <FolderOpen className="h-4 w-4" /> },
  { type: 'browser', label: 'Browser', description: 'Open a web preview', shortcut: 'Ctrl+T', icon: <Globe className="h-4 w-4" /> },
  { type: 'inspect', label: 'Inspect', description: 'Review code changes', shortcut: 'Ctrl+Shift+G', icon: <GitCompare className="h-4 w-4" /> },
  { type: 'terminal', label: 'Terminal', description: 'Start an interactive shell', shortcut: 'Ctrl+`', icon: <Terminal className="h-4 w-4" /> },
]

const TOOL_BY_TYPE = new Map(TOOL_CONFIGS.map((tool) => [tool.type, tool]))

export interface RightWorkspacePanelProps {
  width: number
  tabs: RightDockTab[]
  activeTabId: string | null
  activeSessionId?: string | null
  sessionFolderPath?: string
  onAddTab: (type: RightDockToolType) => void
  onSelectTab: (id: string) => void
  onCloseTab: (id: string) => void
  onClosePanel: () => void
  onResizeStart: (event: React.MouseEvent<HTMLDivElement>) => void
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

function FilesTool({ activeSessionId, sessionFolderPath }: { activeSessionId?: string | null; sessionFolderPath?: string }) {
  if (!activeSessionId) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-muted-foreground">
        <div className="max-w-[260px] space-y-2">
          <FolderOpen className="mx-auto h-8 w-8 text-muted-foreground/70" />
          <div className="text-sm font-medium text-foreground">Select a chat to view files</div>
          <div className="text-xs">Files created or attached during the active chat will appear here.</div>
        </div>
      </div>
    )
  }

  return <SessionFilesSection sessionId={activeSessionId} sessionFolderPath={sessionFolderPath} hideHeader className="h-full" />
}

export function RightWorkspacePanel({
  width,
  tabs,
  activeTabId,
  activeSessionId,
  sessionFolderPath,
  onAddTab,
  onSelectTab,
  onCloseTab,
  onClosePanel,
  onResizeStart,
}: RightWorkspacePanelProps) {
  const { t } = useTranslation()
  const activeTab = tabs.find((tab) => tab.id === activeTabId) ?? null

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col overflow-hidden rounded-[12px] border border-foreground/10 bg-background/70 shadow-minimal backdrop-blur"
      style={{ width }}
    >
      <div
        onMouseDown={onResizeStart}
        className="absolute inset-y-0 left-0 z-10 w-2 cursor-col-resize"
        aria-hidden="true"
      />

      <div className="flex h-10 shrink-0 items-center gap-1 border-b border-foreground/5 px-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {tabs.map((tab) => {
            const tool = TOOL_BY_TYPE.get(tab.type)!
            const selected = tab.id === activeTabId
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
                <span className="truncate">{tool.label}</span>
              </button>
            )
          })}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <TopBarButton aria-label={t('menu.tools')} className="h-7 w-7 rounded-lg">
              <Plus className="h-4 w-4 text-foreground/50" strokeWidth={1.5} />
            </TopBarButton>
          </DropdownMenuTrigger>
          <StyledDropdownMenuContent align="end" minWidth="min-w-48">
            {TOOL_CONFIGS.map((tool) => (
              <StyledDropdownMenuItem key={tool.type} onClick={() => onAddTab(tool.type)}>
                {tool.icon}
                <span className="flex-1">{tool.label}</span>
                {tool.shortcut && <span className="text-xs text-muted-foreground">{tool.shortcut}</span>}
              </StyledDropdownMenuItem>
            ))}
          </StyledDropdownMenuContent>
        </DropdownMenu>

        <TopBarButton aria-label="Close right panel" onClick={onClosePanel} className="h-7 w-7 rounded-lg">
          <X className="h-4 w-4 text-foreground/50" strokeWidth={1.5} />
        </TopBarButton>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeTab ? (
          activeTab.type === 'files' ? (
            <FilesTool activeSessionId={activeSessionId} sessionFolderPath={sessionFolderPath} />
          ) : (
            <PlaceholderTool tool={TOOL_BY_TYPE.get(activeTab.type)!} />
          )
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
    </aside>
  )
}

