import * as React from 'react'
import { ExternalLink, X } from 'lucide-react'
import { BrowserToolbar } from '@/components/browser/BrowserToolbar'
import { PanelHeaderCenterButton } from '@/components/ui/PanelHeaderCenterButton'
import { useAppShellContext } from '@/context/AppShellContext'
import { cn } from '@/lib/utils'
import type { BrowserDockBounds, BrowserInstanceInfo } from '../../../shared/types'

interface WorkspaceBrowserPanelProps {
  tabId: string
  className?: string
  isActive?: boolean
  sessionId?: string | null
  workspaceId?: string | null
  dockRequestId?: string | null
  onTitleChange?: (title: string) => void
  onInstanceIdChange?: (instanceId: string | null) => void
}

function rectToDockBounds(rect: DOMRect): BrowserDockBounds {
  return {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    visible: rect.width > 0 && rect.height > 0,
  }
}

function isSameDockBounds(a: BrowserDockBounds | null, b: BrowserDockBounds | null): boolean {
  if (!a || !b) return a === b
  return Math.round(a.x) === Math.round(b.x)
    && Math.round(a.y) === Math.round(b.y)
    && Math.round(a.width) === Math.round(b.width)
    && Math.round(a.height) === Math.round(b.height)
    && a.visible === b.visible
}

