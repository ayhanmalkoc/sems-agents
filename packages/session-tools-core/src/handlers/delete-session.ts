import type { SessionToolContext } from '../context.ts';
import type { ToolResult } from '../types.ts';
import { successResponse, errorResponse } from '../response.ts';

export interface DeleteSessionArgs {
  sessionId: string;
  confirm?: boolean;
}

export async function handleDeleteSession(
  ctx: SessionToolContext,
  args: DeleteSessionArgs
): Promise<ToolResult> {
  if (!ctx.deleteSession) {
    return errorResponse('delete_session is not available in this context.');
  }

  const sessionId = args.sessionId?.trim();
  if (!sessionId) {
    return errorResponse('Missing sessionId. delete_session requires an explicit target session.');
  }

  if (args.confirm !== true) {
    return errorResponse('delete_session requires confirm: true.');
  }

  try {
    await ctx.deleteSession(sessionId);
    return successResponse(`Deleted session ${sessionId}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(`Failed to delete session: ${message}`);
  }
}
