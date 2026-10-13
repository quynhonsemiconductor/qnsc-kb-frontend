import { describe, expect, it } from 'vitest'
import {
  INLINE_IMAGE_CAP,
  INLINE_TABLE_CAP,
  selectInlineEvidence,
} from '../../src/lib/inline-evidence'
import type { Citation, EvidenceTable } from '../../src/types/ai'

const table = (overrides: Partial<EvidenceTable> = {}): EvidenceTable => ({
  columns: ['Year', 'Total'],
  rows: [['2026', '12']],
  ...overrides,
})

const citation = (overrides: Partial<Citation> = {}): Citation => ({
  article_id: 'article-1',
  title: 'Access guide',
  ...overrides,
})

const figure = (id: string, overrides: Partial<Citation> = {}) =>
  citation({ evidence_id: id, evidence_kind: 'page_visual', evidence_label: `Figure ${id}`, ...overrides })

describe('selecting inline evidence for one answer', () => {
  it('returns nothing when the answer cited no evidence', () => {
    expect(selectInlineEvidence(undefined).items).toEqual([])
    expect(selectInlineEvidence([]).items).toEqual([])
    expect(selectInlineEvidence([citation()]).items).toEqual([])
  })

  it('ignores plain retrieved text alongside real evidence', () => {
    const selection = selectInlineEvidence([citation(), figure('e1'), citation()])

    expect(selection.items.map(item => item.evidenceId)).toEqual(['e1'])
  })

  it('shows one figure once even when several chunks cite it', () => {
    const selection = selectInlineEvidence([figure('e1'), figure('e1'), figure('e1')])

    expect(selection.items).toHaveLength(1)
    expect(selection.hiddenImages).toBe(0)
  })

  it('keeps citation order rather than grouping by kind', () => {
    const selection = selectInlineEvidence([
      figure('img-1'),
      citation({ evidence_id: 'tbl-1', evidence_kind: 'table', evidence_table: table() }),
      figure('img-2'),
    ])

    expect(selection.items.map(item => item.evidenceId)).toEqual(['img-1', 'tbl-1', 'img-2'])
  })

  it('treats figure and page_visual alike as images', () => {
    const selection = selectInlineEvidence([
      figure('e1', { evidence_kind: 'figure' }),
      figure('e2', { evidence_kind: 'page_visual' }),
    ])

    expect(selection.items.every(item => item.type === 'image')).toBe(true)
  })

  it('carries the label, article and citation each item needs to render', () => {
    const source = figure('e1', { evidence_label: 'Login screen' })
    const [item] = selectInlineEvidence([source]).items

    expect(item).toMatchObject({
      type: 'image',
      evidenceId: 'e1',
      articleId: 'article-1',
      label: 'Login screen',
    })
    expect(item.citation).toBe(source)
  })

  it('falls back to the document title when evidence has no label', () => {
    const [item] = selectInlineEvidence([
      citation({ evidence_id: 'e1', evidence_kind: 'figure', title: 'Access guide' }),
    ]).items

    expect(item.label).toBe('Access guide')
  })

  it('caps images and reports how many it withheld', () => {
    const many = Array.from({ length: INLINE_IMAGE_CAP + 3 }, (_, index) => figure(`e${index}`))

    const selection = selectInlineEvidence(many)

    expect(selection.items).toHaveLength(INLINE_IMAGE_CAP)
    expect(selection.hiddenImages).toBe(3)
  })

  it('caps tables separately from images', () => {
    const items = [
      ...Array.from({ length: INLINE_TABLE_CAP + 2 }, (_, index) =>
        citation({ evidence_id: `t${index}`, evidence_kind: 'table', evidence_table: table() })),
      figure('img-1'),
    ]

    const selection = selectInlineEvidence(items)

    expect(selection.items.filter(item => item.type === 'table')).toHaveLength(INLINE_TABLE_CAP)
    expect(selection.items.filter(item => item.type === 'image')).toHaveLength(1)
    expect(selection.hiddenTables).toBe(2)
    expect(selection.hiddenImages).toBe(0)
  })

  it('honours explicit caps', () => {
    const selection = selectInlineEvidence(
      [figure('e1'), figure('e2'), figure('e3')],
      { imageCap: 1 },
    )

    expect(selection.items).toHaveLength(1)
    expect(selection.hiddenImages).toBe(2)
  })

  it('a cap of zero withholds everything and still counts it', () => {
    const selection = selectInlineEvidence([figure('e1'), figure('e2')], { imageCap: 0 })

    expect(selection.items).toEqual([])
    expect(selection.hiddenImages).toBe(2)
  })

  it.each([
    ['no columns', table({ columns: [] })],
    ['no rows', table({ rows: [] })],
    ['absent', undefined],
  ])('skips a table with %s instead of rendering an empty frame', (_label, value) => {
    const selection = selectInlineEvidence([
      citation({ evidence_id: 't1', evidence_kind: 'table', evidence_table: value }),
    ])

    expect(selection.items).toEqual([])
    // Nothing was withheld by a cap — there was nothing to draw.
    expect(selection.hiddenTables).toBe(0)
  })

  it('does not let an unrenderable table consume the cap', () => {
    const selection = selectInlineEvidence(
      [
        citation({ evidence_id: 't0', evidence_kind: 'table', evidence_table: table({ rows: [] }) }),
        citation({ evidence_id: 't1', evidence_kind: 'table', evidence_table: table() }),
      ],
      { tableCap: 1 },
    )

    expect(selection.items.map(item => item.evidenceId)).toEqual(['t1'])
  })
})
