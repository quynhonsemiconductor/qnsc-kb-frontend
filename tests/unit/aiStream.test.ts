import { describe, expect, it, vi } from 'vitest'
import { dispatchAIStreamPayload } from '../../src/lib/ai-stream'
import type { AIStreamHandlers } from '../../src/lib/ai-stream'
import {
  buildAIAskPayload,
  collapseDuplicateFailedRetries,
  resetFailedMessageForRetry,
} from '../../src/lib/ai-retry'

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

  it('marks an explicit failed-turn retry in the request payload', () => {
    expect(buildAIAskPayload({
      question: 'Có bao nhiêu nội dung trong Luật PTDNNVV',
      conversationId: 'conversation-1',
      language: 'vi',
      retryFailed: true,
    })).toEqual(expect.objectContaining({
      conversation_id: 'conversation-1',
      retry_failed: true,
    }))
  })

  it('collapses repeated legacy failed attempts into one logical turn', () => {
    const question = 'Có bao nhiêu nội dung trong Luật PTDNNVV'
    const history = Array.from({ length: 5 }, (_, attempt) => [
      { role: 'user', content: question, attempt },
      { role: 'assistant', content: 'AI generation failed. Please try again.', failed: true, attempt },
    ]).flat()

    const collapsed = collapseDuplicateFailedRetries(history)

    expect(collapsed).toHaveLength(2)
    expect(collapsed[0]).toMatchObject({ role: 'user', content: question, attempt: 4 })
    expect(collapsed[1]).toMatchObject({ role: 'assistant', failed: true, attempt: 4 })
  })

  it('resets the same failed bubble instead of creating another message', () => {
    const failed = {
      id: 'assistant-1',
      text: 'AI generation failed. Please try again.',
      citations: [{ article_id: 'a1' }],
      failed: true,
      action: 'old-action',
      analyticsResults: [{ result: 'stale' }],
    }

    const reset = resetFailedMessageForRetry(failed, 'Retry this')

    expect(reset.id).toBe('assistant-1')
    expect(reset).toMatchObject({ text: '', citations: [], failed: false, retryQuestion: 'Retry this', analyticsResults: [] })
    expect(reset.action).toBeUndefined()
  })
})
