import type { SessionToolContext } from '../context.ts';
import type { ToolResult } from '../types.ts';
import { successResponse, errorResponse } from '../response.ts';

export interface SetSessionAgentArgs {
  sessionId?: string;
  agentId: string;
}

export async function handleSetSessionAgent(
  ctx: SessionToolContext,
  args: SetSessionAgentArgs
): Promise<ToolResult> {
  if (!ctx.setSessionAgent) {
    return errorResponse('set_session_agent is not available in this context.');
  }

  const agentId = args.agentId?.trim();
  if (!agentId) {
    return errorResponse('Missing agentId.');
  }

  try {
    await ctx.setSessionAgent(args.sessionId, agentId);
    const target = args.sessionId ? `session ${args.sessionId}` : 'current session';
    return successResponse(`Agent set to "${agentId}" on ${target}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(`Failed to set session agent: ${message}`);
  }
}
