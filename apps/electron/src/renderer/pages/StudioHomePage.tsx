import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { ExternalLink, FileArchive, Search, Sparkles } from 'lucide-react'
import { PanelHeader } from '@/components/app-shell/PanelHeader'
import { AIAssistedButton } from '@/components/app-shell/AIAssistedButton'
import { HeaderMenu } from '@/components/ui/HeaderMenu'
import { Button } from '@/components/ui/button'
import { EditPopover, getEditConfig } from '@/components/ui/EditPopover'
import { Input } from '@/components/ui/input'
import { routes } from '@/lib/navigate'
import { cn } from '@/lib/utils'
import type { Session } from '../../shared/types'

type StudioOutputMetadata = {
  schema: 'craft-studio-output/v1'
  id: string
  title: string
  type: string
  entryFile: string
  skill?: string
  status: string
  sourcePrompt?: string
  createdAt: string
  updatedAt: string
  exports?: Array<{ format: string; path: string; createdAt: string }>
  sessionId: string
}

type StudioOutput = {
  metadata: StudioOutputMetadata
  outputDir: string
  entryPath: string
  session?: Session
}

function titleFromFileName(name: string): string {
  return name.replace(/\.html?$/i, '').replace(/[-_]+/g, ' ').replace(/\b\w/g, char => char.toUpperCase())
}

