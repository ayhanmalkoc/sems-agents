import type { SessionToolContext } from '../context.ts';
import type { ToolResult } from '../types.ts';
import { successResponse, errorResponse } from '../response.ts';

export interface PinSessionArgs {
  sessionId?: string;
  pinned: boolean;
}

export async function handlePinSession(
  ctx: SessionToolContext,
  args: PinSessionArgs
): Promise<ToolResult> {
  if (!ctx.pinSession) {
    return errorResponse('pin_session is not available in this context.');
  }

  try {
    const sessionId = args.sessionId?.trim() || undefined;
    await ctx.pinSession(sessionId, args.pinned);
    const target = sessionId ? `session ${sessionId}` : 'current session';
    return successResponse(args.pinned ? `Pinned ${target}.` : `Unpinned ${target}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(`Failed to update pin state: ${message}`);
  }
}
