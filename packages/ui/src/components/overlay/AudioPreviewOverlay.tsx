import { useEffect, useState } from 'react'
import { Music } from 'lucide-react'
import { PreviewOverlay } from './PreviewOverlay'
import { CopyButton } from './CopyButton'

export interface AudioPreviewOverlayProps {
  isOpen: boolean
  onClose: () => void
  filePath: string
  loadDataUrl: (path: string) => Promise<string>
  theme?: 'light' | 'dark'
}

export function AudioPreviewOverlay({
  isOpen,
  onClose,
  filePath,
  loadDataUrl,
  theme = 'light',
}: AudioPreviewOverlayProps) {
  const [src, setSrc] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (!isOpen || !filePath) return
    let cancelled = false
    setIsLoading(true)
    setError(null)
    setSrc(null)

    loadDataUrl(filePath)
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
  }, [filePath, isOpen, loadDataUrl])

  return (
    <PreviewOverlay
      isOpen={isOpen}
      onClose={onClose}
      theme={theme}
      typeBadge={{ icon: Music, label: 'Audio', variant: 'blue' }}
      filePath={filePath}
      error={error ? { label: 'Load Failed', message: error } : undefined}
      headerActions={<CopyButton content={filePath} title="Copy path" className="bg-background shadow-minimal" />}
    >
      <div className="min-h-full flex flex-col items-center justify-center gap-4 p-8">
        {isLoading && <div className="text-muted-foreground text-sm">Loading audio...</div>}
        {src && (
          <audio
            controls
            preload="metadata"
            src={src}
            className="w-full max-w-2xl"
          />
        )}
        <div className="max-w-2xl truncate text-xs text-muted-foreground">{filePath}</div>
      </div>
    </PreviewOverlay>
  )
}