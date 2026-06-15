import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export interface AgentTemplate {
  id: string
  icon: string
  titleKey: string
  descriptionKey: string
  promptKey: string
}

export const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: 'code-reviewer',
    icon: 'CR',
    titleKey: 'agents.template.codeReviewer.title',
    descriptionKey: 'agents.template.codeReviewer.description',
    promptKey: 'agents.template.codeReviewer.prompt',
  },
  {
    id: 'researcher',
    icon: 'R',
    titleKey: 'agents.template.researcher.title',
    descriptionKey: 'agents.template.researcher.description',
    promptKey: 'agents.template.researcher.prompt',
  },
  {
    id: 'debugger',
    icon: 'D',
    titleKey: 'agents.template.debugger.title',
    descriptionKey: 'agents.template.debugger.description',
    promptKey: 'agents.template.debugger.prompt',
  },
  {
    id: 'planner',
    icon: 'P',
    titleKey: 'agents.template.planner.title',
    descriptionKey: 'agents.template.planner.description',
    promptKey: 'agents.template.planner.prompt',
  },
  {
    id: 'docs-writer',
    icon: 'DW',
    titleKey: 'agents.template.docsWriter.title',
    descriptionKey: 'agents.template.docsWriter.description',
    promptKey: 'agents.template.docsWriter.prompt',
  },
  {
    id: 'test-writer',
    icon: 'TW',
    titleKey: 'agents.template.testWriter.title',
    descriptionKey: 'agents.template.testWriter.description',
    promptKey: 'agents.template.testWriter.prompt',
  },
]

interface AgentTemplatesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectTemplate: (template: AgentTemplate) => void
}

export function AgentTemplatesDialog({ open, onOpenChange, onSelectTemplate }: AgentTemplatesDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(720px,calc(100vh-3rem))] overflow-hidden p-0 sm:max-w-[800px]">
        <DialogHeader className="border-b border-foreground/6 px-5 py-4">
          <DialogTitle className="text-base font-semibold">{t('agents.templatesTitle')}</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto px-5 pb-5 pt-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {AGENT_TEMPLATES.map(template => (
              <button
                key={template.id}
                type="button"
                onClick={() => onSelectTemplate(template)}
                className="group min-h-[118px] rounded-[18px] border border-foreground/8 bg-background/70 p-4 text-left shadow-minimal transition-colors hover:bg-foreground/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <div className="flex h-8 min-w-8 items-center justify-center rounded-[10px] bg-foreground/[0.04] px-2 text-xs font-semibold transition-colors group-hover:bg-foreground/[0.06]" aria-hidden="true">
                  {template.icon}
                </div>
                <div className="mt-3 text-sm font-medium leading-5 text-foreground">{t(template.titleKey)}</div>
                <div className="mt-1.5 text-sm leading-5 text-muted-foreground">{t(template.descriptionKey)}</div>
              </button>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
