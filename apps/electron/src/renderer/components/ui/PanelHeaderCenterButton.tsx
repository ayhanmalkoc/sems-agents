import * as React from 'react'
import { forwardRef } from 'react'
import { Tooltip, TooltipTrigger, TooltipContent } from '@craft-agent/ui'
import { cn } from '@/lib/utils'

interface PanelHeaderCenterButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  /** Icon as React element - caller controls size/styling */
  icon: React.ReactNode
  /** Optional tooltip text */
  tooltip?: string
}

export const PanelHeaderCenterButton = forwardRef<HTMLButtonElement, PanelHeaderCenterButtonProps>(
  ({ icon, tooltip, className, ...props }, ref) => {
    const button = (
      <button
        ref={ref}
        type="button"
        aria-label={props['aria-label'] ?? tooltip}
        className={cn(
          "panel-header-btn inline-flex h-7 min-h-7 w-7 min-w-7 items-center justify-center",
          "p-0 shrink-0 rounded-[6px] titlebar-no-drag",
          "bg-background shadow-minimal",
          "opacity-70 hover:opacity-100",
          "transition-opacity focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
          "disabled:pointer-events-none disabled:opacity-50",
          className
        )}
        {...props}
      >
        <span className="flex h-4 w-4 items-center justify-center">{icon}</span>
      </button>
    )

    if (tooltip) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent>{tooltip}</TooltipContent>
        </Tooltip>
      )
    }

    return button
  }
)
PanelHeaderCenterButton.displayName = 'PanelHeaderCenterButton'
