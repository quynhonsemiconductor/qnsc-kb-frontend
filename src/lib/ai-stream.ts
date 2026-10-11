import type { AIStreamEvent, AnalyticsResult, Citation, EvidenceStatus } from '../types/ai'

export interface AIStreamHandlers {
  onToken: (content: string) => void
  onSources: (sources: Citation[]) => void
  onDone: (data: Record<string, any>) => void
  onAnalytics?: (results: AnalyticsResult[]) => void
  onEvidenceStatus?: (status: EvidenceStatus) => void
}

/** Dispatch one additive SSE payload without making an unknown event fatal. */
export function dispatchAIStreamPayload(payload: AIStreamEvent, handlers: AIStreamHandlers) {
  if (payload.type === 'token') handlers.onToken(payload.content || '')
  if (payload.type === 'replace') handlers.onToken(`\u0000REPLACE\u0000${payload.content || ''}`)
  if (payload.type === 'sources') handlers.onSources(payload.sources || [])
  if (payload.type === 'analytics') handlers.onAnalytics?.(payload.analytics_results || [])
  if (payload.type === 'evidence_status') handlers.onEvidenceStatus?.(payload.status || {
    stage: payload.stage,
    vision_used: payload.vision_used,
    fallback_reason: payload.fallback_reason,
  })
  if (payload.type === 'error') throw new Error(payload.detail || 'AI generation failed')
  if (payload.type === 'done') {
    if (payload.analytics_results) handlers.onAnalytics?.(payload.analytics_results)
    if (payload.evidence_status) handlers.onEvidenceStatus?.(payload.evidence_status)
    handlers.onDone(payload)
  }
}
