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
    await ctx.pinSession(args.sessionId, args.pinned);
    const target = args.sessionId ? `session ${args.sessionId}` : 'current session';
    return successResponse(args.pinned ? `Pinned ${target}.` : `Unpinned ${target}.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(`Failed to update pin state: ${message}`);
  }
}
