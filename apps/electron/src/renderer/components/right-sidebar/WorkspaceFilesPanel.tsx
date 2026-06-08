import * as React from 'react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronRight, Code2, Copy, ExternalLink, File, FileCode, FileText, Folder, FolderOpen, Image, MoreHorizontal, PanelRightClose, PanelRightOpen, Search, Terminal } from 'lucide-react'
import { Markdown } from '@craft-agent/ui'
import { toast } from 'sonner'
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuSub, StyledDropdownMenuContent, StyledDropdownMenuItem, StyledDropdownMenuSeparator, StyledDropdownMenuSubTrigger, StyledDropdownMenuSubContent } from '@/components/ui/styled-dropdown'
import { TopBarButton } from '@/components/ui/TopBarButton'
import { cn } from '@/lib/utils'
import { useAppShellContext } from '@/context/AppShellContext'
import type { FileEntryListingResult } from '../../../shared/types'

type FileEntry = FileEntryListingResult['entries'][number]
type EntryNode = FileEntry & { children?: EntryNode[]; loaded?: boolean; loading?: boolean; error?: string | null }
type PreviewKind = 'empty' | 'text' | 'markdown' | 'image' | 'binary' | 'error'

const TEXT_EXTENSIONS = new Set(['txt', 'log', 'json', 'jsonl', 'js', 'jsx', 'ts', 'tsx', 'css', 'scss', 'html', 'xml', 'yml', 'yaml', 'toml', 'ini', 'env', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'sh', 'bash', 'ps1', 'sql', 'md', 'markdown'])
const IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'ico', 'svg'])
const SKIP_FILTER_NAMES = new Set(['node_modules', '.git'])

function extensionOf(path: string) {
  return path.split('.').pop()?.toLowerCase() ?? ''
}

function nameOf(path: string) {
  return path.split(/[\\/]/).filter(Boolean).pop() ?? path
}


function relativePath(rootPath: string, path: string) {
  const normalizedRoot = rootPath.replace(/\\/g, '/')
  const normalizedPath = path.replace(/\\/g, '/')
  if (normalizedPath === normalizedRoot) return ''
  if (normalizedPath.startsWith(`${normalizedRoot}/`)) return normalizedPath.slice(normalizedRoot.length + 1)
  return nameOf(path)
}

function getEntryIcon(entry: Pick<FileEntry, 'name' | 'type'>, expanded?: boolean) {
  const className = 'h-3.5 w-3.5 text-muted-foreground'
  if (entry.type === 'directory') return expanded ? <FolderOpen className={className} /> : <Folder className={className} />
  const ext = extensionOf(entry.name)
  if (ext === 'md' || ext === 'markdown') return <FileText className={className} />
  if (IMAGE_EXTENSIONS.has(ext)) return <Image className={className} />
  if (TEXT_EXTENSIONS.has(ext)) return <FileCode className={className} />
  return <File className={className} />
}

function updateNode(nodes: EntryNode[], path: string, updater: (node: EntryNode) => EntryNode): EntryNode[] {
  return nodes.map((node) => {
    if (node.path === path) return updater(node)
    if (node.children) return { ...node, children: updateNode(node.children, path, updater) }
    return node
  })
}

function filterTree(nodes: EntryNode[], query: string): EntryNode[] {
  const lower = query.trim().toLowerCase()
  if (!lower) return nodes
  const visit = (items: EntryNode[]): EntryNode[] => items.flatMap((node) => {
    const childMatches = node.children ? visit(node.children) : []
    const matches = node.name.toLowerCase().includes(lower) || node.path.toLowerCase().includes(lower)
    if (matches || childMatches.length > 0) return [{ ...node, children: childMatches.length > 0 ? childMatches : node.children }]
    return []
  })
  return visit(nodes)
}

function flattenVisibleDirectoryPaths(nodes: EntryNode[], query: string): string[] {
  if (!query.trim()) return []
  const paths: string[] = []
  const visit = (items: EntryNode[]) => {
    for (const node of items) {
      if (node.type === 'directory') paths.push(node.path)
      if (node.children) visit(node.children)
    }
  }
  visit(nodes)
  return paths
}

interface WorkspaceFilesPanelProps {
  className?: string
  onTitleChange?: (title: string) => void
}

