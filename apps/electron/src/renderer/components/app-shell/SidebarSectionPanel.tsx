import * as React from 'react'

export interface SidebarSectionPanelProps {
  title: React.ReactNode
  action?: React.ReactNode
  filters?: React.ReactNode
  children: React.ReactNode
}

export function SidebarSectionPanel({ title, action, filters, children }: SidebarSectionPanelProps) {
  return (
    <div className="flex min-h-full flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between px-3">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          {title}
        </span>
        {action}
      </div>
      {filters}
      {children}
    </div>
  )
}
