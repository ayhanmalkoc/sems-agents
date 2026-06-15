/**
 * AutomationInfoPage
 *
 * Detail view for a selected automation, using the Info_Page compound component system.
 * Follows SourceInfoPage pattern: Hero → Sections (When, Then, Settings, History, JSON).
 */

import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { LayoutTemplate, PauseCircle, AlertCircle, Hash } from 'lucide-react'
import {
  Info_Page,
  Info_Section,
  Info_Table,
  Info_Alert,
  Info_Badge,
  Info_Markdown,
} from '@/components/info'
import { EditPopover, EditButton, getEditConfig } from '@/components/ui/EditPopover'
import { AIAssistedButton } from '@/components/app-shell/AIAssistedButton'
import { ResourceBreadcrumbTitle } from '@/components/ui/ResourceBreadcrumbTitle'
import { navigate, routes } from '@/lib/navigate'
import { useActiveWorkspace } from '@/context/AppShellContext'
import { AutomationAvatar } from './AutomationAvatar'
import { AutomationMenu } from './AutomationMenu'
import { AutomationActionRow } from './AutomationActionRow'
import { AutomationTestPanel } from './AutomationTestPanel'
import { AutomationEventTimeline } from './AutomationEventTimeline'
import { AutomationTemplatesDialog, type AutomationTemplate } from './AutomationTemplatesDialog'
import { PhaseBadge } from './PhaseBadge'
import { getEventDisplayName, getPermissionDisplayName, flattenConditions, type AutomationListItem, type ExecutionEntry, type TestResult } from './types'
import { describeCron, computeNextRuns } from './utils'

// ============================================================================
// Component
// ============================================================================

export interface AutomationInfoPageProps {
  automation: AutomationListItem
  executions?: ExecutionEntry[]
  testResult?: TestResult
  onToggleEnabled?: () => void
  onTest?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
  onReplay?: (automationId: string, event: string) => void
  className?: string
}

function getAutomationDetailEditConfig(workspaceRoot: string, automation: AutomationListItem) {
  const config = getEditConfig('automation-config', workspaceRoot)
  return {
    ...config,
    context: {
      ...config.context,
      context:
        `${config.context.context} ` +
        `The user is currently viewing the automation named "${automation.name}" with id "${automation.id}" and event "${automation.event}". ` +
        'When the user refers to this automation, the current automation, or asks to edit without naming another automation, target this automation entry.',
    },
  }
}

