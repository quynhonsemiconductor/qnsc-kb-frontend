import { describe, expect, it } from 'vitest'
import { buildAIAskPayload } from './ai-retry'

describe('buildAIAskPayload sources', () => {
  it('sends nothing for the default, so the server setting decides', () => {
    expect(buildAIAskPayload({ question: 'q', language: 'en' }).sources).toBeUndefined()
    expect(buildAIAskPayload({ question: 'q', language: 'en', sources: 'default' }).sources).toBeUndefined()
  })

  it('sends an explicit choice as it is', () => {
    expect(buildAIAskPayload({ question: 'q', language: 'en', sources: 'documents' }).sources).toBe('documents')
    expect(buildAIAskPayload({ question: 'q', language: 'en', sources: 'all' }).sources).toBe('all')
  })

  it('does not disturb the other options', () => {
    const payload = buildAIAskPayload({ question: 'q', language: 'vi', depth: 'quick', sources: 'documents' })
    expect(payload).toMatchObject({ question: 'q', language: 'vi', depth: 'quick', sources: 'documents' })
  })
})
