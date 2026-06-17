import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import type { CreateMemoryInput, CreateWorkingMemoryInput, MemoryHygieneItem, MemoryRecord, MemoryStatusSnapshot, MemorySuggestion, UpdateMemoryInput, WorkingMemoryNote, WorkingMemoryScope } from '../memory/types.ts'

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
  hygiene: () => Promise<MemoryHygieneItem[]>
  merge: (targetId: string, sourceId: string) => Promise<{ target: MemoryRecord; source: MemoryRecord }>
  markStale: (memoryId: string) => Promise<MemoryRecord>
  refresh: (memoryId: string, updates: UpdateMemoryInput) => Promise<MemoryRecord>
  workingList: () => Promise<WorkingMemoryNote[]>
  workingAdd: (input: CreateWorkingMemoryInput) => Promise<WorkingMemoryNote>
  workingClear: (scope: WorkingMemoryScope) => Promise<number>
  suggestFromSession: (sessionId: string) => Promise<MemorySuggestion | MemorySuggestion[]>
  approve: (suggestionId: string) => Promise<{ suggestion: MemorySuggestion; memory: MemoryRecord }>
  reject: (suggestionId: string) => Promise<MemorySuggestion>
  listSuggestions?: () => Promise<MemorySuggestion[]>
  learn?: (target: string) => Promise<MemoryLearnSummary>
}

export interface MemoryLearnSummary {
  mode: 'auto' | 'review' | 'off-as-review'
  processed: number
  created: MemoryRecord[]
  suggested: MemorySuggestion[]
  skipped: number
  reasons?: string[]
}

const MemorySchema = z.object({
  command: z.string().describe('Memory command: status, list, show <memoryId>, search <query>, create <json>, update <memoryId> <json>, delete <memoryId>, suggest-from-session <sessionId>, learn <current|recent|all|sessionId>, approve <suggestionId>, reject <suggestionId>, hygiene, merge <targetId> <sourceId>, mark-stale <memoryId>, refresh <memoryId> <json>, working-list, working-add <json>, working-clear <session|day>.'),
})

function success(text: string): ToolResult { return { content: [{ type: 'text', text }] } }
function failure(text: string): ToolResult { return { content: [{ type: 'text', text: `Error: ${text}` }], isError: true } }
function parseJsonPayload<T>(value: string, label: string): T {
  if (!value.trim()) throw new Error(`${label} requires a JSON payload`)
  try { return JSON.parse(value) as T } catch (error) { throw new Error(`Invalid JSON payload: ${error instanceof Error ? error.message : String(error)}`) }
}
function formatMemory(memory: MemoryRecord): string {
  const content = memory.content.length > 240 ? `${memory.content.slice(0, 237)}...` : memory.content
  const parts = [memory.id, `type=${memory.type}`, `scope=${memory.scope}`, `status=${memory.status ?? 'active'}`, `confidence=${memory.confidence ?? 'n/a'}`, `title=${JSON.stringify(memory.title)}`, `sourceSessionId=${memory.sourceSessionId}`]
  if (memory.tags?.length) parts.push(`tags=${memory.tags.join(',')}`)
  if (memory.agentProfileId) parts.push(`agentProfileId=${memory.agentProfileId}`)
  if (memory.sessionId) parts.push(`sessionId=${memory.sessionId}`)
  if (memory.supersedes?.length) parts.push(`supersedes=${memory.supersedes.join(',')}`)
  return `- ${parts.join(' ')}\n  ${content}`
}
function formatSuggestion(suggestion: MemorySuggestion): string {
  const content = suggestion.content.length > 240 ? `${suggestion.content.slice(0, 237)}...` : suggestion.content
  const parts = [suggestion.id, `status=${suggestion.status}`, `type=${suggestion.type}`, `scope=${suggestion.scope}`, `confidence=${suggestion.confidence ?? 'n/a'}`, `title=${JSON.stringify(suggestion.title)}`]
  if (suggestion.memoryId) parts.push(`memoryId=${suggestion.memoryId}`)
  return `- ${parts.join(' ')}\n  ${content}`
}
function formatSuggestions(suggestions: MemorySuggestion[]): string {
  if (suggestions.length === 0) return 'No strong memory candidates found'
  return suggestions.map(formatSuggestion).join('\n')
}

