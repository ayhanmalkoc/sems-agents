/**
 * SourceInfoPage
 *
 * Displays source details including connection info, authentication status,
 * documentation (guide.md), and metadata. View-only.
 */

import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { useEffect, useState, useMemo, useCallback } from 'react'
import { AlertCircle, CheckCircle2, KeyRound, Loader2, PlugZap, TestTube2 } from 'lucide-react'
import { EditPopover, EditButton, getEditConfig } from '@/components/ui/EditPopover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { SourceAvatar } from '@/components/ui/source-avatar'
import { SourceMenu } from '@/components/app-shell/SourceMenu'
import { CreateResourceDropdown } from '@/components/app-shell/CreateResourceDropdown'
import { ResourceBreadcrumbTitle } from '@/components/ui/ResourceBreadcrumbTitle'
import { cn } from '@/lib/utils'
import { routes, navigate } from '@/lib/navigate'
import { useNavigation } from '@/contexts/NavigationContext'
import { useAppShellContext } from '@/context/AppShellContext'
import { toast } from 'sonner'
import {
  Info_Page,
  Info_Section,
  Info_Table,
  Info_Alert,
  Info_Markdown,
  PermissionsDataTable,
  ToolsDataTable,
  type PermissionRow,
  type ToolRow,
} from '@/components/info'
import type { LoadedSource, McpToolWithPermission } from '../../shared/types'
import type { PermissionsConfigFile } from '@craft-agent/shared/agent/modes'

interface SourceInfoPageProps {
  sourceSlug: string
  workspaceId: string
  /** Optional callback when source is deleted */
  onDelete?: () => void
}

/**
 * Format timestamp to relative time
 */
function formatRelativeTime(timestamp: number | undefined, t: (key: string, options?: Record<string, unknown>) => string): string {
  if (!timestamp) return t('common.never')

  const now = Date.now()
  const diff = now - timestamp
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return t('common.justNow')
  if (minutes < 60) return t('time.minutesAgo', { count: minutes })
  if (hours < 24) return t('time.hoursAgo', { count: hours })
  return t('time.daysAgo', { count: days })
}

/**
 * Get source URL for display
 */
function getSourceUrl(source: LoadedSource): string | null {
  const { type, mcp, api, local } = source.config

  if (type === 'mcp' && mcp?.url) return mcp.url
  if (type === 'api' && api?.baseUrl) return api.baseUrl
  if (type === 'local' && local?.path) return local.path

  return null
}

/**
 * Convert permissions config to PermissionRow[] for API/local sources
 */
function buildApiPermissionsData(config: PermissionsConfigFile): PermissionRow[] {
  const rows: PermissionRow[] = []

  // Blocked Tools
  config.blockedTools?.forEach((item) => {
    const pattern = typeof item === 'string' ? item : item.pattern
    const comment = typeof item === 'string' ? null : item.comment
    rows.push({ access: 'blocked', type: 'tool', pattern, comment })
  })

  // Allowed Bash Patterns
  config.allowedBashPatterns?.forEach((item) => {
    const pattern = typeof item === 'string' ? item : item.pattern
    const comment = typeof item === 'string' ? null : item.comment
    rows.push({ access: 'allowed', type: 'bash', pattern, comment })
  })

  // Allowed API Endpoints
  config.allowedApiEndpoints?.forEach((item) => {
    const pattern = `${item.method} ${item.path}`
    const comment = typeof item === 'object' && 'comment' in item ? item.comment : null
    rows.push({ access: 'allowed', type: 'api', pattern, comment })
  })

  return rows
}

/**
 * Convert permissions config to PermissionRow[] for MCP sources
 */
function buildMcpPermissionsData(config: PermissionsConfigFile): PermissionRow[] {
  const rows: PermissionRow[] = []

  // Blocked Tools
  config.blockedTools?.forEach((item) => {
    const pattern = typeof item === 'string' ? item : item.pattern
    const comment = typeof item === 'string' ? null : item.comment
    rows.push({ access: 'blocked', type: 'mcp', pattern, comment })
  })

  // Allowed MCP Patterns
  config.allowedMcpPatterns?.forEach((item) => {
    const pattern = typeof item === 'string' ? item : item.pattern
    const comment = typeof item === 'string' ? null : item.comment
    rows.push({ access: 'allowed', type: 'mcp', pattern, comment })
  })

  return rows
}