export function AutomationInfoPage({
  automation,
  executions = [],
  testResult,
  onToggleEnabled,
  onTest,
  onDuplicate,
  onDelete,
  onReplay,
  className,
}: AutomationInfoPageProps) {
  const { t } = useTranslation()
  const workspace = useActiveWorkspace()
  const nextRuns = automation.cron ? computeNextRuns(automation.cron) : []
  const automationEditConfig = React.useMemo(
    () => workspace?.rootPath ? getAutomationDetailEditConfig(workspace.rootPath, automation) : null,
    [automation, workspace?.rootPath],
  )
  const [templateDialogOpen, setTemplateDialogOpen] = React.useState(false)
  const [createPopoverOpen, setCreatePopoverOpen] = React.useState(false)
  const [createPrompt, setCreatePrompt] = React.useState('')

  const openCreatePopover = React.useCallback((prompt = '') => {
    setCreatePrompt(prompt)
    setCreatePopoverOpen(true)
  }, [])

  const handleTemplateSelect = React.useCallback((template: AutomationTemplate) => {
    setTemplateDialogOpen(false)
    openCreatePopover(t(template.promptKey))
  }, [openCreatePopover, t])

  // Lightweight per-mount fetch — mirrors the pattern used in MessagingSettingsPage.
  // Only fired when the matcher actually declares a topic to avoid unnecessary IPC.
  const [hasSupergroup, setHasSupergroup] = React.useState<boolean | null>(null)
  React.useEffect(() => {
    if (!automation.telegramTopic) {
      setHasSupergroup(null)
      return
    }
    let cancelled = false
    void window.electronAPI.getMessagingSupergroup().then((sg) => {
      if (!cancelled) setHasSupergroup(Boolean(sg?.chatId))
    }).catch(() => {
      if (!cancelled) setHasSupergroup(false)
    })
    return () => {
      cancelled = true
    }
  }, [automation.telegramTopic])

  const editActions = workspace?.rootPath ? (
    <EditPopover
      trigger={<EditButton />}
      {...(automationEditConfig ?? getEditConfig('automation-config', workspace.rootPath))}
      secondaryAction={{ label: t('automations.editFile'), filePath: `${workspace.rootPath}/automations.json` }}
    />
  ) : undefined

  return (
    <Info_Page className={className}>
      <Info_Page.Header
        title={automation.name}
        titleNode={<ResourceBreadcrumbTitle rootLabel={t('sidebar.automations')} currentLabel={automation.name} onRootClick={() => navigate(routes.view.automations())} />}
        actions={workspace ? (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setTemplateDialogOpen(true)}
              className="header-icon-btn titlebar-no-drag inline-flex h-8 shrink-0 items-center justify-center gap-2 rounded-[8px] border border-foreground/6 bg-background px-3 text-xs font-medium leading-none text-foreground transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <LayoutTemplate className="h-3.5 w-3.5 text-muted-foreground" />
              <span>{t('automations.templates')}</span>
            </button>
            <EditPopover
              open={createPopoverOpen}
              onOpenChange={setCreatePopoverOpen}
              defaultValue={createPrompt}
              trigger={<AIAssistedButton label={t('common.create')} data-tutorial="add-automation-button" onClick={() => setCreatePrompt('')} />}
              {...(automationEditConfig ?? getEditConfig('automation-config', workspace.rootPath))}
            />
          </div>
        ) : undefined}
        titleMenu={
          <AutomationMenu
            automationId={automation.id}
            automationName={automation.name}
            enabled={automation.enabled}
            onToggleEnabled={onToggleEnabled}
            onTest={onTest}
            onDuplicate={onDuplicate}
            onDelete={onDelete}
          />
        }
      />

      <Info_Page.Content>
        {/* Hero */}
        <div className="flex items-start justify-between">
          <Info_Page.Hero
            avatar={<AutomationAvatar event={automation.event} fluid />}
            title={automation.name}
            tagline={automation.summary}
          />
          {editActions}
        </div>

        {/* Disabled warning */}
        {!automation.enabled && (
          <Info_Alert variant="warning" icon={<PauseCircle className="h-4 w-4" />}>
            <Info_Alert.Title>{t('automations.pausedTitle')}</Info_Alert.Title>
            <Info_Alert.Description>
              {t('automations.pausedDescription')}
            </Info_Alert.Description>
          </Info_Alert>
        )}

        {/* Section: When */}
        <Info_Section
          title={t('automations.sectionWhen')}
          description={t('automations.sectionWhenDescription')}
          actions={editActions}
        >
          <Info_Table>
            <Info_Table.Row label={t('automations.labelEvent')}>
              <Info_Badge color="default">{getEventDisplayName(automation.event)}</Info_Badge>
            </Info_Table.Row>
            <Info_Table.Row label={t('automations.labelTiming')}>
              <PhaseBadge event={automation.event} />
            </Info_Table.Row>
            {automation.matcher && (
              <Info_Table.Row label={t('automations.labelOnlyWhenMatching')}>
                <code className="text-xs font-mono bg-foreground/5 px-1.5 py-0.5 rounded">
                  {automation.matcher}
                </code>
              </Info_Table.Row>
            )}
            {automation.cron && (
              <>
                <Info_Table.Row label={t('automations.labelRepeats')} value={describeCron(automation.cron)} />
                <Info_Table.Row label={t('automations.labelScheduleExpression')}>
                  <code className="text-xs font-mono bg-foreground/5 px-1.5 py-0.5 rounded">
                    {automation.cron}
                  </code>
                </Info_Table.Row>
                {nextRuns.length > 0 && (
                  <Info_Table.Row label={t('automations.labelNextRuns')}>
                    <div className="flex flex-col gap-0.5">
                      {(() => {
                        const spansYears = nextRuns.length > 1 && nextRuns[0].getFullYear() !== nextRuns[nextRuns.length - 1].getFullYear()
                        return nextRuns.map((date, i) => (
                          <span key={i} className="text-sm text-foreground/70">
                            {date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', ...(spansYears && { year: 'numeric' }) })}{' '}
                            {date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
                          </span>
                        ))
                      })()}
                    </div>
                  </Info_Table.Row>
                )}
                <Info_Table.Row label={t('automations.labelTimezone')} value={automation.timezone || t('automations.systemDefault')} />
              </>
            )}
          </Info_Table>
        </Info_Section>

        {/* Section: If (conditions) — hidden when empty */}
        {automation.conditions && automation.conditions.length > 0 && (
          <Info_Section
            title={t('automations.sectionIf')}
            description={t('automations.sectionIfDescription')}
            actions={editActions}
          >
            <Info_Table>
              {flattenConditions(automation.conditions).map((row, i) => (
                <Info_Table.Row key={i} label={row.label}>
                  <span className="text-sm text-foreground/70">
                    {row.description}
                  </span>
                </Info_Table.Row>
              ))}
            </Info_Table>
          </Info_Section>
        )}

        {/* Section: Then */}
        <Info_Section
          title={t('automations.sectionThen')}
          description={t('automations.sectionThenDescription', { count: automation.actions.length })}
          actions={editActions}
        >
          <div className="divide-y divide-border/30">
            {automation.actions.map((action, i) => (
              <AutomationActionRow key={i} action={action} index={i} />
            ))}
          </div>
        </Info_Section>

        {/* Test results (if any) */}
        {testResult && testResult.state !== 'idle' && (
          <AutomationTestPanel result={testResult} />
        )}

        {/* Section: Settings */}
        <Info_Section title={t('automations.sectionSettings')} actions={editActions}>
          <Info_Table>
            <Info_Table.Row label={t('automations.labelAccessLevel')} value={getPermissionDisplayName(automation.permissionMode)} />
            <Info_Table.Row label={t('automations.labelStatus')}>
              <Info_Badge color={automation.enabled ? 'success' : 'muted'}>
                {automation.enabled ? t('automations.statusActive') : t('automations.statusDisabled')}
              </Info_Badge>
            </Info_Table.Row>
            {automation.labels && automation.labels.length > 0 && (
              <Info_Table.Row label={t('automations.labelLabels')}>
                <div className="flex gap-1.5 flex-wrap">
                  {automation.labels.map((l) => (
                    <Info_Badge key={l} color="muted">{l}</Info_Badge>
                  ))}
                </div>
              </Info_Table.Row>
            )}
            {automation.telegramTopic && (
              <Info_Table.Row label={t('automations.labelTelegramTopic')}>
                <div className="flex flex-col gap-1">
                  <div className="inline-flex items-center gap-1.5 text-foreground">
                    <Hash className="size-3.5 text-foreground/50" />
                    <span className="font-mono text-xs">{automation.telegramTopic}</span>
                  </div>
                  <span className="text-xs text-foreground/50">
                    {hasSupergroup === false
                      ? t('automations.telegramTopicHintNoSupergroup')
                      : t('automations.telegramTopicHintBound')}
                  </span>
                </div>
              </Info_Table.Row>
            )}
          </Info_Table>
        </Info_Section>

        {/* Section: Recent Activity */}
        <Info_Section
          title={t('automations.sectionRecentActivity')}
          description={executions.length > 0 ? t('automations.lastNRuns', { count: executions.length }) : undefined}
        >
          <AutomationEventTimeline entries={executions} onReplay={onReplay} />
        </Info_Section>

        {/* Section: Raw config (JSON) */}
        <Info_Section title={t('automations.sectionRawConfig')}>
          <div className="rounded-[8px] shadow-minimal overflow-hidden [&_pre]:!bg-transparent [&_.relative]:!bg-transparent [&_.relative]:!border-0 [&_.relative>div:first-child]:!bg-transparent [&_.relative>div:first-child]:!border-0">
            <Info_Markdown maxHeight={300} fullscreen>
              {`\`\`\`json\n${JSON.stringify({
                event: automation.event,
                matcher: automation.matcher,
                conditions: automation.conditions,
                cron: automation.cron,
                timezone: automation.timezone,
                permissionMode: automation.permissionMode,
                labels: automation.labels,
                telegramTopic: automation.telegramTopic,
                enabled: automation.enabled,
                actions: automation.actions,
              }, null, 2)}\n\`\`\``}
            </Info_Markdown>
          </div>
        </Info_Section>
      </Info_Page.Content>

      <AutomationTemplatesDialog
        open={templateDialogOpen}
        onOpenChange={setTemplateDialogOpen}
        onSelectTemplate={handleTemplateSelect}
      />
    </Info_Page>
  )
}
