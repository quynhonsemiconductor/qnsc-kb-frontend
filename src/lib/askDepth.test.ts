import { describe, expect, it } from 'vitest'
import { buildAIAskPayload } from './ai-retry'

describe('buildAIAskPayload depth', () => {
  it('sends nothing for the default, so the server default applies', () => {
    expect(buildAIAskPayload({ question: 'q', language: 'en' }).depth).toBeUndefined()
    expect(buildAIAskPayload({ question: 'q', language: 'en', depth: 'standard' }).depth).toBeUndefined()
  })

  it('sends a different choice as it is', () => {
    expect(buildAIAskPayload({ question: 'q', language: 'en', depth: 'quick' }).depth).toBe('quick')
    expect(buildAIAskPayload({ question: 'q', language: 'en', depth: 'thorough' }).depth).toBe('thorough')
  })
})
