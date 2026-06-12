import * as React from 'react'
import { ExternalLink, X } from 'lucide-react'
import { BrowserToolbar } from '@/components/browser/BrowserToolbar'
import { PanelHeaderCenterButton } from '@/components/ui/PanelHeaderCenterButton'
import { useAppShellContext } from '@/context/AppShellContext'
import { cn } from '@/lib/utils'
import type { BrowserInstanceInfo } from '../../../shared/types'

interface WorkspaceBrowserPanelProps {
  tabId: string
  className?: string
  isActive?: boolean
  sessionId?: string | null
  workspaceId?: string | null
  dockRequestId?: string | null
  onTitleChange?: (title: string) => void
  layoutVersion?: string | number
}

export function WorkspaceBrowserPanel({ tabId, className, isActive = true, sessionId, workspaceId, dockRequestId, onTitleChange, layoutVersion = 0 }: WorkspaceBrowserPanelProps) {
  const { activeWorkspaceId } = useAppShellContext()
  const hostRef = React.useRef<HTMLDivElement | null>(null)
  const instanceIdRef = React.useRef<string | null>(null)
  const [instanceId, setInstanceId] = React.useState<string | null>(null)
  const [instanceInfo, setInstanceInfo] = React.useState<BrowserInstanceInfo | null>(null)
  const [starting, setStarting] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null)
  const updateBoundsRef = React.useRef<() => void>(() => {})
  const layoutSettleTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const [isLayoutSettling, setIsLayoutSettling] = React.useState(false)

  const updateBounds = React.useCallback(() => {
    const id = instanceIdRef.current
    const element = hostRef.current
    if (!id || !element) return
    const rect = element.getBoundingClientRect()
    void window.electronAPI.browserPane.setDockBounds(id, {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      visible: isActive && rect.width > 0 && rect.height > 0,
    })
  }, [isActive])

  React.useEffect(() => {
    updateBoundsRef.current = updateBounds
  }, [updateBounds])

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
        const instances = await window.electronAPI.browserPane.list()
        setInstanceInfo(instances.find((instance) => instance.id === id) ?? null)
        if (dockRequestId) {
          completedDockRequest = true
          await window.electronAPI.browserPane.completeDockOpen({ requestId: dockRequestId, instanceId: id })
        }
        console.info('[browser-pane] dock browser created', { tabId, instanceId: id, dockRequestId })
        requestAnimationFrame(() => updateBoundsRef.current())
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
      if (layoutSettleTimerRef.current) {
        clearTimeout(layoutSettleTimerRef.current)
        layoutSettleTimerRef.current = null
      }
      if (dockRequestId && !completedDockRequest) {
        completedDockRequest = true
        void window.electronAPI.browserPane.completeDockOpen({ requestId: dockRequestId, error: 'Dock browser tab was closed before it finished opening.' })
      }
      const id = instanceIdRef.current
      instanceIdRef.current = null
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

  React.useEffect(() => {
    const element = hostRef.current
    if (!element) return
    const observer = new ResizeObserver(() => updateBounds())
    observer.observe(element)
    updateBounds()
    return () => observer.disconnect()
  }, [updateBounds])

  React.useEffect(() => {
    updateBounds()
    if (isActive && instanceIdRef.current) void window.electronAPI.browserPane.focus(instanceIdRef.current)
  }, [isActive, updateBounds])


  React.useEffect(() => {
    if (!instanceIdRef.current) return
    setIsLayoutSettling(true)
    updateBoundsRef.current()
    void window.electronAPI.browserPane.setDockBounds(instanceIdRef.current, {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      visible: false,
    })
    if (layoutSettleTimerRef.current) clearTimeout(layoutSettleTimerRef.current)
    layoutSettleTimerRef.current = setTimeout(() => {
      layoutSettleTimerRef.current = null
      updateBoundsRef.current()
      requestAnimationFrame(() => {
        updateBoundsRef.current()
        setIsLayoutSettling(false)
      })
    }, 180)
  }, [layoutVersion])

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
      <div className="flex shrink-0 items-center gap-1 border-b border-foreground/5 px-2 py-1.5">
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
      <div className="relative min-h-0 flex-1 overflow-hidden bg-background">
        {isLayoutSettling && (
          <div className="absolute inset-0 z-10 bg-background" aria-hidden="true" />
        )}
        <div ref={hostRef} className={cn('h-full min-h-0 overflow-hidden bg-background', (starting || errorMessage) && 'hidden')} />
      </div>
    </div>
  )
}
