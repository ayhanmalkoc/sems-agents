import * as React from 'react'
import { ChevronDown, Code2, ExternalLink, FolderOpen, Github, Monitor, Smartphone, Terminal } from 'lucide-react'
import { DropdownMenu, DropdownMenuTrigger, StyledDropdownMenuContent, StyledDropdownMenuItem, StyledDropdownMenuSeparator } from '@/components/ui/styled-dropdown'

interface OpenWithMenuButtonProps {
  path?: string | null
  label?: string
  className?: string
}

export function OpenWithMenuButton({ path, label = 'Open', className }: OpenWithMenuButtonProps) {
  const openFolder = React.useCallback(() => {
    if (path) void window.electronAPI.showInFolder(path)
  }, [path])

  const disabled = !path

  return (
    <DropdownMenu>
      <div className={className ?? 'flex h-7 items-center overflow-hidden rounded-lg border border-foreground/10 bg-background shadow-minimal'}>
        <button
          type="button"
          aria-label="Open workspace"
          onClick={openFolder}
          disabled={disabled}
          className="flex h-full items-center gap-1.5 px-2 text-xs text-foreground transition-colors hover:bg-foreground/5 disabled:pointer-events-none disabled:opacity-50"
        >
          <Code2 className="h-4 w-4 text-blue-500" />
          <span>{label}</span>
        </button>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Choose app"
            disabled={disabled}
            className="flex h-full w-6 items-center justify-center border-l border-foreground/10 text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
      </div>
      <StyledDropdownMenuContent align="end" minWidth="min-w-52">
        <StyledDropdownMenuItem disabled><Code2 className="h-3.5 w-3.5 text-blue-500" />VS Code</StyledDropdownMenuItem>
        <StyledDropdownMenuItem disabled><Monitor className="h-3.5 w-3.5" />Antigravity</StyledDropdownMenuItem>
        <StyledDropdownMenuItem disabled><Github className="h-3.5 w-3.5 text-purple-500" />GitHub Desktop</StyledDropdownMenuItem>
        <StyledDropdownMenuItem disabled={disabled} onClick={openFolder}><ExternalLink className="h-3.5 w-3.5" />Default app</StyledDropdownMenuItem>
        <StyledDropdownMenuItem disabled><Terminal className="h-3.5 w-3.5" />Terminal</StyledDropdownMenuItem>
        <StyledDropdownMenuItem disabled><Terminal className="h-3.5 w-3.5" />Git Bash</StyledDropdownMenuItem>
        <StyledDropdownMenuItem disabled><Smartphone className="h-3.5 w-3.5" />Android Studio</StyledDropdownMenuItem>
        <StyledDropdownMenuSeparator />
        <StyledDropdownMenuItem disabled={disabled} onClick={openFolder}><FolderOpen className="h-3.5 w-3.5" />Open folder</StyledDropdownMenuItem>
      </StyledDropdownMenuContent>
    </DropdownMenu>
  )
}
