import { describe, expect, it, vi } from 'vitest'
import { dispatchAIStreamPayload } from '../../src/lib/ai-stream'
import type { AIStreamHandlers } from '../../src/lib/ai-stream'

const handlers = (): AIStreamHandlers => ({
  onToken: vi.fn(),
  onSources: vi.fn(),
  onDone: vi.fn(),
  onAnalytics: vi.fn(),
  onEvidenceStatus: vi.fn(),
})

describe('AI stream additions', () => {
  it('keeps token, source and done events backward-compatible', () => {
    const callbacks = handlers()
    dispatchAIStreamPayload({ type: 'token', content: 'A' }, callbacks)
    dispatchAIStreamPayload({ type: 'sources', sources: [{ article_id: 'a1', title: 'Policy' }] }, callbacks)
    dispatchAIStreamPayload({ type: 'done', answer_grounded: 'A [C1]' }, callbacks)

    expect(callbacks.onToken).toHaveBeenCalledWith('A')
    expect(callbacks.onSources).toHaveBeenCalledWith([{ article_id: 'a1', title: 'Policy' }])
    expect(callbacks.onDone).toHaveBeenCalledWith(expect.objectContaining({ type: 'done' }))
  })

  it('dispatches evidence progress and deterministic analytics metadata', () => {
    const callbacks = handlers()
    const result = {
      operation: 'average' as const,
      result: '12.5',
      formula: '(10 + 15) / 2',
      source_id: 'C1',
      evidence_id: 'e1',
    }
    dispatchAIStreamPayload({ type: 'evidence_status', stage: 'calculating', vision_used: false }, callbacks)
    dispatchAIStreamPayload({ type: 'analytics', analytics_results: [result] }, callbacks)

    expect(callbacks.onEvidenceStatus).toHaveBeenCalledWith(expect.objectContaining({ stage: 'calculating', vision_used: false }))
    expect(callbacks.onAnalytics).toHaveBeenCalledWith([result])
  })

  it('throws an actionable stream error and ignores unknown event shapes', () => {
    const callbacks = handlers()
    expect(() => dispatchAIStreamPayload({ type: 'future_event' } as never, callbacks)).not.toThrow()
    expect(() => dispatchAIStreamPayload({ type: 'error', detail: 'Provider unavailable' }, callbacks)).toThrow('Provider unavailable')
  })
})
