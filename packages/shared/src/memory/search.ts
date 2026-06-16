import type { MemoryRecord } from './types.ts'

function haystack(memory: MemoryRecord): string {
  return [memory.id, memory.title, memory.content, memory.type, memory.scope, ...(memory.tags ?? []), memory.agentProfileId, memory.sessionId, memory.sourceSessionId]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
}

export function searchMemories(memories: MemoryRecord[], query: string): MemoryRecord[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean)
  if (terms.length === 0) return memories
  return memories
    .map(memory => {
      const text = haystack(memory)
      const title = memory.title.toLowerCase()
      let score = 0
      for (const term of terms) {
        if (title.includes(term)) score += 4
        if (text.includes(term)) score += 1
      }
      return { memory, score }
    })
    .filter(item => item.score > 0)
    .sort((a, b) => b.score - a.score || b.memory.createdAt.localeCompare(a.memory.createdAt))
    .map(item => item.memory)
}
