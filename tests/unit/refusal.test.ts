import { describe, expect, it } from 'vitest'
import { isRefusal, parseRelatedSources, refusalSentence } from '../../src/lib/refusal'

const message = (over: Partial<Parameters<typeof isRefusal>[0]> = {}) => ({ text: '', ...over })

describe('recognising a refusal', () => {
  it('trusts the server flag', () => {
    expect(isRefusal(message({ text: 'anything at all', refused: true }))).toBe(true)
  })

  it('recognises the Vietnamese wording of an older message, which the page used to miss', () => {
    expect(isRefusal(message({ text: 'Không tìm thấy trong Cơ sở Tri thức.' }))).toBe(true)
    expect(isRefusal(message({ text: 'Không tìm thấy thông tin trong cơ sở kiến thức của bạn.' }))).toBe(true)
  })

  it('recognises the English wording', () => {
    expect(isRefusal(message({ text: 'That is not found in the knowledge base.' }))).toBe(true)
    expect(isRefusal(message({ text: 'I could not find enough relevant information in the Knowledge Base.' }))).toBe(true)
  })

  it('is not fooled by an ordinary answer', () => {
    expect(isRefusal(message({ text: 'Thời hạn là ba mươi ngày [C1].' }))).toBe(false)
    expect(isRefusal(message({ text: 'Quy trình gồm ba bước.' }))).toBe(false)
  })

  it('never calls a cited answer or a failed turn a refusal, whatever it says or the flag says', () => {
    expect(isRefusal(message({ text: 'Không tìm thấy trong Cơ sở Tri thức.', citations: [{}] }))).toBe(false)
    expect(isRefusal(message({ text: 'x', refused: true, failed: true }))).toBe(false)
  })

  it('only reads the start of a long text for the wording', () => {
    expect(isRefusal(message({ text: `${'a'.repeat(500)} not found in the knowledge base` }))).toBe(false)
  })
})

describe('the refusal sentence', () => {
  it('uses the one the server kept apart', () => {
    expect(refusalSentence({ refusalText: ' Không tìm thấy. ', text: 'Không tìm thấy.\n\nMột đoạn...' })).toBe('Không tìm thấy.')
  })

  it('takes only the first paragraph of an older message that has a passage appended', () => {
    const text = 'Không tìm thấy trong Cơ sở Tri thức.\n\nMột đoạn có thể liên quan trong **Luật** (Section 4) — chưa được xác minh:\n\n> Dự thảo Luật quy định... Theo đó:'
    expect(refusalSentence({ text })).toBe('Không tìm thấy trong Cơ sở Tri thức.')
  })

  it('is the whole text when there is only one paragraph', () => {
    expect(refusalSentence({ text: '  Not found.  ' })).toBe('Not found.')
  })
})

describe('the nearest documents from the server', () => {
  it('keeps what the viewer needs, one per document, at most five', () => {
    const raw = Array.from({ length: 8 }, (_, i) => ({ article_id: `a${i}`, title: `Doc ${i}`, page_number: i, excerpt: 'x', source_url: '/s', section_ref: 'S' }))
    const parsed = parseRelatedSources([...raw, { article_id: 'a0', title: 'duplicate' }])
    expect(parsed).toHaveLength(5)
    expect(parsed[0]).toMatchObject({ article_id: 'a0', title: 'Doc 0', page_number: 0, source_url: '/s' })
  })

  it('falls back to the id for a missing title and drops entries without an article', () => {
    expect(parseRelatedSources([{ article_id: 'a1' }, { title: 'orphan' }, null, 'x', { article_id: '' }])).toEqual([
      expect.objectContaining({ article_id: 'a1', title: 'a1' }),
    ])
  })

  it('ignores anything that is not a list, and wrongly typed fields', () => {
    expect(parseRelatedSources(undefined)).toEqual([])
    expect(parseRelatedSources({ article_id: 'a' })).toEqual([])
    const [only] = parseRelatedSources([{ article_id: 'a', page_number: '3', excerpt: 5, source_url: null }])
    expect(only.page_number).toBeUndefined()
    expect(only.excerpt).toBeUndefined()
    expect(only.source_url).toBeUndefined()
  })
})
