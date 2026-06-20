import { RPC_CHANNELS } from '@craft-agent/shared/protocol'
import { getWorkspaceByNameOrId } from '@craft-agent/shared/config'
import { approveMemorySuggestion, clearSessionNotes, deleteMemory, loadMemories, loadMemoryBrainActivity, loadMemorySuggestions, loadSessionNotes, rejectMemorySuggestion, searchMemories, type SessionNoteScope } from '@craft-agent/shared/memory'
import { pushTyped, type RpcServer } from '@craft-agent/server-core/transport'
import type { HandlerDeps } from '../handler-deps'

export const HANDLED_CHANNELS = [
  RPC_CHANNELS.memory.GET,
  RPC_CHANNELS.memory.GET_SUGGESTIONS,
  RPC_CHANNELS.memory.GET_SESSION_NOTES,
  RPC_CHANNELS.memory.GET_ACTIVITY,
  RPC_CHANNELS.memory.SEARCH,
  RPC_CHANNELS.memory.DELETE,
  RPC_CHANNELS.memory.APPROVE,
  RPC_CHANNELS.memory.REJECT,
  RPC_CHANNELS.memory.CLEAR_SESSION_NOTES,
] as const

function workspaceRoot(workspaceId: string): string {
  const workspace = getWorkspaceByNameOrId(workspaceId)
  if (!workspace) throw new Error(`Workspace not found: ${workspaceId}`)
  return workspace.rootPath
}

export function registerMemoryHandlers(server: RpcServer, deps: HandlerDeps): void {
  const changed = (workspaceId: string) => {
    deps.sessionManager.notifyConfigFileChange(workspaceRoot(workspaceId), 'memory/memories.json')
    deps.sessionManager.notifyConfigFileChange(workspaceRoot(workspaceId), 'memory/suggestions.json')
    pushTyped(server, RPC_CHANNELS.memory.CHANGED, { to: 'workspace', workspaceId }, workspaceId)
  }

  server.handle(RPC_CHANNELS.memory.GET, async (_ctx, workspaceId: string) => loadMemories(workspaceRoot(workspaceId)))
  server.handle(RPC_CHANNELS.memory.GET_SUGGESTIONS, async (_ctx, workspaceId: string) => loadMemorySuggestions(workspaceRoot(workspaceId)))
  server.handle(RPC_CHANNELS.memory.GET_SESSION_NOTES, async (_ctx, workspaceId: string) => loadSessionNotes(workspaceRoot(workspaceId)))
  server.handle(RPC_CHANNELS.memory.GET_ACTIVITY, async (_ctx, workspaceId: string) => loadMemoryBrainActivity(workspaceRoot(workspaceId)))
  server.handle(RPC_CHANNELS.memory.SEARCH, async (_ctx, workspaceId: string, query: string) => searchMemories(loadMemories(workspaceRoot(workspaceId)), query))
  server.handle(RPC_CHANNELS.memory.DELETE, async (_ctx, workspaceId: string, memoryId: string) => {
    deleteMemory(workspaceRoot(workspaceId), memoryId)
    changed(workspaceId)
  })
  server.handle(RPC_CHANNELS.memory.APPROVE, async (_ctx, workspaceId: string, suggestionId: string) => {
    const result = approveMemorySuggestion(workspaceRoot(workspaceId), suggestionId, 'ui')
    changed(workspaceId)
    return result
  })
  server.handle(RPC_CHANNELS.memory.REJECT, async (_ctx, workspaceId: string, suggestionId: string) => {
    const result = rejectMemorySuggestion(workspaceRoot(workspaceId), suggestionId, 'ui')
    changed(workspaceId)
    return result
  })
  server.handle(RPC_CHANNELS.memory.CLEAR_SESSION_NOTES, async (_ctx, workspaceId: string, scope: SessionNoteScope) => {
    const count = clearSessionNotes(workspaceRoot(workspaceId), scope)
    changed(workspaceId)
    return count
  })
}