/**
 * Convert MCP tools to ToolRow[]
 */
function buildToolsData(tools: McpToolWithPermission[]): ToolRow[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description || '',
    permission: tool.allowed ? 'allowed' : 'requires-permission',
  }))
}

/**
 * Get contextual description for Connection section based on source type
 */
function getConnectionDescription(source: LoadedSource, t: (key: string) => string): string {
  const { type, mcp } = source.config

  if (type === 'mcp') {
    if (mcp?.transport === 'stdio') {
      return t('sourceInfo.localCommand')
    }
    return t('sourceInfo.serverUrl')
  }
  if (type === 'api') {
    return t('sourceInfo.baseUrl')
  }
  if (type === 'local') {
    return t('sourceInfo.filesystemPath')
  }
  return t('sourceInfo.connectionDetails')
}

/**
 * Get contextual description for Permissions section based on source type
 */
function getPermissionsDescription(source: LoadedSource, t: (key: string) => string): string {
  const { type } = source.config

  if (type === 'mcp') {
    return t('sourceInfo.toolPatternsAllowed')
  }
  if (type === 'api') {
    return t('sourceInfo.apiEndpointsAllowed')
  }
  return t('sourceInfo.accessRules')
}

function getSourceAuthKind(source: LoadedSource): 'oauth' | 'credential' | null {
  const { type, mcp, api } = source.config
  if (type === 'mcp') {
    if (mcp?.authType === 'oauth') return 'oauth'
    if (mcp?.authType === 'bearer' || (mcp?.headerNames?.length ?? 0) > 0) return 'credential'
    return null
  }
  if (type === 'api') {
    if (!api?.authType || api.authType === 'none') return null
    if (api.authType === 'oauth') return 'oauth'
    return 'credential'
  }
  return null
}

function getConnectionStatus(source: LoadedSource, t: (key: string) => string): { label: string; className: string } {
  switch (source.config.connectionStatus) {
    case 'connected':
      return { label: t('sourceInfo.statusConnected'), className: 'bg-success/10 text-success' }
    case 'needs_auth':
      return { label: t('sourceInfo.statusAuthRequired'), className: 'bg-warning/10 text-warning' }
    case 'failed':
      return { label: t('sourceInfo.statusFailed'), className: 'bg-destructive/10 text-destructive' }
    case 'untested':
      return { label: t('sourceInfo.statusUntested'), className: 'bg-foreground/10 text-foreground/50' }
    case 'local_disabled':
      return { label: t('sourceInfo.statusDisabled'), className: 'bg-foreground/10 text-foreground/50' }
    default:
      return { label: t('sourceInfo.statusUnknown'), className: 'bg-foreground/10 text-foreground/50' }
  }
}

function getCredentialLabel(source: LoadedSource, t: (key: string) => string): string {
  const authType = source.config.api?.authType ?? source.config.mcp?.authType
  if (authType === 'basic') return t('sourceInfo.credentialUsernamePassword')
  if (authType === 'bearer') return t('sourceInfo.credentialBearerToken')
  if (authType === 'header') return t('sourceInfo.credentialApiKey')
  if (authType === 'query') return t('sourceInfo.credentialApiKey')
  return t('sourceInfo.credential')
}

function getCredentialHeaderNames(source: LoadedSource): string[] {
  return source.config.api?.headerNames ?? source.config.mcp?.headerNames ?? []
}

function getCredentialMode(source: LoadedSource): 'basic' | 'multi-header' | 'single' {
  if (getCredentialHeaderNames(source).length > 0) return 'multi-header'
  if (source.config.api?.authType === 'basic') return 'basic'
  return 'single'
}

function hasAgentManagedMcpCredentials(source: LoadedSource): boolean {
  const { type, mcp } = source.config
  return type === 'mcp' && mcp?.transport === 'stdio' && !!mcp.env && Object.keys(mcp.env).length > 0
}

