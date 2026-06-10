import * as React from 'react'
import { ChevronDown, Code2, FolderOpen, Github, Monitor, Smartphone, Terminal } from 'lucide-react'
import type { OpenTargetId, OpenTargetInfo } from '../../../shared/types'
import { DropdownMenu, DropdownMenuTrigger, StyledDropdownMenuContent, StyledDropdownMenuItem, StyledDropdownMenuSeparator } from '@/components/ui/styled-dropdown'

interface OpenWithMenuButtonProps {
  path?: string | null
  label?: string
  className?: string
  iconOnly?: boolean
}

const TARGET_ICONS: Record<OpenTargetId, React.ReactNode> = {
  vscode: <Code2 className="h-3.5 w-3.5 text-blue-500" />,
  antigravity: <Monitor className="h-3.5 w-3.5" />,
  'github-desktop': <Github className="h-3.5 w-3.5 text-purple-500" />,
  'file-explorer': <FolderOpen className="h-3.5 w-3.5" />,
  terminal: <Terminal className="h-3.5 w-3.5" />,
  'git-bash': <Terminal className="h-3.5 w-3.5" />,
  'android-studio': <Smartphone className="h-3.5 w-3.5" />,
}

function chooseDefaultTarget(targets: OpenTargetInfo[], preferred?: string): OpenTargetInfo | undefined {
  return targets.find((target) => target.id === preferred && target.available)
    ?? targets.find((target) => target.available)
}

export function OpenWithMenuButton({ path, label = 'Open', className, iconOnly = false }: OpenWithMenuButtonProps) {
  const [targets, setTargets] = React.useState<OpenTargetInfo[]>([])
  const [preferredTargetId, setPreferredTargetId] = React.useState<string | undefined>()

  React.useEffect(() => {
    let cancelled = false
    const load = () => {
      void Promise.all([
        window.electronAPI.listOpenTargets().catch(() => []),
        window.electronAPI.readPreferences().catch(() => ({ content: '{}' })),
      ]).then(([nextTargets, preferences]) => {
        if (cancelled) return
        setTargets(nextTargets.filter((target) => target.available))
        try {
          const parsed = JSON.parse(preferences.content || '{}')
          setPreferredTargetId(parsed.openTarget?.defaultTargetId)
        } catch {
          setPreferredTargetId(undefined)
        }
      })
    }
    load()
    window.addEventListener('craft:preferences-updated', load)
    return () => {
      cancelled = true
      window.removeEventListener('craft:preferences-updated', load)
    }
  }, [])

  const defaultTarget = React.useMemo(() => chooseDefaultTarget(targets, preferredTargetId), [targets, preferredTargetId])
  const openDefault = React.useCallback(() => {
    if (path && defaultTarget) void window.electronAPI.launchOpenTarget({ targetId: defaultTarget.id, path })
  }, [defaultTarget, path])

  const disabled = !path || !defaultTarget

  return (
    <DropdownMenu>
      <div className={className ?? 'panel-header-btn inline-flex h-7 min-h-7 items-center overflow-hidden rounded-[6px] bg-background shadow-minimal opacity-70 transition-opacity hover:opacity-100'}>
        <button
          type="button"
          aria-label="Open workspace"
          onClick={openDefault}
          disabled={disabled}
          className="inline-flex h-7 min-h-7 items-center justify-center gap-1.5 px-1.5 text-xs text-foreground transition-colors hover:bg-foreground/5 disabled:pointer-events-none disabled:opacity-50"
        >
          {defaultTarget ? TARGET_ICONS[defaultTarget.id] : <Code2 className="h-4 w-4 text-blue-500" />}
          {!iconOnly && <span>{defaultTarget?.label ?? label}</span>}
        </button>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Choose app"
            disabled={disabled}
            className="inline-flex h-7 min-h-7 items-center justify-center px-1.5 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
      </div>
      <StyledDropdownMenuContent align="end" minWidth="min-w-52">
        {targets.map((target) => (
          <StyledDropdownMenuItem
            key={target.id}
            disabled={!path}
            onClick={() => path && window.electronAPI.launchOpenTarget({ targetId: target.id, path })}
          >
            {TARGET_ICONS[target.id]}
            <span className="flex-1">{target.label}</span>
          </StyledDropdownMenuItem>
        ))}
      </StyledDropdownMenuContent>
    </DropdownMenu>
  )
}
