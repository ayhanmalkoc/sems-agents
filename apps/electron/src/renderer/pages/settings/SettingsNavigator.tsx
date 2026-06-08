/**
 * SettingsNavigator
 *
 * Calm, grouped settings navigation. Routes/settings pages stay unchanged.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { DetailsPageMeta } from '@/lib/navigation-registry'
import type { SettingsSubpage } from '../../../shared/types'
import { SETTINGS_ITEMS } from '../../../shared/menu-schema'
import { SETTINGS_ICONS } from '@/components/icons/SettingsIcons'
import { navigate, routes } from '@/lib/navigate'

export const meta: DetailsPageMeta = {
  navigator: 'settings',
  slug: 'navigator',
}

interface SettingsNavigatorProps {
  selectedSubpage: SettingsSubpage | null
  onSelectSubpage: (subpage: SettingsSubpage) => void
}

interface SettingsItem {
  id: SettingsSubpage
  label: string
  icon: React.ComponentType<{ className?: string }>
}

const SETTINGS_GROUPS: Array<{ label: string; ids: SettingsSubpage[] }> = [
  { label: 'General', ids: ['app', 'appearance', 'input', 'preferences', 'shortcuts'] },
  { label: 'AI & Workspace', ids: ['ai', 'workspace', 'permissions', 'labels'] },
  { label: 'Integrations', ids: ['messaging', 'server'] },
  { label: 'Archive', ids: ['archivedSessions'] },
]

function SettingsRow({ item, selected, onSelect }: { item: SettingsItem; selected: boolean; onSelect: () => void }) {
  const Icon = item.icon
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex h-8 w-full items-center gap-2 rounded-[8px] px-2 text-left text-sm outline-none transition-colors',
        selected ? 'bg-foreground/7 text-foreground' : 'text-foreground/80 hover:bg-foreground/4 hover:text-foreground',
      )}
    >
      <Icon className={cn('h-3.5 w-3.5 shrink-0', selected ? 'text-foreground' : 'text-muted-foreground')} />
      <span className="min-w-0 flex-1 truncate">{item.label}</span>
    </button>
  )
}

export default function SettingsNavigator({ selectedSubpage, onSelectSubpage }: SettingsNavigatorProps) {
  const { t } = useTranslation()

  const settingsItems = useMemo(() => {
    const items = new Map<SettingsSubpage, SettingsItem>()
    for (const item of SETTINGS_ITEMS) {
      items.set(item.id, {
        id: item.id,
        label: t(item.labelKey),
        icon: SETTINGS_ICONS[item.id],
      })
    }
    return items
  }, [t])

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="shrink-0 px-2 pb-2 pt-2">
        <button
          type="button"
          onClick={() => navigate(routes.view.allSessions())}
          className="flex h-8 w-full items-center gap-2 rounded-[8px] px-2 text-sm text-muted-foreground transition-colors hover:bg-foreground/4 hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="truncate">{t('settings.backToApp')}</span>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3">
        <div className="space-y-5">
          {SETTINGS_GROUPS.map((group) => {
            const items = group.ids.map((id) => settingsItems.get(id)).filter(Boolean) as SettingsItem[]
            if (items.length === 0) return null
            return (
              <section key={group.label} className="space-y-1">
                <div className="px-2 pb-1 text-[11px] font-medium uppercase tracking-[0.08em] text-muted-foreground/70">
                  {group.label}
                </div>
                <div className="space-y-0.5">
                  {items.map((item) => (
                    <SettingsRow
                      key={item.id}
                      item={item}
                      selected={selectedSubpage === item.id}
                      onSelect={() => onSelectSubpage(item.id)}
                    />
                  ))}
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>
  )
}