export function WorkspaceBrowserPanel({ tabId, className, isActive = true, sessionId, workspaceId, dockRequestId, onTitleChange, onInstanceIdChange }: WorkspaceBrowserPanelProps) {
  const { activeWorkspaceId } = useAppShellContext()
  const instanceIdRef = React.useRef<string | null>(null)
  const onInstanceIdChangeRef = React.useRef<typeof onInstanceIdChange>(onInstanceIdChange)
  const [instanceId, setInstanceId] = React.useState<string | null>(null)
  const [instanceInfo, setInstanceInfo] = React.useState<BrowserInstanceInfo | null>(null)
  const [starting, setStarting] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const contentSlotRef = React.useRef<HTMLDivElement | null>(null)
  const lastDockBoundsRef = React.useRef<BrowserDockBounds | null>(null)
  const updateBoundsRef = React.useRef<(options?: { force?: boolean }) => void>(() => {})

  const updateBounds = React.useCallback((options: { force?: boolean } = {}) => {
    const id = instanceIdRef.current
    if (!id) return
    const element = contentSlotRef.current
    const nextBounds = isActive && element
      ? rectToDockBounds(element.getBoundingClientRect())
      : { x: 0, y: 0, width: 0, height: 0, visible: false }
    const dockBounds = nextBounds.visible ? nextBounds : { x: 0, y: 0, width: 0, height: 0, visible: false }
    if (!options.force && isSameDockBounds(lastDockBoundsRef.current, dockBounds)) return
    lastDockBoundsRef.current = dockBounds
    window.electronAPI.browserPane.setDockBoundsFast(id, dockBounds)
  }, [isActive])

  React.useEffect(() => {
    updateBoundsRef.current = updateBounds
  }, [updateBounds])

  React.useEffect(() => {
    onInstanceIdChangeRef.current = onInstanceIdChange
  }, [onInstanceIdChange])

  React.useEffect(() => {
    let cancelled = false
    let completedDockRequest = false
    async function start() {
      setStarting(true)
      setErrorMessage(null)
      try {
        console.info('[browser-pane] dock tab mounted', { tabId, sessionId, workspaceId, dockRequestId })
        const id = await window.electronAPI.browserPane.create({
          mode: 'dock',
          dockTabId: tabId,
          bindToSessionId: sessionId ?? undefined,
          show: true,
          workspaceId: workspaceId ?? activeWorkspaceId ?? null,
        })
        if (cancelled) {
          await window.electronAPI.browserPane.destroy(id)
          return
        }
        instanceIdRef.current = id
        setInstanceId(id)
        onInstanceIdChangeRef.current?.(id)
        const instances = await window.electronAPI.browserPane.list()
        setInstanceInfo(instances.find((instance) => instance.id === id) ?? null)
        if (dockRequestId) {
          completedDockRequest = true
          await window.electronAPI.browserPane.completeDockOpen({ requestId: dockRequestId, instanceId: id })
        }
        console.info('[browser-pane] dock browser created', { tabId, instanceId: id, dockRequestId })
        updateBoundsRef.current()
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to start browser'
        setErrorMessage(message)
        if (dockRequestId && !completedDockRequest) {
          completedDockRequest = true
          await window.electronAPI.browserPane.completeDockOpen({ requestId: dockRequestId, error: message })
        }
      } finally {
        if (!cancelled) setStarting(false)
      }
    }
    void start()
    return () => {
      cancelled = true
      if (dockRequestId && !completedDockRequest) {
        completedDockRequest = true
        void window.electronAPI.browserPane.completeDockOpen({ requestId: dockRequestId, error: 'Dock browser tab was closed before it finished opening.' })
      }
      const id = instanceIdRef.current
      instanceIdRef.current = null
      onInstanceIdChangeRef.current?.(null)
      if (id) void window.electronAPI.browserPane.destroy(id)
    }
  }, [activeWorkspaceId, dockRequestId, sessionId, tabId, workspaceId])

  React.useEffect(() => {
    const offState = window.electronAPI.browserPane.onStateChanged((info) => {
      if (info.id !== instanceIdRef.current) return
      setInstanceInfo(info)
      onTitleChange?.(info.title && info.title !== 'New Tab' ? info.title : 'Browser')
    })
    const offRemoved = window.electronAPI.browserPane.onRemoved((id) => {
      if (id !== instanceIdRef.current) return
      instanceIdRef.current = null
      setInstanceId(null)
      setInstanceInfo(null)
    })
    return () => {
      offState()
      offRemoved()
    }
  }, [onTitleChange])

  React.useLayoutEffect(() => {
    lastDockBoundsRef.current = null
    updateBounds({ force: true })
    let frame = 0
    if (!isActive || !instanceIdRef.current) {
      return () => {
        if (frame) cancelAnimationFrame(frame)
      }
    }

    void window.electronAPI.browserPane.focus(instanceIdRef.current)
    let frameCount = 0
    let stableCount = 0
    let lastKey = ''
    const syncUntilStable = () => {
      updateBounds({ force: true })
      const rect = contentSlotRef.current?.getBoundingClientRect()
      const key = rect
        ? `${Math.round(rect.x)}:${Math.round(rect.y)}:${Math.round(rect.width)}:${Math.round(rect.height)}`
        : 'none'
      stableCount = key === lastKey ? stableCount + 1 : 0
      lastKey = key
      frameCount += 1
      if (frameCount < 30 && stableCount < 3) {
        frame = requestAnimationFrame(syncUntilStable)
      }
    }
    frame = requestAnimationFrame(syncUntilStable)
    return () => {
      if (frame) cancelAnimationFrame(frame)
    }
  }, [isActive, updateBounds])

  React.useLayoutEffect(() => {
    const element = contentSlotRef.current
    if (!element) {
      updateBounds()
      return
    }
    let frame = 0
    const schedule = () => {
      if (frame) cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => updateBounds())
    }
    const observer = new ResizeObserver(schedule)
    observer.observe(element)
    schedule()
    return () => {
      if (frame) cancelAnimationFrame(frame)
      observer.disconnect()
    }
  }, [updateBounds])

  const id = instanceId
  const navigate = React.useCallback((url: string) => { if (id) void window.electronAPI.browserPane.navigate(id, url) }, [id])
  const goBack = React.useCallback(() => { if (id) void window.electronAPI.browserPane.goBack(id) }, [id])
  const goForward = React.useCallback(() => { if (id) void window.electronAPI.browserPane.goForward(id) }, [id])
  const reload = React.useCallback(() => { if (id) void window.electronAPI.browserPane.reload(id) }, [id])
  const stop = React.useCallback(() => { if (id) void window.electronAPI.browserPane.stop(id) }, [id])
  const openWindow = React.useCallback(async () => {
    if (!id || !instanceInfo?.url) return
    const newId = await window.electronAPI.browserPane.create({ show: true, workspaceId: activeWorkspaceId ?? null })
    await window.electronAPI.browserPane.navigate(newId, instanceInfo.url)
    await window.electronAPI.browserPane.focus(newId)
  }, [activeWorkspaceId, id, instanceInfo?.url])

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-background', className)}>
      <div className="flex h-11 shrink-0 items-center gap-1 border-b border-foreground/5 px-2">
        <div className="min-w-0 flex-1">
          <BrowserToolbar
            compact
            instanceInfo={instanceInfo}
            onNavigate={navigate}
            onGoBack={goBack}
            onGoForward={goForward}
            onReload={reload}
            onStop={stop}
          />
        </div>
        <PanelHeaderCenterButton aria-label="Open browser in window" tooltip="Open in browser window" disabled={!id} onClick={() => void openWindow()} icon={<ExternalLink className="h-3.5 w-3.5" />} />
        <PanelHeaderCenterButton aria-label="Close browser" tooltip="Close browser" disabled={!id} onClick={() => id && window.electronAPI.browserPane.destroy(id)} icon={<X className="h-3.5 w-3.5" />} />
      </div>
      {errorMessage ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-destructive">{errorMessage}</div>
      ) : starting ? (
        <div className="flex flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">Starting browser...</div>
      ) : null}
      <div ref={contentSlotRef} className={cn('min-h-0 flex-1 overflow-hidden bg-background', (starting || errorMessage) && 'hidden')} />
    </div>
  )
}
