import * as React from 'react'
import { Maximize2, Music } from 'lucide-react'
import { cn } from '../../lib/utils'
import { CodeBlock } from './CodeBlock'
import { AudioPreviewOverlay } from '../overlay/AudioPreviewOverlay'
import { usePlatform } from '../../context/PlatformContext'

interface AudioPreviewSpec {
  src?: string
  title?: string
}

export interface MarkdownAudioBlockProps {
  code: string
  className?: string
}

export function MarkdownAudioBlock({ code, className }: MarkdownAudioBlockProps) {
  const { onReadFileDataUrl } = usePlatform()
  const spec = React.useMemo<AudioPreviewSpec | null>(() => {
    try {
      const raw = JSON.parse(code)
      if (raw.src && typeof raw.src === 'string') return raw as AudioPreviewSpec
      return null
    } catch {
      return null
    }
  }, [code])

  const [src, setSrc] = React.useState<string | null>(null)
  const [error, setError] = React.useState<string | null>(null)
  const [isLoading, setIsLoading] = React.useState(false)
  const [isFullscreen, setIsFullscreen] = React.useState(false)

  React.useEffect(() => {
    if (!spec?.src || !onReadFileDataUrl) return
    let cancelled = false
    setIsLoading(true)
    setError(null)
    setSrc(null)
    onReadFileDataUrl(spec.src)
      .then((url) => {
        if (cancelled) return
        setSrc(url)
        setIsLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Failed to load audio')
        setIsLoading(false)
      })
    return () => { cancelled = true }
  }, [onReadFileDataUrl, spec?.src])

  if (!spec?.src || !onReadFileDataUrl) {
    return <CodeBlock code={code} language="json" mode="full" className={className} />
  }

  return (
    <div className={cn('group relative overflow-hidden rounded-lg border border-border bg-background p-4 shadow-minimal', className)}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <Music className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <div className="truncate text-sm font-medium">{spec.title || 'Audio preview'}</div>
            <div className="truncate text-xs text-muted-foreground">{spec.src}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setIsFullscreen(true)}
          className="rounded-md bg-foreground/5 p-1.5 text-foreground/60 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
          title="Expand"
        >
          <Maximize2 className="size-4" />
        </button>
      </div>
      {isLoading && <div className="py-3 text-sm text-muted-foreground">Loading audio...</div>}
      {error && <div className="py-3 text-sm text-destructive">{error}</div>}
      {src && <audio controls preload="metadata" src={src} className="w-full" />}
      {isFullscreen && (
        <AudioPreviewOverlay
          isOpen
          onClose={() => setIsFullscreen(false)}
          filePath={spec.src}
          loadDataUrl={onReadFileDataUrl}
        />
      )}
    </div>
  )
}