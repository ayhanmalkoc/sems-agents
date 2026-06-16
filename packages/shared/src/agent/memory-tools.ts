import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import type { CreateMemoryInput, CreateMemorySuggestionInput, MemoryRecord, MemoryStatusSnapshot, MemorySuggestion, UpdateMemoryInput } from '../memory/types.ts'

type ToolResult = {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

export interface MemoryFns {
  status: () => Promise<MemoryStatusSnapshot>
  list: () => Promise<MemoryRecord[]>
  show: (memoryId: string) => Promise<MemoryRecord | undefined>
  search: (query: string) => Promise<MemoryRecord[]>
  create: (input: CreateMemoryInput) => Promise<MemoryRecord>
  update: (memoryId: string, updates: UpdateMemoryInput) => Promise<MemoryRecord>
  delete: (memoryId: string) => Promise<void>
  suggestFromSession: (sessionId: string) => Promise<MemorySuggestion | MemorySuggestion[]>
  approve: (suggestionId: string) => Promise<{ suggestion: MemorySuggestion; memory: MemoryRecord }>
  reject: (suggestionId: string) => Promise<MemorySuggestion>
  listSuggestions?: () => Promise<MemorySuggestion[]>
}

const MemorySchema = z.object({
  command: z.string().describe('Memory command: status, list, show <memoryId>, search <query>, create <json>, update <memoryId> <json>, delete <memoryId>, suggest-from-session <sessionId>, approve <suggestionId>, reject <suggestionId>.'),
})

function success(text: string): ToolResult { return { content: [{ type: 'text', text }] } }
function failure(text: string): ToolResult { return { content: [{ type: 'text', text: `Error: ${text}` }], isError: true } }
function parseJsonPayload<T>(value: string, label: string): T {
  if (!value.trim()) throw new Error(`${label} requires a JSON payload`)
  try { return JSON.parse(value) as T } catch (error) { throw new Error(`Invalid JSON payload: ${error instanceof Error ? error.message : String(error)}`) }
}
function formatMemory(memory: MemoryRecord): string {
  const parts = [memory.id, `type=${memory.type}`, `scope=${memory.scope}`, `title=${JSON.stringify(memory.title)}`, `sourceSessionId=${memory.sourceSessionId}`]
  if (memory.tags?.length) parts.push(`tags=${memory.tags.join(',')}`)
  if (memory.agentProfileId) parts.push(`agentProfileId=${memory.agentProfileId}`)
  if (memory.sessionId) parts.push(`sessionId=${memory.sessionId}`)
  return `- ${parts.join(' ')}\n  ${memory.content}`
}
function formatSuggestion(suggestion: MemorySuggestion): string {
  const parts = [suggestion.id, `status=${suggestion.status}`, `type=${suggestion.type}`, `scope=${suggestion.scope}`, `title=${JSON.stringify(suggestion.title)}`]
  if (suggestion.memoryId) parts.push(`memoryId=${suggestion.memoryId}`)
  return `- ${parts.join(' ')}\n  ${suggestion.content}`
}
function formatSuggestions(suggestions: MemorySuggestion[]): string {
  if (suggestions.length === 0) return 'No strong memory candidates found'
  return suggestions.map(formatSuggestion).join('\n')
}
function formatMemories(memories: MemoryRecord[]): string {
  if (memories.length === 0) return 'Memories: none'
  return ['Memories:', ...memories.map(formatMemory)].join('\n')
}
function formatStatus(status: MemoryStatusSnapshot): string {
  const lines = [`Memory: ${status.available ? 'available' : 'unavailable'}`, `Memories: ${status.memories}`, `Suggestions: ${status.suggestions}`, `Pending suggestions: ${status.pendingSuggestions}`]
  if (status.reason) lines.push(`Reason: ${status.reason}`)
  return lines.join('\n')
}

export async function executeMemoryCommand(command: string, fns: MemoryFns): Promise<ToolResult> {
  const trimmed = command.trim()
  const [rawVerb = 'status', ...rest] = trimmed.split(/\s+/)
  const verb = rawVerb.toLowerCase()
  try {
    if (verb === 'status') return success(formatStatus(await fns.status()))
    if (verb === 'list') return success(formatMemories(await fns.list()))
    if (verb === 'show') {
      const memoryId = rest[0]
      if (!memoryId) return failure('show requires a memory id')
      const memory = await fns.show(memoryId)
      if (!memory) return failure(`Memory not found: ${memoryId}`)
      return success(formatMemory(memory))
    }
    if (verb === 'search') {
      const query = trimmed.slice(rawVerb.length).trim()
      if (!query) return failure('search requires a query')
      return success(formatMemories(await fns.search(query)))
    }
    if (verb === 'create') {
      const input = parseJsonPayload<CreateMemoryInput>(trimmed.slice(rawVerb.length).trim(), 'create')
      const memory = await fns.create(input)
      return success(`Created memory ${memory.id}\n${formatMemory(memory)}`)
    }
    if (verb === 'update') {
      const memoryId = rest[0]
      if (!memoryId) return failure('update requires a memory id')
      const payload = trimmed.slice(rawVerb.length).trim().slice(memoryId.length).trim()
      const memory = await fns.update(memoryId, parseJsonPayload<UpdateMemoryInput>(payload, 'update'))
      return success(`Updated memory ${memory.id}\n${formatMemory(memory)}`)
    }
    if (verb === 'delete') {
      const memoryId = rest[0]
      if (!memoryId) return failure('delete requires a memory id')
      await fns.delete(memoryId)
      return success(`Deleted memory ${memoryId}`)
    }
    if (verb === 'suggest-from-session') {
      const sessionId = rest[0]
      if (!sessionId) return failure('suggest-from-session requires a session id')
      const result = await fns.suggestFromSession(sessionId)
      const suggestions = Array.isArray(result) ? result : [result]
      if (suggestions.length === 0) return success('No strong memory candidates found')
      return success(`Created ${suggestions.length} memory suggestion${suggestions.length === 1 ? '' : 's'}\n${formatSuggestions(suggestions)}`)
    }
    if (verb === 'approve') {
      const suggestionId = rest[0]
      if (!suggestionId) return failure('approve requires a suggestion id')
      const result = await fns.approve(suggestionId)
      return success(`Approved suggestion ${result.suggestion.id} as memory ${result.memory.id}\n${formatMemory(result.memory)}`)
    }
    if (verb === 'reject') {
      const suggestionId = rest[0]
      if (!suggestionId) return failure('reject requires a suggestion id')
      const suggestion = await fns.reject(suggestionId)
      return success(`Rejected suggestion ${suggestion.id}`)
    }
    if (verb === 'suggestions') {
      const suggestions = await fns.listSuggestions?.() ?? []
      return success(suggestions.length ? ['Suggestions:', ...suggestions.map(formatSuggestion)].join('\n') : 'Suggestions: none')
    }
    return failure(`Unknown memory command: ${verb}`)
  } catch (error) {
    return failure(error instanceof Error ? error.message : String(error))
  }
}

export function createMemoryTool(options: { getMemoryFns: () => MemoryFns | undefined }) {
  return tool('memory', 'Manage persistent scoped workspace memory: list, inspect, search, create/update/delete approved memories, suggest candidates, approve, and reject.', MemorySchema.shape, async (args) => {
    const fns = options.getMemoryFns()
    if (!fns) return failure('Memory controls are not available. This tool requires the desktop app.')
    return executeMemoryCommand(String(args.command ?? 'status'), fns)
  })
}
