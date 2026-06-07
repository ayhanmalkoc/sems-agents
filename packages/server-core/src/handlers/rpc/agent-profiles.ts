import { pushTyped, type RpcServer } from '@craft-agent/server-core/transport'
import type { HandlerDeps } from '../handler-deps'
import { RPC_CHANNELS } from '@craft-agent/shared/protocol'
import {
  deleteAgentProfile,
  listAgentProfiles,
  saveAgentProfile,
  updateAgentProfile,
  type CreateAgentProfileInput,
  type UpdateAgentProfileInput,
} from '@craft-agent/shared/agent-profiles'
import { getWorkspaceByNameOrId } from '@craft-agent/shared/config'

function workspaceRoot(workspaceId: string): string {
  const workspace = getWorkspaceByNameOrId(workspaceId)
  if (!workspace) throw new Error(`Workspace ${workspaceId} not found`)
  return workspace.rootPath
}

export function registerAgentProfilesHandlers(server: RpcServer, _deps: HandlerDeps): void {
  server.handle(RPC_CHANNELS.agentProfiles.LIST, async (_ctx, workspaceId: string) => {
    return listAgentProfiles(workspaceRoot(workspaceId))
  })

  server.handle(RPC_CHANNELS.agentProfiles.CREATE, async (_ctx, workspaceId: string, input: CreateAgentProfileInput) => {
    const profile = saveAgentProfile(workspaceRoot(workspaceId), input)
    pushTyped(server, RPC_CHANNELS.agentProfiles.CHANGED, { to: 'workspace', workspaceId }, workspaceId)
    return profile
  })

  server.handle(RPC_CHANNELS.agentProfiles.UPDATE, async (_ctx, workspaceId: string, id: string, updates: UpdateAgentProfileInput) => {
    const profile = updateAgentProfile(workspaceRoot(workspaceId), id, updates)
    pushTyped(server, RPC_CHANNELS.agentProfiles.CHANGED, { to: 'workspace', workspaceId }, workspaceId)
    return profile
  })

  server.handle(RPC_CHANNELS.agentProfiles.DELETE, async (_ctx, workspaceId: string, id: string) => {
    deleteAgentProfile(workspaceRoot(workspaceId), id)
    pushTyped(server, RPC_CHANNELS.agentProfiles.CHANGED, { to: 'workspace', workspaceId }, workspaceId)
  })
}
