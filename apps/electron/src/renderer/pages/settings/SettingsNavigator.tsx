/**
 * SettingsNavigator
 *
 * Calm, grouped settings navigation. Routes/settings pages stay unchanged.
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import type { DetailsPageMeta } from '@/lib/navigation-registry'
import type { SettingsSubpage } from '../../../shared/types'
import { SETTINGS_ITEMS } from '../../../shared/menu-schema'
import { SETTINGS_ICONS } from '@/components/icons/SettingsIcons'

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

const SETTINGS_GROUPS: Array<{ labelKey: string; ids: SettingsSubpage[] }> = [
  { labelKey: 'settings.groups.general', ids: ['app', 'appearance', 'input', 'preferences', 'shortcuts'] },
  { labelKey: 'settings.groups.aiWorkspace', ids: ['ai', 'workspace', 'permissions', 'labels'] },
  { labelKey: 'settings.groups.integrations', ids: ['messaging', 'server'] },
  { labelKey: 'settings.groups.archive', ids: ['archivedSessions'] },
]

function SettingsRow({ item, selected, onSelect }: { item: SettingsItem; selected: boolean; onSelect: () => void }) {
  const Icon = item.icon
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'flex h-8 w-full items-center gap-2 rounded-[9px] px-2 text-left text-sm outline-none transition-colors',
        selected ? 'bg-foreground/[0.065] text-foreground shadow-[inset_0_0_0_1px_var(--foreground-6)]' : 'text-foreground/78 hover:bg-foreground/[0.04] hover:text-foreground',
      )}
    >
      <Icon className={cn('h-3.5 w-3.5 shrink-0', selected ? 'text-foreground' : 'text-muted-foreground/90')} />
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
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-2 py-2.5">
        <div className="space-y-3.5">
          {SETTINGS_GROUPS.map((group) => {
            const items = group.ids.map((id) => settingsItems.get(id)).filter(Boolean) as SettingsItem[]
            if (items.length === 0) return null
            return (
              <section key={group.labelKey} className="space-y-1">
                <div className="px-2 pb-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-muted-foreground/60">
                  {t(group.labelKey)}
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