function formatHygiene(items: MemoryHygieneItem[]): string {
  if (items.length === 0) return 'Memory hygiene: no issues found'
  return ['Memory hygiene:', ...items.map(item => `- ${item.kind} memoryId=${item.memoryId}${item.relatedMemoryId ? ` relatedMemoryId=${item.relatedMemoryId}` : ''} reason=${JSON.stringify(item.reason)}`)].join('\n')
}
function formatWorkingNote(note: WorkingMemoryNote): string {
  const parts = [note.id, `scope=${note.scope}`, `title=${JSON.stringify(note.title)}`, `sourceSessionId=${note.sourceSessionId}`]
  if (note.sessionId) parts.push(`sessionId=${note.sessionId}`)
  if (note.day) parts.push(`day=${note.day}`)
  if (note.tags?.length) parts.push(`tags=${note.tags.join(',')}`)
  return `- ${parts.join(' ')}\n  ${note.content}`
}
function formatWorkingNotes(notes: WorkingMemoryNote[]): string {
  if (notes.length === 0) return 'Working memory: none'
  return ['Working memory:', ...notes.map(formatWorkingNote)].join('\n')
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

function formatLearnSummary(summary: MemoryLearnSummary): string {
  const lines = [
    `Memory learn: mode=${summary.mode} processed=${summary.processed} created=${summary.created.length} suggested=${summary.suggested.length} skipped=${summary.skipped}`,
  ]
  if (summary.created.length) lines.push('Created:', ...summary.created.map(formatMemory))
  if (summary.suggested.length) lines.push('Suggested:', ...summary.suggested.map(formatSuggestion))
  if (summary.reasons?.length) lines.push('Skipped reasons:', ...summary.reasons.map(reason => `- ${reason}`))
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
    if (verb === 'hygiene') return success(formatHygiene(await fns.hygiene()))
    if (verb === 'merge') {
      const [targetId, sourceId] = rest
      if (!targetId || !sourceId) return failure('merge requires target and source memory ids')
      const result = await fns.merge(targetId, sourceId)
      return success(`Merged source ${result.source.id} into target ${result.target.id}\n${formatMemory(result.target)}\n${formatMemory(result.source)}`)
    }
    if (verb === 'mark-stale') {
      const memoryId = rest[0]
      if (!memoryId) return failure('mark-stale requires a memory id')
      const memory = await fns.markStale(memoryId)
      return success(`Marked memory stale ${memory.id}\n${formatMemory(memory)}`)
    }
    if (verb === 'refresh') {
      const memoryId = rest[0]
      if (!memoryId) return failure('refresh requires a memory id')
      const payload = trimmed.slice(rawVerb.length).trim().slice(memoryId.length).trim()
      const memory = await fns.refresh(memoryId, parseJsonPayload<UpdateMemoryInput>(payload, 'refresh'))
      return success(`Refreshed memory ${memory.id}\n${formatMemory(memory)}`)
    }
    if (verb === 'working-list') return success(formatWorkingNotes(await fns.workingList()))
    if (verb === 'working-add') {
      const input = parseJsonPayload<CreateWorkingMemoryInput>(trimmed.slice(rawVerb.length).trim(), 'working-add')
      const note = await fns.workingAdd(input)
      return success(`Added working memory ${note.id}\n${formatWorkingNote(note)}`)
    }
    if (verb === 'working-clear') {
      const scope = rest[0] as WorkingMemoryScope | undefined
      if (scope !== 'session' && scope !== 'day') return failure('working-clear requires scope: session or day')
      const count = await fns.workingClear(scope)
      return success(`Cleared ${count} working memory note${count === 1 ? '' : 's'} for scope ${scope}`)
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
    if (verb === 'learn') {
      if (!fns.learn) return failure('learn is not available in this context')
      const target = rest.join(' ').trim()
      if (!target) return failure('learn requires target: current, recent, all, or session id')
      return success(formatLearnSummary(await fns.learn(target)))
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
  return tool('memory', 'Manage persistent scoped workspace memory: retrieval, suggestions, hygiene, working notes, approvals, and deletion.', MemorySchema.shape, async (args) => {
    const fns = options.getMemoryFns()
    if (!fns) return failure('Memory controls are not available. This tool requires the desktop app.')
    return executeMemoryCommand(String(args.command ?? 'status'), fns)
  })
}
