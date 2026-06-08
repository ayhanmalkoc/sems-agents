import * as React from 'react'
import { cn } from '@/lib/utils'

export interface SidebarFilterPillItem {
  key: string
  label: React.ReactNode
  count?: number
  active: boolean
  onClick: () => void
}

export interface SidebarFilterPillsProps {
  items: SidebarFilterPillItem[]
  className?: string
}

export function SidebarFilterPills({ items, className }: SidebarFilterPillsProps) {
  return (
    <div className={cn('flex shrink-0 gap-1 overflow-x-auto px-3 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden', className)}>
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          onClick={item.onClick}
          className={cn(
            'inline-flex h-7 shrink-0 items-center gap-1 rounded-[7px] px-2 text-xs transition-colors',
            item.active
              ? 'bg-foreground/8 text-foreground'
              : 'text-muted-foreground hover:bg-foreground/4 hover:text-foreground'
          )}
        >
          <span className="truncate">{item.label}</span>
          {typeof item.count === 'number' && (
            <span className="text-[10px] text-muted-foreground/70">{item.count}</span>
          )}
        </button>
      ))}
    </div>
  )
}
