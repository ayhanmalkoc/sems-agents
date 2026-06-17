import { RPC_CHANNELS } from '@craft-agent/shared/protocol'
import { getWorkspaceByNameOrId } from '@craft-agent/shared/config'
import { HookEngine, loadHookRuns, setHookEnabled } from '@craft-agent/shared/hooks'
import { pushTyped, type RpcServer } from '@craft-agent/server-core/transport'
import type { HandlerDeps } from '../handler-deps'

function workspaceRoot(workspaceId: string): string {
  const workspace = getWorkspaceByNameOrId(workspaceId)
  if (!workspace) throw new Error(`Workspace not found: ${workspaceId}`)
  return workspace.rootPath
}

export function registerHooksHandlers(server: RpcServer, deps: HandlerDeps): void {
  const changed = (workspaceId: string) => {
    deps.sessionManager.notifyConfigFileChange(workspaceRoot(workspaceId), 'hooks/hooks.json')
    pushTyped(server, RPC_CHANNELS.hooks.CHANGED, { to: 'workspace', workspaceId }, workspaceId)
  }

  server.handle(RPC_CHANNELS.hooks.GET, async (_ctx, workspaceId: string) => new HookEngine(workspaceRoot(workspaceId)).list())
  server.handle(RPC_CHANNELS.hooks.RUNS, async (_ctx, workspaceId: string, hookId?: string) => loadHookRuns(workspaceRoot(workspaceId), hookId))
  server.handle(RPC_CHANNELS.hooks.SET_ENABLED, async (_ctx, workspaceId: string, hookId: string, enabled: boolean) => {
    setHookEnabled(workspaceRoot(workspaceId), hookId, enabled)
    changed(workspaceId)
  })
}
