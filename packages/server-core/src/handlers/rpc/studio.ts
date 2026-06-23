import { isAbsolute, join, relative } from 'path'
import { RPC_CHANNELS } from '@craft-agent/shared/protocol'
import { getWorkspaceByNameOrId } from '@craft-agent/shared/config'
import { adoptStudioOutput, exportStudioOutput, listStudioOutputsForSessions, recordStudioPdfExport, type AdoptStudioOutputInput, type StudioExportFormat } from '@craft-agent/shared/studio'
import { getSessionPath, listSessions } from '@craft-agent/shared/sessions'
import { pushTyped, type RpcServer } from '@craft-agent/server-core/transport'
import type { HandlerDeps } from '../handler-deps'

export const HANDLED_CHANNELS = [
  RPC_CHANNELS.studio.ADOPT,
  RPC_CHANNELS.studio.EXPORT,
  RPC_CHANNELS.studio.CHANGED,
] as const

function workspaceRoot(workspaceId: string): string {
  const workspace = getWorkspaceByNameOrId(workspaceId)
  if (!workspace) throw new Error(`Workspace not found: ${workspaceId}`)
  return workspace.rootPath
}

function sessionPath(root: string, sessionId: string): string {
  return getSessionPath(root, sessionId)
}

function findSessionForDataPath(root: string, htmlPath: string): string {
  const session = listSessions(root).find(item => {
    const rel = relative(join(sessionPath(root, item.id), 'data'), htmlPath)
    return rel && !rel.startsWith('..') && !isAbsolute(rel)
  })
  if (!session) throw new Error('Adopt path must stay inside workspace session data')
  return session.id
}

function changed(server: RpcServer, deps: HandlerDeps, workspaceId: string, root: string, sessionId: string, outputId: string): void {
  deps.sessionManager.notifyConfigFileChange(root, `sessions/${sessionId}/data/studio/${outputId}/metadata.json`)
  pushTyped(server, RPC_CHANNELS.studio.CHANGED, { to: 'workspace', workspaceId }, workspaceId)
}

export function registerStudioHandlers(server: RpcServer, deps: HandlerDeps): void {
  server.handle(RPC_CHANNELS.studio.ADOPT, async (_ctx, workspaceId: string, htmlPath: string, input: AdoptStudioOutputInput) => {
    const root = workspaceRoot(workspaceId)
    const sessionId = findSessionForDataPath(root, htmlPath)
    const output = adoptStudioOutput(sessionPath(root, sessionId), htmlPath, input, sessionId)
    changed(server, deps, workspaceId, root, sessionId, output.metadata.id)
    return output
  })

  server.handle(RPC_CHANNELS.studio.EXPORT, async (_ctx, workspaceId: string, outputId: string, format: StudioExportFormat) => {
    if (!['html', 'zip', 'pdf'].includes(format)) throw new Error('Export format must be html, zip, or pdf')
    const root = workspaceRoot(workspaceId)
    const sessions = listSessions(root)
    const existing = listStudioOutputsForSessions(sessions.map(session => sessionPath(root, session.id))).find(output => output.metadata.id === outputId)
    if (!existing) throw new Error(`Studio output not found: ${outputId}`)
    const existingSessionPath = sessionPath(root, existing.metadata.sessionId)
    if (format === 'pdf') {
      if (!deps.platform.htmlToPdf) throw new Error('PDF export requires the desktop PDF renderer')
      const outputDir = existing.outputDir
      const pdfPath = join(outputDir, 'exports', `${outputId}.pdf`)
      await deps.platform.htmlToPdf({ htmlPath: existing.entryPath, outputPath: pdfPath })
      const output = recordStudioPdfExport(existingSessionPath, outputId, pdfPath)
      changed(server, deps, workspaceId, root, existing.metadata.sessionId, output.metadata.id)
      return output
    }
    const output = exportStudioOutput(existingSessionPath, outputId, format)
    changed(server, deps, workspaceId, root, existing.metadata.sessionId, output.metadata.id)
    return output
  })
}