export default function SourceInfoPage({ sourceSlug, workspaceId, onDelete }: SourceInfoPageProps) {
  const { t } = useTranslation()
  const { workspaces } = useAppShellContext()
  const { navigateToSource } = useNavigation()
  const [source, setSource] = useState<LoadedSource | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [permissionsConfig, setPermissionsConfig] = useState<PermissionsConfigFile | null>(null)
  const [mcpTools, setMcpTools] = useState<McpToolWithPermission[] | null>(null)
  const [mcpToolsLoading, setMcpToolsLoading] = useState(false)
  const [mcpToolsError, setMcpToolsError] = useState<string | null>(null)
  const [localMcpEnabled, setLocalMcpEnabled] = useState(true)
  const [credentialDialogOpen, setCredentialDialogOpen] = useState(false)
  const [credentialValue, setCredentialValue] = useState('')
  const [credentialUsername, setCredentialUsername] = useState('')
  const [credentialPassword, setCredentialPassword] = useState('')
  const [credentialHeaders, setCredentialHeaders] = useState<Record<string, string>>({})
  const [credentialSaving, setCredentialSaving] = useState(false)
  const [oauthRunning, setOauthRunning] = useState(false)
  const [testRunning, setTestRunning] = useState(false)
  const [testResultOpen, setTestResultOpen] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; warning: boolean; output: string } | null>(null)


  // Load source data
  useEffect(() => {
    let isMounted = true
    setLoading(true)
    setError(null)

    const loadSource = async () => {
      try {
        const sources = await window.electronAPI.getSources(workspaceId)

        if (!isMounted) return

        const found = sources.find((s) => s.config.slug === sourceSlug)
        if (found) {
          setSource(found)

          const config = await window.electronAPI.getSourcePermissionsConfig(workspaceId, sourceSlug)
          if (isMounted) {
            setPermissionsConfig(config)
          }
        } else {
          setError(t('sourceInfo.notFound'))
        }
      } catch (err) {
        if (!isMounted) return
        setError(err instanceof Error ? err.message : t('sourceInfo.failedToLoad'))
      } finally {
        if (isMounted) setLoading(false)
      }
    }

    loadSource()

    return () => {
      isMounted = false
    }
  }, [workspaceId, sourceSlug])

  // Load MCP tools when source is loaded and is MCP type
  useEffect(() => {
    if (!source || source.config.type !== 'mcp') {
      setMcpTools(null)
      setMcpToolsError(null)
      return
    }

    let isMounted = true
    setMcpToolsLoading(true)
    setMcpToolsError(null)

    const loadTools = async () => {
      try {
        const result = await window.electronAPI.getMcpTools(workspaceId, sourceSlug)
        if (!isMounted) return

        if (result.success && result.tools) {
          setMcpTools(result.tools)
        } else {
          setMcpToolsError(result.error || t('sourceInfo.failedToLoadTools'))
        }
      } catch (err) {
        if (!isMounted) return
        setMcpToolsError(err instanceof Error ? err.message : t('sourceInfo.failedToLoadTools'))
      } finally {
        if (isMounted) setMcpToolsLoading(false)
      }
    }

    loadTools()

    return () => {
      isMounted = false
    }
  }, [source, workspaceId, sourceSlug])

  // Load workspace settings (for localMcpEnabled)
  useEffect(() => {
    if (!workspaceId) return
    window.electronAPI.getWorkspaceSettings(workspaceId).then((settings) => {
      if (settings) {
        setLocalMcpEnabled(settings.localMcpEnabled ?? true)
      }
    }).catch((err) => {
      console.error('[SourceInfoPage] Failed to load workspace settings:', err)
    })
  }, [workspaceId])

  // Listen for source folder changes
  useEffect(() => {
    if (!window.electronAPI?.onSourcesChanged) return

    const cleanup = window.electronAPI.onSourcesChanged((changedWorkspaceId, sources) => {
      if (changedWorkspaceId !== workspaceId) return
      const updated = sources.find((s) => s.config.slug === sourceSlug)

      if (updated) {
        setSource(updated)

        const loadPermissionsConfig = async () => {
          try {
            const config = await window.electronAPI.getSourcePermissionsConfig(workspaceId, sourceSlug)
            setPermissionsConfig(config)
          } catch (err) {
            console.error('[SourceInfoPage] Failed to reload permissions config:', err)
          }
        }
        loadPermissionsConfig()
      }
    })

    return cleanup
  }, [sourceSlug, workspaceId])

  // Compute source URL
  const sourceUrl = useMemo(() => source ? getSourceUrl(source) : null, [source])

  // Build data for PermissionsDataTable
  const apiPermissionsData = useMemo(() => {
    if (!permissionsConfig || source?.config.type === 'mcp') return []
    return buildApiPermissionsData(permissionsConfig)
  }, [permissionsConfig, source])

  const mcpPermissionsData = useMemo(() => {
    if (!permissionsConfig || source?.config.type !== 'mcp') return []
    return buildMcpPermissionsData(permissionsConfig)
  }, [permissionsConfig, source])

  // Build data for ToolsDataTable
  const toolsData = useMemo(() => {
    if (!mcpTools) return []
    return buildToolsData(mcpTools)
  }, [mcpTools])

  // Handle opening URL (website or folder)
  const handleOpenUrl = useCallback(async () => {
    if (!source || !sourceUrl) return
    if (window.electronAPI) {
      if (sourceUrl.startsWith('http://') || sourceUrl.startsWith('https://')) {
        await window.electronAPI.openUrl(sourceUrl)
      } else {
        await window.electronAPI.showInFolder(sourceUrl)
      }
    }
  }, [source, sourceUrl])

  // Handle opening source folder
  const handleOpenSourceFolder = useCallback(async () => {
    if (!source) return
    if (window.electronAPI) {
      await window.electronAPI.showInFolder(source.folderPath)
    }
  }, [source])

  // Handle deleting source (navigates to source list, preserving current filter)
  const handleDelete = useCallback(async () => {
    if (!source) return
    try {
      await window.electronAPI.deleteSource(workspaceId, sourceSlug)
      toast.success(t('sourceInfo.deletedSource', { name: source.config.name }))
      navigateToSource() // Navigate to source list, preserving filter
      onDelete?.()
    } catch (err) {
      toast.error(t('sourceInfo.failedToDelete'), {
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }, [source, workspaceId, sourceSlug, onDelete, navigateToSource])

  // Handle opening in new window
  const handleOpenInNewWindow = useCallback(() => {
    window.electronAPI.openUrl(`craftagents://sources/source/${sourceSlug}?window=focused`)
  }, [sourceSlug])

  // Get source name for header
  const sourceName = source?.config.name || sourceSlug
  const workspaceRootPath = useMemo(
    () => workspaces.find((workspace) => workspace.id === workspaceId)?.rootPath,
    [workspaceId, workspaces],
  )
  const authKind = source ? getSourceAuthKind(source) : null
  const connectionStatus = source ? getConnectionStatus(source, t) : null
  const credentialMode = source ? getCredentialMode(source) : 'single'
  const credentialHeaderNames = source ? getCredentialHeaderNames(source) : []
  const canSaveCredential = credentialMode === 'basic'
    ? credentialUsername.trim().length > 0 && credentialPassword.trim().length > 0
    : credentialMode === 'multi-header'
    ? credentialHeaderNames.every(name => credentialHeaders[name]?.trim().length > 0)
    : credentialValue.trim().length > 0

  useEffect(() => {
    if (!credentialDialogOpen || !source) return
    setCredentialValue('')
    setCredentialUsername('')
    setCredentialPassword('')
    setCredentialHeaders(Object.fromEntries(getCredentialHeaderNames(source).map(name => [name, ''])))
  }, [credentialDialogOpen, source])

  const reloadSource = useCallback(async () => {
    const sources = await window.electronAPI.getSources(workspaceId)
    const found = sources.find(s => s.config.slug === sourceSlug)
    if (found) setSource(found)
  }, [sourceSlug, workspaceId])

  const handleOAuth = useCallback(async () => {
    if (!source) return
    setOauthRunning(true)
    try {
      const result = await window.electronAPI.performOAuth({ sourceSlug: source.config.slug })
      if (result.success) {
        toast.success(t('sourceInfo.sourceConnected'))
        await reloadSource()
      } else {
        toast.error(t('sourceInfo.failedToConnect'), { description: result.error })
      }
    } catch (err) {
      toast.error(t('sourceInfo.failedToConnect'), { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setOauthRunning(false)
    }
  }, [reloadSource, source, t])

  const handleSaveCredential = useCallback(async () => {
    if (!source || !canSaveCredential) return
    setCredentialSaving(true)
    try {
      const credential = credentialMode === 'basic'
        ? { username: credentialUsername.trim(), password: credentialPassword.trim() }
        : credentialMode === 'multi-header'
        ? { headers: Object.fromEntries(credentialHeaderNames.map(name => [name, credentialHeaders[name]?.trim() ?? ''])) }
        : { value: credentialValue.trim() }
      await window.electronAPI.saveSourceCredentials(workspaceId, source.config.slug, credential)
      toast.success(t('sourceInfo.credentialSaved'))
      setCredentialValue('')
      setCredentialUsername('')
      setCredentialPassword('')
      setCredentialHeaders({})
      setCredentialDialogOpen(false)
      await reloadSource()
    } catch (err) {
      toast.error(t('sourceInfo.failedToSaveCredential'), { description: err instanceof Error ? err.message : String(err) })
    } finally {
      setCredentialSaving(false)
    }
  }, [canSaveCredential, credentialHeaderNames, credentialHeaders, credentialMode, credentialPassword, credentialUsername, credentialValue, reloadSource, source, t, workspaceId])


  const handleTestSource = useCallback(async () => {
    if (!source) return
    setTestRunning(true)
    try {
      const result = await window.electronAPI.testSource(workspaceId, source.config.slug)
      setTestResult({ success: result.success, warning: result.warning, output: result.output })
      setTestResultOpen(true)
      if (result.source) setSource(result.source)
      if (result.success && !result.warning) {
        toast.success(t('sourceInfo.testPassed'))
      } else if (result.success && result.warning) {
        toast.warning(t('sourceInfo.testPassedWithWarnings'))
      } else {
        toast.error(t('sourceInfo.testFailed'))
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      setTestResult({ success: false, warning: false, output: message })
      setTestResultOpen(true)
      toast.error(t('sourceInfo.testFailed'), { description: message })
    } finally {
      setTestRunning(false)
    }
  }, [source, t, workspaceId])

  return (
    <>
    <Info_Page
      loading={loading}
      error={error ?? undefined}
      empty={!source && !loading && !error ? t('sourceInfo.notFound') : undefined}
    >
      <Info_Page.Header
        title={sourceName}
        titleNode={<ResourceBreadcrumbTitle rootLabel={t('sidebar.resources')} currentLabel={sourceName} onRootClick={() => navigateToSource()} />}
        actions={workspaceRootPath ? <CreateResourceDropdown workspaceRootPath={workspaceRootPath} /> : undefined}
        titleMenu={
          <SourceMenu
            sourceSlug={sourceSlug}
            sourceName={sourceName}
            onOpenInNewWindow={handleOpenInNewWindow}
            onShowInFinder={handleOpenSourceFolder}
            onDelete={handleDelete}
          />
        }
      />

      {source && (
        <Info_Page.Content>
          {/* Hero: Avatar, title, and tagline */}
          <Info_Page.Hero
            avatar={<SourceAvatar source={source} fluid />}
            title={source.config.name}
            tagline={source.config.tagline}
          />

          {/* Disabled Warning */}
          {source.config.mcp?.transport === 'stdio' && !localMcpEnabled && (
            <Info_Alert variant="warning" icon={<AlertCircle className="h-4 w-4" />}>
              <Info_Alert.Title>{t('sourceInfo.sourceDisabled')}</Info_Alert.Title>
              <Info_Alert.Description>
                {t('sourceInfo.localMcpDisabled')}
              </Info_Alert.Description>
            </Info_Alert>
          )}

          {authKind === null && hasAgentManagedMcpCredentials(source) && (
            <Info_Alert variant="info" icon={<KeyRound className="h-4 w-4" />}>
              <Info_Alert.Title>{t('sourceInfo.agentManagedCredentialsTitle')}</Info_Alert.Title>
              <Info_Alert.Description>
                {t('sourceInfo.agentManagedCredentialsDescription')}
              </Info_Alert.Description>
            </Info_Alert>
          )}

          {/* Connection */}
          <Info_Section
            title={t('sourceInfo.connection')}
            description={getConnectionDescription(source, t)}
            actions={
              <div className="flex items-center gap-2">
                {authKind === 'oauth' && (
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handleOAuth} disabled={oauthRunning}>
                    {oauthRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlugZap className="h-3.5 w-3.5" />}
                    {source.config.connectionStatus === 'connected' ? t('sourceInfo.reconnect') : t('sourceInfo.connect')}
                  </Button>
                )}
                {authKind === 'credential' && (
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => setCredentialDialogOpen(true)}>
                    <KeyRound className="h-3.5 w-3.5" />
                    {source.config.connectionStatus === 'connected' ? t('sourceInfo.updateCredential') : t('sourceInfo.addCredential')}
                  </Button>
                )}
                <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={handleTestSource} disabled={testRunning}>
                  {testRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <TestTube2 className="h-3.5 w-3.5" />}
                  {t('sourceInfo.test')}
                </Button>
                <EditPopover
                  trigger={<EditButton />}
                  {...getEditConfig('source-config', source.folderPath)}
                  secondaryAction={{
                    label: t('common.editFile'),
                    filePath: `${source.folderPath}/config.json`,
                  }}
                />
              </div>
            }
          >
            <Info_Table
              footer={source.config.connectionError && (
                <div className="px-4 py-2 border-t border-border/30 bg-destructive/5">
                  <div className="flex items-start gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                    <span>{source.config.connectionError}</span>
                  </div>
                </div>
              )}
            >
              <Info_Table.Row label={t('common.type')} value={source.config.type.toUpperCase()} />
              {connectionStatus && (
                <Info_Table.Row label="Status">
                  <span className={cn('inline-flex h-[18px] items-center rounded px-1.5 text-[10px] font-medium', connectionStatus.className)}>
                    {connectionStatus.label}
                  </span>
                </Info_Table.Row>
              )}
              {authKind && <Info_Table.Row label={t('sourceInfo.authentication')} value={authKind === 'oauth' ? 'OAuth' : getCredentialLabel(source, t)} />}
              {sourceUrl && (
                <Info_Table.Row label={t('common.url')}>
                  <button
                    onClick={handleOpenUrl}
                    className="truncate hover:underline text-foreground focus:outline-none focus-visible:underline text-left block w-full"
                  >
                    {sourceUrl}
                  </button>
                </Info_Table.Row>
              )}
              <Info_Table.Row label={t('sourceInfo.lastTested')} value={formatRelativeTime(source.config.lastTestedAt, t)} />
            </Info_Table>
          </Info_Section>

          {/* Permissions - for API and local sources */}
          {source.config.type !== 'mcp' && permissionsConfig && apiPermissionsData.length > 0 && (
            <Info_Section
              title={t('sourceInfo.permissions')}
              description={getPermissionsDescription(source, t)}
              actions={
                // EditPopover for AI-assisted permissions.json editing
                <EditPopover
                  trigger={<EditButton />}
                  {...getEditConfig('source-permissions', source.folderPath)}
                  secondaryAction={{
                    label: t('common.editFile'),
                    filePath: `${source.folderPath}/permissions.json`,
                  }}
                />
              }
            >
              <PermissionsDataTable data={apiPermissionsData} fullscreen fullscreenTitle="Permissions" />
            </Info_Section>
          )}

          {/* Tools - for MCP sources */}
          {source.config.type === 'mcp' && (
            <Info_Section
              title={t('sourceInfo.tools')}
              description={t('sourceInfo.toolsDesc')}
              actions={
                // EditPopover for AI-assisted tool permissions editing
                <EditPopover
                  trigger={<EditButton />}
                  {...getEditConfig('source-tool-permissions', source.folderPath)}
                  secondaryAction={{
                    label: t('common.editFile'),
                    filePath: `${source.folderPath}/permissions.json`,
                  }}
                />
              }
            >
              <ToolsDataTable
                data={toolsData}
                loading={mcpToolsLoading}
                error={mcpToolsError ?? undefined}
              />
            </Info_Section>
          )}

          {/* Permissions - for MCP sources */}
          {source.config.type === 'mcp' && permissionsConfig && mcpPermissionsData.length > 0 && (
            <Info_Section
              title={t('sourceInfo.permissions')}
              description={getPermissionsDescription(source, t)}
              actions={
                // EditPopover for AI-assisted permissions.json editing
                <EditPopover
                  trigger={<EditButton />}
                  {...getEditConfig('source-permissions', source.folderPath)}
                  secondaryAction={{
                    label: t('common.editFile'),
                    filePath: `${source.folderPath}/permissions.json`,
                  }}
                />
              }
            >
              <PermissionsDataTable data={mcpPermissionsData} hideTypeColumn fullscreen fullscreenTitle="Permissions" />
            </Info_Section>
          )}

          {/* Documentation */}
          {source.guide?.raw && (
            <Info_Section
              title={t('sourceInfo.documentation')}
              description={t('sourceInfo.documentationDesc')}
              actions={
                // EditPopover for AI-assisted guide.md editing with "Edit File" as secondary action
                <EditPopover
                  trigger={<EditButton />}
                  {...getEditConfig('source-guide', source.folderPath)}
                  secondaryAction={{
                    label: t('common.editFile'),
                    filePath: `${source.folderPath}/guide.md`,
                  }}
                />
              }
            >
              <Info_Markdown maxHeight={540} fullscreen>
                {source.guide.raw}
              </Info_Markdown>
            </Info_Section>
          )}
        </Info_Page.Content>
      )}
    </Info_Page>
    <Dialog open={testResultOpen} onOpenChange={setTestResultOpen}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('sourceInfo.connectionTest')}</DialogTitle>
          <DialogDescription>
            {testResult?.success ? (testResult.warning ? t('sourceInfo.testPassedWithWarningsDescription') : t('sourceInfo.testPassedDescription')) : t('sourceInfo.testFailedDescription')}
          </DialogDescription>
        </DialogHeader>
        <pre className="max-h-[420px] overflow-auto rounded-[8px] border border-border/50 bg-foreground/[0.03] p-3 text-xs leading-5 text-foreground/80 whitespace-pre-wrap">
          {testResult?.output || ''}
        </pre>
        <DialogFooter>
          <Button size="sm" onClick={() => setTestResultOpen(false)}>{t('common.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {source && authKind === 'credential' && (
      <Dialog open={credentialDialogOpen} onOpenChange={setCredentialDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{source.config.connectionStatus === 'connected' ? t('sourceInfo.updateCredential') : t('sourceInfo.addCredential')}</DialogTitle>
            <DialogDescription>
              {t('sourceInfo.credentialDialogDescription', { credential: getCredentialLabel(source, t).toLowerCase(), name: source.config.name })}
            </DialogDescription>
          </DialogHeader>
          {credentialMode === 'basic' ? (
            <div className="space-y-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground/70">{t('sourceInfo.username')}</label>
                <Input
                  autoFocus
                  value={credentialUsername}
                  onChange={(event) => setCredentialUsername(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void handleSaveCredential()
                  }}
                  placeholder={t('sourceInfo.username')}
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-foreground/70">{t('sourceInfo.password')}</label>
                <Input
                  type="password"
                  value={credentialPassword}
                  onChange={(event) => setCredentialPassword(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void handleSaveCredential()
                  }}
                  placeholder={t('sourceInfo.password')}
                />
              </div>
            </div>
          ) : credentialMode === 'multi-header' ? (
            <div className="space-y-3">
              {credentialHeaderNames.map((headerName, index) => (
                <div key={headerName} className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground/70">{headerName}</label>
                  <Input
                    type="password"
                    autoFocus={index === 0}
                    value={credentialHeaders[headerName] ?? ''}
                    onChange={(event) => setCredentialHeaders(prev => ({ ...prev, [headerName]: event.target.value }))}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') void handleSaveCredential()
                    }}
                    placeholder={headerName}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                type="password"
                autoFocus
                value={credentialValue}
                onChange={(event) => setCredentialValue(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') void handleSaveCredential()
                }}
                placeholder={getCredentialLabel(source, t)}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setCredentialDialogOpen(false)} disabled={credentialSaving}>{t('common.cancel')}</Button>
            <Button size="sm" onClick={handleSaveCredential} disabled={!canSaveCredential || credentialSaving}>
              {credentialSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {t('sourceInfo.saveCredential')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )}
    </>
  )
}
