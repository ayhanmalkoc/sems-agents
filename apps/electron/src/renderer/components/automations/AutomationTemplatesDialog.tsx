import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export interface AutomationTemplate {
  id: string
  icon: string
  titleKey: string
  descriptionKey: string
  promptKey: string
}

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: 'daily-summary',
    icon: '🔔',
    titleKey: 'automations.template.dailySummary.title',
    descriptionKey: 'automations.template.dailySummary.description',
    promptKey: 'automations.template.dailySummary.prompt',
  },
  {
    id: 'weekly-review',
    icon: '📖',
    titleKey: 'automations.template.weeklyReview.title',
    descriptionKey: 'automations.template.weeklyReview.description',
    promptKey: 'automations.template.weeklyReview.prompt',
  },
  {
    id: 'project-watch',
    icon: '🔎',
    titleKey: 'automations.template.projectWatch.title',
    descriptionKey: 'automations.template.projectWatch.description',
    promptKey: 'automations.template.projectWatch.prompt',
  },
  {
    id: 'ci-failure-summary',
    icon: '🟢',
    titleKey: 'automations.template.ciFailureSummary.title',
    descriptionKey: 'automations.template.ciFailureSummary.description',
    promptKey: 'automations.template.ciFailureSummary.prompt',
  },
  {
    id: 'release-notes-draft',
    icon: '📝',
    titleKey: 'automations.template.releaseNotesDraft.title',
    descriptionKey: 'automations.template.releaseNotesDraft.description',
    promptKey: 'automations.template.releaseNotesDraft.prompt',
  },
  {
    id: 'dependency-drift',
    icon: '📦',
    titleKey: 'automations.template.dependencyDrift.title',
    descriptionKey: 'automations.template.dependencyDrift.description',
    promptKey: 'automations.template.dependencyDrift.prompt',
  },
]

interface AutomationTemplatesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelectTemplate: (template: AutomationTemplate) => void
}

export function AutomationTemplatesDialog({ open, onOpenChange, onSelectTemplate }: AutomationTemplatesDialogProps) {
  const { t } = useTranslation()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[min(720px,calc(100vh-3rem))] overflow-hidden p-0 sm:max-w-[800px]">
        <DialogHeader className="border-b border-foreground/6 px-5 py-4">
          <DialogTitle className="text-base font-semibold">{t('automations.templatesTitle')}</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto px-5 pb-5 pt-4">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {AUTOMATION_TEMPLATES.map(template => (
              <button
                key={template.id}
                type="button"
                onClick={() => onSelectTemplate(template)}
                className="group min-h-[118px] rounded-[18px] border border-foreground/8 bg-background/70 p-4 text-left shadow-minimal transition-colors hover:bg-foreground/[0.025] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              >
                <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-foreground/[0.04] text-lg transition-colors group-hover:bg-foreground/[0.06]" aria-hidden="true">
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
