import { RPC_CHANNELS } from '@craft-agent/shared/protocol'
import { getWorkspaceByNameOrId } from '@craft-agent/shared/config'
import { HookEngine, loadHookRuns, setHookEnabled, loadHooksPolicy, saveHooksPolicy, loadCustomHooks, getCustomHook, saveCustomHook, deleteCustomHook, trustReviewCustomHook, trustApproveCustomHook, trustRevokeCustomHook, type CustomHookDefinition } from '@craft-agent/shared/hooks'
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
  server.handle(RPC_CHANNELS.hooks.GET_POLICY, async (_ctx, workspaceId: string) => loadHooksPolicy(workspaceRoot(workspaceId)))
  server.handle(RPC_CHANNELS.hooks.SET_POLICY, async (_ctx, workspaceId: string, policy: Parameters<typeof saveHooksPolicy>[1]) => {
    const next = saveHooksPolicy(workspaceRoot(workspaceId), policy)
    changed(workspaceId)
    return next
  })
  server.handle(RPC_CHANNELS.hooks.CUSTOM_LIST, async (_ctx, workspaceId: string) => loadCustomHooks(workspaceRoot(workspaceId)))
  server.handle(RPC_CHANNELS.hooks.CUSTOM_SHOW, async (_ctx, workspaceId: string, hookId: string) => getCustomHook(workspaceRoot(workspaceId), hookId))
  server.handle(RPC_CHANNELS.hooks.CUSTOM_SAVE, async (_ctx, workspaceId: string, hook: CustomHookDefinition) => {
    const next = saveCustomHook(workspaceRoot(workspaceId), hook)
    changed(workspaceId)
    return next
  })
  server.handle(RPC_CHANNELS.hooks.CUSTOM_DELETE, async (_ctx, workspaceId: string, hookId: string) => {
    deleteCustomHook(workspaceRoot(workspaceId), hookId)
    changed(workspaceId)
  })
  server.handle(RPC_CHANNELS.hooks.TRUST_REVIEW, async (_ctx, workspaceId: string, hookId: string) => trustReviewCustomHook(workspaceRoot(workspaceId), hookId))
  server.handle(RPC_CHANNELS.hooks.TRUST_APPROVE, async (_ctx, workspaceId: string, hookId: string) => {
    const next = trustApproveCustomHook(workspaceRoot(workspaceId), hookId, 'user')
    changed(workspaceId)
    return next
  })
  server.handle(RPC_CHANNELS.hooks.TRUST_REVOKE, async (_ctx, workspaceId: string, hookId: string) => {
    const next = trustRevokeCustomHook(workspaceRoot(workspaceId), hookId)
    changed(workspaceId)
    return next
  })
}