export function WorkspaceFilesPanel({ className, onTitleChange }: WorkspaceFilesPanelProps) {
  const { workspaces, activeWorkspaceId } = useAppShellContext()
  const workspace = workspaces.find((item) => item.id === activeWorkspaceId) ?? null
  const rootPath = workspace?.rootPath
  const workspaceName = workspace?.name ?? 'Workspace'
  const [nodes, setNodes] = useState<EntryNode[]>([])
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set())
  const [selectedFile, setSelectedFile] = useState<FileEntry | null>(null)
  const [query, setQuery] = useState('')
  const [treeOpen, setTreeOpen] = useState(true)
  const [richPreview, setRichPreview] = useState(true)
  const [content, setContent] = useState('')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [previewKind, setPreviewKind] = useState<PreviewKind>('empty')
  const [loadingRoot, setLoadingRoot] = useState(false)
  const [loadingPreview, setLoadingPreview] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadDirectory = useCallback(async (dirPath: string) => {
    const listing = await window.electronAPI.listFileEntries(dirPath)
    return listing.entries.filter((entry) => !SKIP_FILTER_NAMES.has(entry.name))
  }, [])

  useEffect(() => {
    onTitleChange?.(selectedFile ? selectedFile.name : 'Files')
  }, [onTitleChange, selectedFile])

  useEffect(() => {
    setSelectedFile(null)
    setContent('')
    setImageUrl(null)
    setPreviewKind('empty')
    setExpandedPaths(new Set())
    setNodes([])
    setError(null)
    if (!rootPath) return

    let cancelled = false
    setLoadingRoot(true)
    loadDirectory(rootPath).then((entries) => {
      if (cancelled) return
      setNodes(entries.map((entry) => ({ ...entry, loaded: entry.type === 'file' })))
    }).catch((err) => {
      if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load workspace files')
    }).finally(() => {
      if (!cancelled) setLoadingRoot(false)
    })
    return () => { cancelled = true }
  }, [loadDirectory, rootPath])

  useEffect(() => {
    if (!selectedFile) {
      setPreviewKind('empty')
      setContent('')
      setImageUrl(null)
      return
    }

    const ext = extensionOf(selectedFile.name)
    let cancelled = false
    setLoadingPreview(true)
    setError(null)
    setContent('')
    setImageUrl(null)

    if (IMAGE_EXTENSIONS.has(ext)) {
      window.electronAPI.readFileDataUrl(selectedFile.path).then((url) => {
        if (!cancelled) {
          setImageUrl(url)
          setPreviewKind('image')
        }
      }).catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load image')
          setPreviewKind('error')
        }
      }).finally(() => { if (!cancelled) setLoadingPreview(false) })
      return () => { cancelled = true }
    }

    if (!TEXT_EXTENSIONS.has(ext)) {
      setPreviewKind('binary')
      setLoadingPreview(false)
      return () => { cancelled = true }
    }

    window.electronAPI.readFile(selectedFile.path).then((text) => {
      if (!cancelled) {
        setContent(text)
        setPreviewKind(ext === 'md' || ext === 'markdown' ? 'markdown' : 'text')
      }
    }).catch((err) => {
      if (!cancelled) {
        setError(err instanceof Error ? err.message : 'Failed to load file')
        setPreviewKind('error')
      }
    }).finally(() => { if (!cancelled) setLoadingPreview(false) })

    return () => { cancelled = true }
  }, [selectedFile])

  const toggleDirectory = useCallback(async (entry: EntryNode) => {
    setExpandedPaths((prev) => {
      const next = new Set(prev)
      if (next.has(entry.path)) next.delete(entry.path)
      else next.add(entry.path)
      return next
    })
    if (entry.loaded || entry.loading) return
    setNodes((prev) => updateNode(prev, entry.path, (node) => ({ ...node, loading: true, error: null })))
    try {
      const entries = await loadDirectory(entry.path)
      setNodes((prev) => updateNode(prev, entry.path, (node) => ({ ...node, children: entries.map((child) => ({ ...child, loaded: child.type === 'file' })), loaded: true, loading: false })))
    } catch (err) {
      setNodes((prev) => updateNode(prev, entry.path, (node) => ({ ...node, loading: false, error: err instanceof Error ? err.message : 'Failed to load directory' })))
    }
  }, [loadDirectory])

  const visibleNodes = useMemo(() => filterTree(nodes, query), [nodes, query])
  const queryExpandedPaths = useMemo(() => new Set(flattenVisibleDirectoryPaths(visibleNodes, query)), [visibleNodes, query])
  const selectedRelativePath = selectedFile && rootPath ? relativePath(rootPath, selectedFile.path) : ''
  const breadcrumbs = selectedRelativePath ? selectedRelativePath.split('/').filter(Boolean) : []

  const copyPath = useCallback(async () => {
    if (!selectedFile) return
    await navigator.clipboard.writeText(selectedFile.path)
    toast.success('Path copied')
  }, [selectedFile])

  const copyContents = useCallback(async () => {
    if (!selectedFile || previewKind === 'binary' || previewKind === 'image') return
    const text = content || await window.electronAPI.readFile(selectedFile.path)
    await navigator.clipboard.writeText(text)
    toast.success('File contents copied')
  }, [content, previewKind, selectedFile])

  const openDefault = useCallback(() => {
    if (selectedFile) void window.electronAPI.openFile(selectedFile.path)
  }, [selectedFile])

  const revealSelected = useCallback(() => {
    const target = selectedFile?.path ?? rootPath
    if (target) void window.electronAPI.showInFolder(target)
  }, [rootPath, selectedFile])

  const renderTree = (items: EntryNode[], depth = 0) => (
    <div className={depth === 0 ? 'space-y-0.5' : 'space-y-0.5 pl-3'}>
      {items.map((entry) => {
        const expanded = expandedPaths.has(entry.path) || queryExpandedPaths.has(entry.path)
        const selected = selectedFile?.path === entry.path
        return (
          <div key={entry.path}>
            <button
              type="button"
              onClick={() => entry.type === 'directory' ? void toggleDirectory(entry) : setSelectedFile(entry)}
              className={cn('group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-foreground/5', selected && 'bg-foreground/8 text-foreground')}
              title={entry.path}
            >
              <ChevronRight className={cn('h-3.5 w-3.5 text-muted-foreground transition-transform', entry.type === 'directory' ? 'opacity-100' : 'opacity-0', expanded && 'rotate-90')} />
              <span className="relative grid h-4 w-4 place-items-center">{getEntryIcon(entry, expanded)}</span>
              <span className="min-w-0 flex-1 truncate">{entry.name}</span>
            </button>
            {entry.type === 'directory' && expanded && (
              <div className="mt-0.5">
                {entry.loading ? <div className="px-8 py-1 text-[11px] text-muted-foreground">Loading...</div> : null}
                {entry.error ? <div className="px-8 py-1 text-[11px] text-destructive">{entry.error}</div> : null}
                {entry.children ? renderTree(entry.children, depth + 1) : null}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )

  if (!rootPath) {
    return <div className={cn('flex h-full items-center justify-center p-6 text-center text-muted-foreground', className)}>Select a workspace to view files</div>
  }

  return (
    <div className={cn('flex h-full min-h-0 flex-col bg-background', className)}>
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-foreground/10 px-3">
        <div className="min-w-0 flex-1 truncate text-xs text-muted-foreground">
          <span>{workspaceName}</span>
          {breadcrumbs.map((crumb, index) => <React.Fragment key={`${crumb}-${index}`}> <span className="mx-1">/</span> <span className={index === breadcrumbs.length - 1 ? 'font-medium text-foreground' : ''}>{crumb}</span></React.Fragment>)}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <TopBarButton aria-label="File actions" className="h-7 w-7 rounded-lg" disabled={!selectedFile}>
              <MoreHorizontal className="h-4 w-4 text-foreground/60" />
            </TopBarButton>
          </DropdownMenuTrigger>
          <StyledDropdownMenuContent align="end" minWidth="min-w-56">
            <StyledDropdownMenuItem onClick={copyPath}><Copy className="h-3.5 w-3.5" />Copy path</StyledDropdownMenuItem>
            <StyledDropdownMenuItem disabled={!selectedFile || previewKind === 'binary' || previewKind === 'image'} onClick={copyContents}><Copy className="h-3.5 w-3.5" />Copy file contents</StyledDropdownMenuItem>
            <StyledDropdownMenuSeparator />
            <StyledDropdownMenuItem disabled={previewKind !== 'markdown'} onClick={() => setRichPreview((value) => !value)}><Code2 className="h-3.5 w-3.5" />{richPreview ? 'Disable rich preview' : 'Enable rich preview'}</StyledDropdownMenuItem>
          </StyledDropdownMenuContent>
        </DropdownMenu>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <TopBarButton aria-label="Open workspace" className="h-7 rounded-lg px-2">
              <ExternalLink className="h-4 w-4 text-foreground/60" />
              <span className="text-xs">Open</span>
            </TopBarButton>
          </DropdownMenuTrigger>
          <StyledDropdownMenuContent align="end" minWidth="min-w-52">
            <StyledDropdownMenuItem disabled={!selectedFile} onClick={openDefault}><ExternalLink className="h-3.5 w-3.5" />Default app</StyledDropdownMenuItem>
            <StyledDropdownMenuItem disabled><Code2 className="h-3.5 w-3.5" />VS Code</StyledDropdownMenuItem>
            <DropdownMenuSub>
              <StyledDropdownMenuSubTrigger><Terminal className="h-3.5 w-3.5" />This location</StyledDropdownMenuSubTrigger>
              <StyledDropdownMenuSubContent>
                <StyledDropdownMenuItem disabled><Terminal className="h-3.5 w-3.5" />Terminal</StyledDropdownMenuItem>
                <StyledDropdownMenuItem disabled><Terminal className="h-3.5 w-3.5" />Git Bash</StyledDropdownMenuItem>
              </StyledDropdownMenuSubContent>
            </DropdownMenuSub>
            <StyledDropdownMenuItem onClick={revealSelected}><FolderOpen className="h-3.5 w-3.5" />Open workspace folder</StyledDropdownMenuItem>
          </StyledDropdownMenuContent>
        </DropdownMenu>
        <TopBarButton aria-label="Reveal in file manager" onClick={revealSelected} className="h-7 w-7 rounded-lg">
          <FolderOpen className="h-4 w-4 text-foreground/60" />
        </TopBarButton>
        <TopBarButton aria-label="Toggle file tree" onClick={() => setTreeOpen((value) => !value)} isActive={treeOpen} className="h-7 w-7 rounded-lg">
          {treeOpen ? <PanelRightClose className="h-4 w-4 text-foreground/60" /> : <PanelRightOpen className="h-4 w-4 text-foreground/60" />}
        </TopBarButton>
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-auto p-4">
          {loadingPreview ? <div className="flex h-full items-center justify-center text-sm text-muted-foreground">Loading...</div> : null}
          {!loadingPreview && previewKind === 'empty' ? <div className="flex h-full items-center justify-center text-center text-muted-foreground"><div><FolderOpen className="mx-auto mb-2 h-8 w-8" /><div className="text-sm font-medium text-foreground">Open file</div><div className="text-xs">Select a file from the workspace tree.</div></div></div> : null}
          {!loadingPreview && previewKind === 'error' ? <div className="text-sm text-destructive">{error}</div> : null}
          {!loadingPreview && previewKind === 'binary' ? <div className="flex h-full items-center justify-center text-center text-muted-foreground"><div><File className="mx-auto mb-2 h-8 w-8" /><div className="text-sm font-medium text-foreground">Preview unavailable</div><button className="mt-3 rounded-md bg-foreground/10 px-3 py-1.5 text-xs text-foreground" onClick={openDefault}>Open in default app</button></div></div> : null}
          {!loadingPreview && previewKind === 'image' && imageUrl ? <img src={imageUrl} alt={selectedFile?.name ?? ''} className="mx-auto max-h-full max-w-full rounded-lg object-contain" /> : null}
          {!loadingPreview && previewKind === 'markdown' ? (richPreview ? <div className="prose prose-sm max-w-none dark:prose-invert"><Markdown>{content}</Markdown></div> : <pre className="whitespace-pre-wrap font-mono text-xs leading-5">{content}</pre>) : null}
          {!loadingPreview && previewKind === 'text' ? <pre className="whitespace-pre-wrap font-mono text-xs leading-5">{content}</pre> : null}
        </div>
        {treeOpen && (
          <aside className="flex w-[280px] shrink-0 flex-col border-l border-foreground/10 bg-background/80">
            <div className="border-b border-foreground/5 p-2">
              <div className="flex items-center gap-2 rounded-lg bg-foreground/5 px-2 py-1.5">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Filter files..." className="min-w-0 flex-1 bg-transparent text-xs outline-none placeholder:text-muted-foreground" />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-auto p-2">
              {loadingRoot ? <div className="p-3 text-xs text-muted-foreground">Loading files...</div> : null}
              {error && !selectedFile ? <div className="p-3 text-xs text-destructive">{error}</div> : null}
              {!loadingRoot ? renderTree(visibleNodes) : null}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
