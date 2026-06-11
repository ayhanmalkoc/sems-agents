import * as React from 'react'
import { ChevronDown, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AIAssistedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  label: React.ReactNode
  showChevron?: boolean
}

export const AIAssistedButton = React.forwardRef<HTMLButtonElement, AIAssistedButtonProps>(
  function AIAssistedButton({ label, showChevron = false, className, children, ...props }, ref) {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'header-icon-btn titlebar-no-drag inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-[8px] border border-foreground/6 bg-background px-3 text-xs font-medium leading-none text-foreground transition-colors hover:bg-foreground/5 data-[state=open]:bg-foreground/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50',
          className,
        )}
        {...props}
      >
        <Sparkles className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="leading-none">{label}</span>
        {children}
        {showChevron && <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
      </button>
    )
  },
)
