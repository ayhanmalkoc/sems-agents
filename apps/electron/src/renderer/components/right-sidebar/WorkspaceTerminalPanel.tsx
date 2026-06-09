import * as React from 'react'
import { RotateCcw, Square, Trash2 } from 'lucide-react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useAppShellContext } from '@/context/AppShellContext'
import { PanelHeaderCenterButton } from '@/components/ui/PanelHeaderCenterButton'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useTheme } from '@/context/ThemeContext'

interface WorkspaceTerminalPanelProps {
  className?: string
  isActive?: boolean
  onTitleChange?: (title: string) => void
}

function basename(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  return normalized.split('/').filter(Boolean).pop() || path
}

export function WorkspaceTerminalPanel({ className, isActive = true, onTitleChange }: WorkspaceTerminalPanelProps) {
  const { activeWorkspaceId, workspaces } = useAppShellContext()
  const { isDark } = useTheme()
  const activeWorkspace = React.useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null,
    [activeWorkspaceId, workspaces]
  )
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const terminalRef = React.useRef<Terminal | null>(null)
  const fitAddonRef = React.useRef<FitAddon | null>(null)
  const terminalIdRef = React.useRef<string | null>(null)
  const startGenerationRef = React.useRef(0)
  const isActiveRef = React.useRef(isActive)
  const onTitleChangeRef = React.useRef(onTitleChange)
  const [cwd, setCwd] = React.useState<string | null>(null)
  const [shell, setShell] = React.useState<string | null>(null)
  const [exited, setExited] = React.useState(false)
  const [starting, setStarting] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)

  React.useEffect(() => {
    onTitleChangeRef.current = onTitleChange
  }, [onTitleChange])

  React.useEffect(() => {
    isActiveRef.current = isActive
  }, [isActive])

  const disposeTerminal = React.useCallback(async (kill: boolean) => {
    const id = terminalIdRef.current
    terminalIdRef.current = null
    terminalRef.current?.dispose()
    terminalRef.current = null
    fitAddonRef.current = null
    containerRef.current?.replaceChildren()
    if (kill && id) {
      try { await window.electronAPI.terminalKill(id) } catch { /* noop */ }
    }
  }, [])

  const fit = React.useCallback(() => {
    const terminal = terminalRef.current
    const fitAddon = fitAddonRef.current
    const id = terminalIdRef.current
    if (!terminal || !fitAddon) return
    try {
      fitAddon.fit()
      if (id && Number.isFinite(terminal.cols) && Number.isFinite(terminal.rows)) void window.electronAPI.terminalResize(id, terminal.cols, terminal.rows)
    } catch {
      // xterm can throw while hidden during first layout; next resize handles it.
    }
  }, [])

  const focusTerminal = React.useCallback(() => {
    if (!isActiveRef.current) return
    requestAnimationFrame(() => {
      terminalRef.current?.focus()
    })
  }, [])

  const scrollTerminalToPrompt = React.useCallback(() => {
    requestAnimationFrame(() => {
      terminalRef.current?.scrollToBottom()
    })
  }, [])

  const startTerminal = React.useCallback(async () => {
    if (!activeWorkspace?.rootPath || !containerRef.current) return
    const startGeneration = startGenerationRef.current + 1
    startGenerationRef.current = startGeneration
    setStarting(true)
    setExited(false)
    setErrorMessage(null)
    await disposeTerminal(true)
    if (startGenerationRef.current !== startGeneration || !containerRef.current) return
    containerRef.current.replaceChildren()

    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: 'var(--font-mono), Consolas, "Liberation Mono", monospace',
      fontSize: 12,
      lineHeight: 1.25,
      theme: isDark ? {
        background: '#111113',
        foreground: '#f4f4f5',
        cursor: '#f4f4f5',
        selectionBackground: '#71717a88',
      } : {
        background: '#ffffff',
        foreground: '#111827',
        cursor: '#111827',
        selectionBackground: '#94a3b866',
      },
      allowProposedApi: false,
    })
    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(containerRef.current)
    terminalRef.current = terminal
    fitAddonRef.current = fitAddon
    terminal.writeln('Starting terminal...')
    focusTerminal()

    try {
      try { fitAddon.fit() } catch { /* layout may not be ready on first open */ }
      const cols = Number.isFinite(terminal.cols) && terminal.cols > 0 ? terminal.cols : 80
      const rows = Number.isFinite(terminal.rows) && terminal.rows > 0 ? terminal.rows : 24
      const created = await window.electronAPI.createTerminal({
        workspaceId: activeWorkspace.id,
        cwd: activeWorkspace.rootPath,
        cols,
        rows,
      })
      terminalIdRef.current = created.id
      setCwd(created.cwd)
      setShell(created.shell)
      onTitleChangeRef.current?.('Terminal')
      terminal.clear()
      scrollTerminalToPrompt()
      focusTerminal()
      terminal.onData((data) => {
        const id = terminalIdRef.current
        if (id) void window.electronAPI.terminalInput(id, data)
      })
      fit()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start terminal'
      terminal.writeln(`\r\n${message}`)
      setErrorMessage(message)
      toast.error(message)
      setExited(true)
    } finally {
      setStarting(false)
    }
  }, [activeWorkspace?.id, activeWorkspace?.rootPath, disposeTerminal, fit, focusTerminal, isDark, scrollTerminalToPrompt])

  React.useEffect(() => {
    const offData = window.electronAPI.onTerminalData((event) => {
      if (event.id === terminalIdRef.current) {
        terminalRef.current?.write(event.data)
        scrollTerminalToPrompt()
      }
    })
    const offExit = window.electronAPI.onTerminalExit((event) => {
      if (event.id !== terminalIdRef.current) return
      terminalIdRef.current = null
      setExited(true)
      terminalRef.current?.writeln(`\r\n[process exited${event.exitCode != null ? ` with code ${event.exitCode}` : ''}]`)
    })
    return () => {
      offData()
      offExit()
    }
  }, [scrollTerminalToPrompt])

  React.useEffect(() => {
    void startTerminal()
    return () => { void disposeTerminal(true) }
  }, [startTerminal, disposeTerminal])

  React.useEffect(() => {
    const element = containerRef.current
    if (!element) return
    const observer = new ResizeObserver(() => fit())
    observer.observe(element)
    return () => observer.disconnect()
  }, [fit])

  React.useEffect(() => {
    if (!starting && terminalRef.current) focusTerminal()
  }, [focusTerminal, starting])

  React.useEffect(() => {
    if (!isActive || !terminalRef.current) return
    fit()
    focusTerminal()
  }, [fit, focusTerminal, isActive])

  if (!activeWorkspace?.rootPath) {
    return (
      <div className={cn('flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground', className)}>
        Select a workspace to start a terminal.
      </div>
    )
  }

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-background', className)}>
      <div className="flex h-10 shrink-0 items-center gap-2 border-b border-foreground/5 px-3">
        <div className="min-w-0 flex-1">
          <div className="truncate text-xs font-medium text-foreground">{shell ? basename(shell) : starting ? 'Starting terminal...' : 'Terminal'}</div>
          <div className="truncate text-[10px] text-muted-foreground">{errorMessage ?? cwd ?? activeWorkspace.rootPath}</div>
        </div>
        <PanelHeaderCenterButton aria-label="Restart terminal" tooltip="Restart terminal" disabled={starting} onClick={() => void startTerminal()} icon={<RotateCcw className="h-3.5 w-3.5" />} />
        <PanelHeaderCenterButton aria-label="Clear terminal" tooltip="Clear terminal" onClick={() => terminalRef.current?.clear()} icon={<Trash2 className="h-3.5 w-3.5" />} />
        <PanelHeaderCenterButton aria-label="Stop terminal" tooltip="Stop terminal" disabled={!terminalIdRef.current && exited} onClick={() => void disposeTerminal(true).then(() => setExited(true))} icon={<Square className="h-3.5 w-3.5" />} />
      </div>
      <div
        ref={containerRef}
        onMouseDown={focusTerminal}
        onClick={focusTerminal}
        className={cn(
          'min-h-0 flex-1 cursor-text overflow-hidden [&_.xterm]:h-full [&_.xterm-screen]:h-full [&_.xterm-viewport]:!h-full',
          isDark ? 'bg-[#111113]' : 'bg-white'
        )}
      />
    </div>
  )
}
