import type { SessionToolContext } from '../context.ts';
import type { ToolResult } from '../types.ts';
import { successResponse, errorResponse } from '../response.ts';

export interface RenameSessionArgs {
  sessionId?: string;
  name: string;
}

export async function handleRenameSession(
  ctx: SessionToolContext,
  args: RenameSessionArgs
): Promise<ToolResult> {
  if (!ctx.renameSession) {
    return errorResponse('rename_session is not available in this context.');
  }

  const name = args.name?.trim();
  if (!name) {
    return errorResponse('Session name cannot be empty.');
  }

  try {
    await ctx.renameSession(args.sessionId, name);
    const target = args.sessionId ? `session ${args.sessionId}` : 'current session';
    return successResponse(`Renamed ${target} to "${name}".`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(`Failed to rename session: ${message}`);
  }
}
