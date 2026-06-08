import * as React from 'react'
import { RotateCcw, Square, Trash2 } from 'lucide-react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { useAppShellContext } from '@/context/AppShellContext'
import { PanelHeaderCenterButton } from '@/components/ui/PanelHeaderCenterButton'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface WorkspaceTerminalPanelProps {
  className?: string
  onTitleChange?: (title: string) => void
}

function basename(path: string): string {
  const normalized = path.replace(/\\/g, '/')
  return normalized.split('/').filter(Boolean).pop() || path
}

export function WorkspaceTerminalPanel({ className, onTitleChange }: WorkspaceTerminalPanelProps) {
  const { activeWorkspaceId, workspaces } = useAppShellContext()
  const activeWorkspace = React.useMemo(
    () => workspaces.find((workspace) => workspace.id === activeWorkspaceId) ?? null,
    [activeWorkspaceId, workspaces]
  )
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const terminalRef = React.useRef<Terminal | null>(null)
  const fitAddonRef = React.useRef<FitAddon | null>(null)
  const terminalIdRef = React.useRef<string | null>(null)
  const [cwd, setCwd] = React.useState<string | null>(null)
  const [shell, setShell] = React.useState<string | null>(null)
  const [exited, setExited] = React.useState(false)
  const [starting, setStarting] = React.useState(false)

  const disposeTerminal = React.useCallback(async (kill: boolean) => {
    const id = terminalIdRef.current
    terminalIdRef.current = null
    if (kill && id) {
      try { await window.electronAPI.terminalKill(id) } catch { /* noop */ }
    }
    terminalRef.current?.dispose()
    terminalRef.current = null
    fitAddonRef.current = null
  }, [])

  const fit = React.useCallback(() => {
    const terminal = terminalRef.current
    const fitAddon = fitAddonRef.current
    const id = terminalIdRef.current
    if (!terminal || !fitAddon) return
    try {
      fitAddon.fit()
      if (id) void window.electronAPI.terminalResize(id, terminal.cols, terminal.rows)
    } catch {
      // xterm can throw while hidden during first layout; next resize handles it.
    }
  }, [])

  const startTerminal = React.useCallback(async () => {
    if (!activeWorkspace?.rootPath || !containerRef.current) return
    setStarting(true)
    setExited(false)
    await disposeTerminal(true)

    const terminal = new Terminal({
      cursorBlink: true,
      convertEol: true,
      fontFamily: 'var(--font-mono), Consolas, "Liberation Mono", monospace',
      fontSize: 12,
      lineHeight: 1.25,
      theme: {
        background: '#00000000',
        foreground: '#d4d4d8',
        cursor: '#f4f4f5',
        selectionBackground: '#71717a55',
      },
      allowProposedApi: false,
    })
    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)
    terminal.open(containerRef.current)
    terminalRef.current = terminal
    fitAddonRef.current = fitAddon
    terminal.writeln('Starting terminal...')

    try {
      fitAddon.fit()
      const created = await window.electronAPI.createTerminal({
        cwd: activeWorkspace.rootPath,
        cols: terminal.cols,
        rows: terminal.rows,
      })
      terminalIdRef.current = created.id
      setCwd(created.cwd)
      setShell(created.shell)
      onTitleChange?.('Terminal')
      terminal.clear()
      terminal.onData((data) => {
        const id = terminalIdRef.current
        if (id) void window.electronAPI.terminalInput(id, data)
      })
      fit()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start terminal'
      terminal.writeln(`\r\n${message}`)
      toast.error(message)
      setExited(true)
    } finally {
      setStarting(false)
    }
  }, [activeWorkspace?.rootPath, disposeTerminal, fit, onTitleChange])

  React.useEffect(() => {
    const offData = window.electronAPI.onTerminalData((event) => {
      if (event.id === terminalIdRef.current) terminalRef.current?.write(event.data)
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
  }, [])

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
          <div className="truncate text-xs font-medium text-foreground">{shell ? basename(shell) : 'Terminal'}</div>
          <div className="truncate text-[10px] text-muted-foreground">{cwd ?? activeWorkspace.rootPath}</div>
        </div>
        <PanelHeaderCenterButton aria-label="Restart terminal" tooltip="Restart terminal" disabled={starting} onClick={() => void startTerminal()} icon={<RotateCcw className="h-3.5 w-3.5" />} />
        <PanelHeaderCenterButton aria-label="Clear terminal" tooltip="Clear terminal" onClick={() => terminalRef.current?.clear()} icon={<Trash2 className="h-3.5 w-3.5" />} />
        <PanelHeaderCenterButton aria-label="Stop terminal" tooltip="Stop terminal" disabled={!terminalIdRef.current && exited} onClick={() => void disposeTerminal(true).then(() => setExited(true))} icon={<Square className="h-3.5 w-3.5" />} />
      </div>
      <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden px-2 py-2 [&_.xterm]:h-full [&_.xterm-viewport]:!bg-transparent" />
    </div>
  )
}