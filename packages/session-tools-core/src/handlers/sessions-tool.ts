import type { SessionToolContext } from '../context.ts';
import type { ToolResult } from '../types.ts';
import { successResponse, errorResponse } from '../response.ts';

export interface SessionsToolArgs {
  command: string;
}

type ParsedCommand = {
  name: string;
  args: string[];
};

function splitCommand(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let quote: '"' | "'" | null = null;
  let escaped = false;

  for (const char of input.trim()) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }
    if (char === '\\') {
      escaped = true;
      continue;
    }
    if (quote) {
      if (char === quote) quote = null;
      else current += char;
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = '';
      }
      continue;
    }
    current += char;
  }

  if (quote) throw new Error('Unclosed quote in command.');
  if (escaped) current += '\\';
  if (current) tokens.push(current);
  return tokens;
}

function parseCommand(command: string): ParsedCommand {
  const tokens = splitCommand(command);
  const name = tokens.shift();
  if (!name) throw new Error('Missing sessions command.');
  return { name, args: tokens };
}

function parseJsonTail(command: string, prefix: string): unknown {
  const tail = command.trim().slice(prefix.length).trim();
  if (!tail) throw new Error(`Missing JSON payload for ${prefix.trim()}.`);
  try {
    return JSON.parse(tail);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid JSON';
    throw new Error(`Invalid JSON payload: ${message}`);
  }
}

function parseBoolean(value: string | undefined, label: string): boolean {
  if (value === 'true') return true;
  if (value === 'false') return false;
  throw new Error(`${label} must be true or false.`);
}

function requireArg(value: string | undefined, label: string): string {
  const trimmed = value?.trim();
  if (!trimmed) throw new Error(`Missing ${label}.`);
  return trimmed;
}

function sessionTarget(sessionId: string): string {
  return `session ${sessionId}`;
}

