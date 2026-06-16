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
    const sessionId = args.sessionId?.trim() || undefined;
    await ctx.archiveSession(sessionId, args.archived);
    const target = sessionId ? `session ${sessionId}` : 'current session';
    return successResponse(args.archived ? `Archived ${target}.` : `Unarchived ${target}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(`Failed to update archive state: ${message}`);
  }
}
