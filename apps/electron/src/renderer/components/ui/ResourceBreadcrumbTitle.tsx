import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ResourceBreadcrumbTitleProps {
  rootLabel: string
  currentLabel: string
  onRootClick: () => void
  middleLabel?: string
  className?: string
}

export function ResourceBreadcrumbTitle({
  rootLabel,
  middleLabel,
  currentLabel,
  onRootClick,
  className,
}: ResourceBreadcrumbTitleProps) {
  return (
    <div className={cn('flex min-w-0 items-center gap-1 text-sm font-sans leading-tight', className)}>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onRootClick()
        }}
        className="titlebar-no-drag shrink-0 rounded-[5px] px-1 py-0.5 font-medium text-muted-foreground transition-colors hover:bg-foreground/5 hover:text-foreground"
      >
        {rootLabel}
      </button>
      {middleLabel && (
        <>
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
          <span className="shrink-0 rounded-[5px] px-1 py-0.5 font-medium text-muted-foreground">
            {middleLabel}
          </span>
        </>
      )}
      <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
      <span className="truncate px-1 py-0.5 font-semibold text-foreground">
        {currentLabel}
      </span>
    </div>
  )
}