export async function handleSessionsTool(
  ctx: SessionToolContext,
  args: SessionsToolArgs
): Promise<ToolResult> {
  const command = args.command?.trim();
  if (!command) return errorResponse('Missing sessions command.');

  let parsed: ParsedCommand;
  try {
    parsed = parseCommand(command);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Invalid command';
    return errorResponse(message);
  }

  try {
    switch (parsed.name) {
      case 'status': {
        const available = {
          list: Boolean(ctx.listSessions),
          show: Boolean(ctx.getSessionInfo),
          spawn: Boolean(ctx.spawnSession),
          labels: Boolean(ctx.setSessionLabels),
          statusSet: Boolean(ctx.setSessionStatus),
          agent: Boolean(ctx.setSessionAgent),
          rename: Boolean(ctx.renameSession),
          archive: Boolean(ctx.archiveSession),
          pin: Boolean(ctx.pinSession),
          delete: Boolean(ctx.deleteSession),
          message: Boolean(ctx.sendAgentMessage),
        };
        return successResponse(JSON.stringify({ ok: true, currentSessionId: ctx.sessionId, available }, null, 2));
      }

      case 'list': {
        if (!ctx.listSessions) return errorResponse('sessions list is not available in this context.');
        const result = ctx.listSessions();
        return successResponse(JSON.stringify(result, null, 2));
      }

      case 'show': {
        if (!ctx.getSessionInfo) return errorResponse('sessions show is not available in this context.');
        const sessionId = requireArg(parsed.args[0], 'sessionId');
        const info = ctx.getSessionInfo(sessionId);
        if (!info) return errorResponse(`Session not found: ${sessionId}`);
        return successResponse(JSON.stringify(info, null, 2));
      }

      case 'spawn': {
        if (!ctx.spawnSession) return errorResponse('sessions spawn is not available in this context.');
        const payload = parseJsonTail(command, 'spawn') as Record<string, unknown>;
        const result = await ctx.spawnSession(payload);
        return successResponse(JSON.stringify(result, null, 2));
      }

      case 'rename': {
        if (!ctx.renameSession) return errorResponse('sessions rename is not available in this context.');
        const sessionId = requireArg(parsed.args[0], 'sessionId');
        const name = parsed.args.slice(1).join(' ').trim();
        if (!name) return errorResponse('Missing name.');
        await ctx.renameSession(sessionId, name);
        return successResponse(`Renamed ${sessionTarget(sessionId)} to "${name}".`);
      }

      case 'labels': {
        if (!ctx.setSessionLabels) return errorResponse('sessions labels is not available in this context.');
        const sessionId = requireArg(parsed.args[0], 'sessionId');
        const payload = parseJsonTail(command, `labels ${sessionId}`);
        if (!Array.isArray(payload) || !payload.every(item => typeof item === 'string')) {
          return errorResponse('labels payload must be a JSON string array.');
        }
        let labels = payload;
        if (ctx.resolveLabels) {
          const { resolved, unknown, available, reasons } = ctx.resolveLabels(labels);
          if (unknown.length > 0) {
            const lines = unknown.map((entry) => `  - "${entry}" — ${reasons?.[entry] ?? 'unknown label'}`);
            return errorResponse(`Labels rejected:\n${lines.join('\n')}\n\nAvailable label IDs: ${available.join(', ')}.`);
          }
          labels = resolved;
        }
        await ctx.setSessionLabels(sessionId, labels);
        return successResponse(labels.length === 0 ? `Labels cleared on ${sessionTarget(sessionId)}.` : `Labels set on ${sessionTarget(sessionId)}: ${labels.join(', ')}`);
      }

      case 'status-set': {
        if (!ctx.setSessionStatus) return errorResponse('sessions status-set is not available in this context.');
        const sessionId = requireArg(parsed.args[0], 'sessionId');
        let status = requireArg(parsed.args[1], 'status');
        if (ctx.resolveStatus) {
          const { resolved, available } = ctx.resolveStatus(status);
          if (!resolved) return errorResponse(`Unknown status: "${status}". Available status IDs: ${available.join(', ')}`);
          status = resolved;
        }
        await ctx.setSessionStatus(sessionId, status);
        return successResponse(`Status set to "${status}" on ${sessionTarget(sessionId)}.`);
      }

      case 'agent': {
        if (!ctx.setSessionAgent) return errorResponse('sessions agent is not available in this context.');
        const sessionId = requireArg(parsed.args[0], 'sessionId');
        const agentId = requireArg(parsed.args[1], 'agentId');
        await ctx.setSessionAgent(sessionId, agentId);
        return successResponse(`Agent set to "${agentId}" on ${sessionTarget(sessionId)}.`);
      }

      case 'archive': {
        if (!ctx.archiveSession) return errorResponse('sessions archive is not available in this context.');
        const sessionId = requireArg(parsed.args[0], 'sessionId');
        const archived = parseBoolean(parsed.args[1], 'archived');
        await ctx.archiveSession(sessionId, archived);
        return successResponse(archived ? `Archived ${sessionTarget(sessionId)}.` : `Unarchived ${sessionTarget(sessionId)}.`);
      }

      case 'pin': {
        if (!ctx.pinSession) return errorResponse('sessions pin is not available in this context.');
        const sessionId = requireArg(parsed.args[0], 'sessionId');
        const pinned = parseBoolean(parsed.args[1], 'pinned');
        await ctx.pinSession(sessionId, pinned);
        return successResponse(pinned ? `Pinned ${sessionTarget(sessionId)}.` : `Unpinned ${sessionTarget(sessionId)}.`);
      }

      case 'delete': {
        if (!ctx.deleteSession) return errorResponse('sessions delete is not available in this context.');
        const sessionId = requireArg(parsed.args[0], 'sessionId');
        if (!parsed.args.includes('--confirm')) return errorResponse('sessions delete requires --confirm.');
        await ctx.deleteSession(sessionId);
        return successResponse(`Deleted ${sessionTarget(sessionId)}.`);
      }

      case 'message': {
        if (!ctx.sendAgentMessage) return errorResponse('sessions message is not available in this context.');
        const sessionId = requireArg(parsed.args[0], 'sessionId');
        const message = parsed.args.slice(1).join(' ').trim();
        if (!message) return errorResponse('Missing message.');
        if (sessionId === ctx.sessionId) return errorResponse('Cannot send a message to your own session. Use a different sessionId.');
        const senderName = ctx.getSessionInfo?.()?.name ?? ctx.sessionId;
        const wrappedMessage = [
          `[Message from session "${ctx.sessionId}" (${senderName})]`,
          `Use sessions message ${ctx.sessionId} "<reply>" to reply.`,
          '',
          '---',
          '',
          message,
        ].join('\n');
        await ctx.sendAgentMessage(sessionId, wrappedMessage);
        return successResponse(`Message sent to ${sessionTarget(sessionId)}. The session will process it independently.`);
      }

      default:
        return errorResponse(`Unknown sessions command: ${parsed.name}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return errorResponse(`sessions ${parsed.name} failed: ${message}`);
  }
}