async function readStudioOutputs(): Promise<StudioOutput[]> {
  const sessions = await window.electronAPI.getSessions()
  const outputs: StudioOutput[] = []
  const seenEntryPaths = new Set<string>()
  for (const session of sessions) {
    if (!session.sessionFolderPath) continue
    const studioRoot = `${session.sessionFolderPath}/data/studio`
    try {
      const root = await window.electronAPI.listFileEntries(studioRoot)
      for (const entry of root.entries) {
        if (entry.type !== 'directory') continue
        try {
          const metadataPath = `${entry.path}/metadata.json`
          const metadata = JSON.parse(await window.electronAPI.readFile(metadataPath)) as StudioOutputMetadata
          if (metadata.schema !== 'craft-studio-output/v1') continue
          const entryPath = `${entry.path}/${metadata.entryFile || 'index.html'}`
          seenEntryPaths.add(entryPath)
          outputs.push({ metadata, outputDir: entry.path, entryPath, session })
        } catch {
          continue
        }
      }
    } catch {
      // A session may have loose HTML previews without Studio metadata.
    }

    try {
      const dataRoot = `${session.sessionFolderPath}/data`
      const dataEntries = await window.electronAPI.listFileEntries(dataRoot)
      for (const entry of dataEntries.entries) {
        if (entry.type !== 'file' || !/\.html?$/i.test(entry.name) || seenEntryPaths.has(entry.path)) continue
        const fileSlug = entry.name.replace(/\.html?$/i, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'html'
        const id = `${session.id}-${fileSlug}`
        const timestamp = new Date(session.lastMessageAt || session.createdAt || Date.now()).toISOString()
        outputs.push({
          metadata: {
            schema: 'craft-studio-output/v1',
            id,
            title: titleFromFileName(entry.name),
            type: entry.name.toLowerCase().includes('landing') ? 'landing-page' : 'prototype',
            entryFile: entry.name,
            status: 'ready',
            sourcePrompt: 'Session HTML preview output',
            createdAt: timestamp,
            updatedAt: timestamp,
            exports: [],
            sessionId: session.id,
          },
          outputDir: dataRoot,
          entryPath: entry.path,
          session,
        })
      }
    } catch {
      continue
    }
  }
  return outputs.sort((a, b) => b.metadata.updatedAt.localeCompare(a.metadata.updatedAt))
}

function typeLabel(type: string): string {
  return type.replace(/-/g, ' ')
}

export default function StudioHomePage() {
  const { t } = useTranslation()
  const [outputs, setOutputs] = React.useState<StudioOutput[]>([])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [query, setQuery] = React.useState('')
  const [previewHtml, setPreviewHtml] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  const refresh = React.useCallback(async () => {
    setLoading(true)
    try {
      const next = await readStudioOutputs()
      setOutputs(next)
      setSelectedId(current => current && next.some(output => output.metadata.id === current) ? current : next[0]?.metadata.id ?? null)
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => { void refresh() }, [refresh])

  const filtered = React.useMemo(() => {
    const text = query.trim().toLowerCase()
    if (!text) return outputs
    return outputs.filter(output => [output.metadata.title, output.metadata.type, output.metadata.skill, output.session?.name, output.metadata.sourcePrompt].filter(Boolean).join(' ').toLowerCase().includes(text))
  }, [outputs, query])

  const selected = React.useMemo(() => filtered.find(output => output.metadata.id === selectedId) ?? filtered[0], [filtered, selectedId])

  React.useEffect(() => {
    let cancelled = false
    async function loadPreview() {
      if (!selected) {
        setPreviewHtml(null)
        return
      }
      try {
        const html = await window.electronAPI.readFile(selected.entryPath)
        if (!cancelled) setPreviewHtml(html)
      } catch {
        if (!cancelled) setPreviewHtml(null)
      }
    }
    void loadPreview()
    return () => { cancelled = true }
  }, [selected])

  const studioLocation = selected ? `${selected.outputDir}::${selected.metadata.id}` : 'studio'

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <PanelHeader title={t('studio.title')} actions={<HeaderMenu route={routes.view.studio()} />} />
      <div className="min-h-0 flex-1 overflow-auto px-6 pb-10 pt-5">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-5">
          <section className="rounded-2xl border border-border/70 bg-card/70 p-5 shadow-sm">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-1">
                <div className="text-xl font-semibold tracking-tight text-foreground">{t('studio.heroTitle')}</div>
                <p className="max-w-2xl text-sm text-muted-foreground">{t('studio.heroDescription')}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <EditPopover trigger={<AIAssistedButton label={t('studio.create')} />} onInlineComplete={refresh} {...getEditConfig('studio-create', 'studio')} />
                <EditPopover trigger={<AIAssistedButton label={t('studio.refine')} />} onInlineComplete={refresh} {...getEditConfig('studio-refine', studioLocation)} />
                <EditPopover trigger={<AIAssistedButton label={t('studio.export')} />} onInlineComplete={refresh} {...getEditConfig('studio-export', studioLocation)} />
              </div>
            </div>
          </section>

          <div className="grid min-h-[520px] gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
            <section className="rounded-2xl border border-border/70 bg-card/60 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <div>
                  <div className="text-sm font-medium text-foreground">{t('studio.outputsTitle')}</div>
                  <div className="text-xs text-muted-foreground">{t('studio.outputsCount', { count: outputs.length })}</div>
                </div>
              </div>
              <div className="relative mb-3">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input value={query} onChange={event => setQuery(event.target.value)} placeholder={t('studio.searchPlaceholder')} className="h-9 pl-8 text-sm" />
              </div>
              <div className="space-y-2">
                {loading ? <div className="rounded-xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">{t('studio.loading')}</div> : null}
                {!loading && filtered.length === 0 ? <div className="rounded-xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">{t('studio.empty')}</div> : null}
                {filtered.map(output => (
                  <button key={output.metadata.id} type="button" onClick={() => setSelectedId(output.metadata.id)} className={cn('w-full rounded-xl border p-3 text-left transition-colors hover:bg-foreground/[0.03]', selected?.metadata.id === output.metadata.id ? 'border-foreground/20 bg-foreground/[0.04]' : 'border-border/60 bg-background/60')}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-foreground">{output.metadata.title}</div>
                        <div className="mt-1 text-xs capitalize text-muted-foreground">{typeLabel(output.metadata.type)} · {output.metadata.status}</div>
                      </div>
                      <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </div>
                    <div className="mt-2 truncate text-xs text-muted-foreground">{output.session?.name || output.metadata.sessionId}</div>
                  </button>
                ))}
              </div>
            </section>

            <section className="min-h-0 rounded-2xl border border-border/70 bg-card/60 p-4">
              {selected ? (
                <div className="flex h-full min-h-0 flex-col gap-4">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-lg font-semibold text-foreground">{selected.metadata.title}</div>
                      <div className="mt-1 text-xs capitalize text-muted-foreground">{typeLabel(selected.metadata.type)} · {selected.metadata.status} · {selected.metadata.id}</div>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                      <Button size="sm" variant="outline" onClick={() => window.electronAPI.showInFolder(selected.entryPath)}><ExternalLink className="h-3.5 w-3.5" />{t('studio.open')}</Button>
                      {selected.metadata.exports?.at(-1)?.path ? <Button size="sm" variant="outline" onClick={() => window.electronAPI.showInFolder(selected.metadata.exports!.at(-1)!.path)}><FileArchive className="h-3.5 w-3.5" />{t('studio.lastExport')}</Button> : null}
                    </div>
                  </div>

                  <div className="grid gap-3 text-xs text-muted-foreground sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-border/60 bg-background/60 p-3"><div className="mb-1 text-foreground/60">{t('studio.skill')}</div>{selected.metadata.skill || '—'}</div>
                    <div className="rounded-xl border border-border/60 bg-background/60 p-3"><div className="mb-1 text-foreground/60">{t('studio.session')}</div>{selected.session?.name || selected.metadata.sessionId}</div>
                    <div className="rounded-xl border border-border/60 bg-background/60 p-3"><div className="mb-1 text-foreground/60">{t('studio.updated')}</div>{new Date(selected.metadata.updatedAt).toLocaleString()}</div>
                    <div className="rounded-xl border border-border/60 bg-background/60 p-3"><div className="mb-1 text-foreground/60">{t('studio.exports')}</div>{selected.metadata.exports?.length ?? 0}</div>
                  </div>

                  <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-border/70 bg-background">
                    {previewHtml ? <iframe title={selected.metadata.title} srcDoc={previewHtml} sandbox="allow-scripts" className="h-full min-h-[360px] w-full bg-white" /> : <div className="grid h-full min-h-[360px] place-items-center text-sm text-muted-foreground">{t('studio.previewUnavailable')}</div>}
                  </div>
                </div>
              ) : <div className="grid h-full min-h-[420px] place-items-center text-sm text-muted-foreground">{t('studio.empty')}</div>}
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}
