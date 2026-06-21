import { tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'
import type { CreateMemoryInput, MemoryHygieneItem, MemoryRecord, MemoryStatusSnapshot, UpdateMemoryInput } from '../memory/types.ts'

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
  learn?: (target: string) => Promise<MemoryLearnSummary>
}

export interface MemoryLearnSummary {
  mode: 'on'
  processed: number
  created: MemoryRecord[]
  skipped: number
  indexedSessions?: number
  pendingSessions?: number
  reasons?: string[]
}

const MemorySchema = z.object({
  command: z.string().describe('Memory command: status, list, show <memoryId>, search <query>, create <json>, update <memoryId> <json>, delete <memoryId>, learn <workspace|current|recent|all|sessionId>, hygiene, merge <targetId> <sourceId>, mark-stale <memoryId>, refresh <memoryId> <json>.'),
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
function formatMemorySearchResult(memory: MemoryRecord): string {
  const content = memory.content.length > 180 ? `${memory.content.slice(0, 177)}...` : memory.content
  return [
    `- id=${memory.id}`,
    `type=${memory.type}`,
    `confidence=${memory.confidence ?? 'n/a'}`,
    `status=${memory.status ?? 'active'}`,
    `title=${JSON.stringify(memory.title)}`,
    `sourceSessionId=${memory.sourceSessionId}`,
    `content=${JSON.stringify(content)}`,
  ].join(' ')
}
function formatMemorySearchResults(memories: MemoryRecord[]): string {
  if (memories.length === 0) return 'Memory search: no relevant memories found'
  return ['Memory search results:', ...memories.map(formatMemorySearchResult)].join('\n')
}
function formatHygiene(items: MemoryHygieneItem[]): string {
  if (items.length === 0) return 'Memory hygiene: no cleanup needed'
  return ['Memory hygiene: needs cleanup', ...items.map(item => `- kind=${item.kind} memoryId=${item.memoryId}${item.relatedMemoryId ? ` relatedMemoryId=${item.relatedMemoryId}` : ''} reason=${JSON.stringify(item.reason)}`)].join('\n')
}


function formatLearnSummary(summary: MemoryLearnSummary): string {
  const lines = [
    `Memory learn summary: delegated to Memory Brain mode=${summary.mode} processed=${summary.processed} created=${summary.created.length} skipped=${summary.skipped}`,
    'The current chat agent receives bounded context and writes memory only when it finds durable facts.',
  ]
  if (summary.indexedSessions !== undefined) lines.push(`Indexed sessions: ${summary.indexedSessions}`)
  if (summary.pendingSessions !== undefined) lines.push(`Pending sessions: ${summary.pendingSessions}`)
  if (summary.created.length) lines.push(`Created ids: ${summary.created.map(memory => memory.id).join(',')}`)
  if (summary.reasons?.length) lines.push(`Reasons: ${summary.reasons.join('; ')}`)
  return lines.join('\n')
}

export async function executeMemoryCommand(command: string, fns: MemoryFns): Promise<ToolResult> {
  const trimmed = command.trim()
  const [rawVerb = '', ...rest] = trimmed.split(/\s+/)
  const verb = rawVerb.toLowerCase()
  try {
    if (!verb || verb === 'status') {
      const status = await fns.status()
      return success(`Memory: ${status.available ? 'available' : 'unavailable'}\nMemories: ${status.memories}${status.reason ? `\nReason: ${status.reason}` : ''}`)
    }
    if (verb === 'list') {
      const memories = await fns.list()
      return success(memories.length ? ['Memories:', ...memories.map(formatMemory)].join('\n') : 'Memories: none')
    }
    if (verb === 'show') {
      const memoryId = rest[0]
      if (!memoryId) return failure('show requires a memory id')
      const memory = await fns.show(memoryId)
      return success(memory ? formatMemory(memory) : `Memory not found: ${memoryId}`)
    }
    if (verb === 'search') {
      const query = rest.join(' ').trim()
      if (!query) return failure('search requires a query')
      return success(formatMemorySearchResults(await fns.search(query)))
    }
    if (verb === 'create') {
      const memory = await fns.create(parseJsonPayload<CreateMemoryInput>(trimmed.slice(rawVerb.length).trim(), 'create'))
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
    if (verb === 'delete') {
      const memoryId = rest[0]
      if (!memoryId) return failure('delete requires a memory id')
      await fns.delete(memoryId)
      return success(`Deleted memory ${memoryId}`)
    }
    if (verb === 'learn') {
      if (!fns.learn) return failure('learn is not available in this context')
      const target = rest.join(' ').trim()
      if (!target) return failure('learn requires target: current, recent, all, or session id')
      return success(formatLearnSummary(await fns.learn(target)))
    }
    return failure(`Unknown memory command: ${verb}`)
  } catch (error) {
    return failure(error instanceof Error ? error.message : String(error))
  }
}

export function createMemoryTool(options: { getMemoryFns: () => MemoryFns | undefined }) {
  return tool('memory', 'Manage persistent scoped workspace memory: retrieval, hygiene, updates, and deletion.', MemorySchema.shape, async (args) => {
    const fns = options.getMemoryFns()
    if (!fns) return failure('Memory controls are not available. This tool requires the desktop app.')
    return executeMemoryCommand(String(args.command ?? 'status'), fns)
  })
}
