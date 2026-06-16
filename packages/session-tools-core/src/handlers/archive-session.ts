import type { SessionToolContext } from '../context.ts';
import type { ToolResult } from '../types.ts';
import { successResponse, errorResponse } from '../response.ts';

export interface ArchiveSessionArgs {
  sessionId?: string;
  archived: boolean;
}

export async function handleArchiveSession(
  ctx: SessionToolContext,
  args: ArchiveSessionArgs
): Promise<ToolResult> {
  if (!ctx.archiveSession) {
    return errorResponse('archive_session is not available in this context.');
  }

  try {
    await ctx.archiveSession(args.sessionId, args.archived);
    const target = args.sessionId ? `session ${args.sessionId}` : 'current session';
    return successResponse(args.archived ? `Archived ${target}.` : `Unarchived ${target}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(`Failed to update archive state: ${message}`);
  }
}
