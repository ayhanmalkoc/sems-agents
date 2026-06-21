export const DEFAULT_CONTEXT_WINDOW = 262_144

export function resolveContextWindow(contextWindow?: number | null): number {
  return Number.isFinite(contextWindow) && Number(contextWindow) > 0 ? Number(contextWindow) : DEFAULT_CONTEXT_WINDOW
}

export function getContextFillRatio(inputTokens?: number | null, contextWindow?: number | null): number {
  const tokens = Number.isFinite(inputTokens) && Number(inputTokens) > 0 ? Number(inputTokens) : 0
  return Math.min(1, tokens / resolveContextWindow(contextWindow))
}

export function getContextFillPercent(inputTokens?: number | null, contextWindow?: number | null): number {
  return Math.min(100, Math.max(0, Math.round(getContextFillRatio(inputTokens, contextWindow) * 100)))
}
