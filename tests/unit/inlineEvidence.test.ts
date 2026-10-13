import { describe, expect, it } from 'vitest'
import {
  anchorInlineEvidence,
  citationMarkers,
  findCitationByMarker,
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

describe('anchoring inline evidence to the citing block', () => {
  it('anchors each figure at the marker that cites it', () => {
    const answer = 'Login works [C1]. Export differs [C2].'
    const result = anchorInlineEvidence(answer, [
      figure('img-1', { source_index: 1 }),
      figure('img-2', { source_index: 2 }),
    ])

    expect(result.anchors.map(anchor => anchor.offset)).toEqual([
      answer.indexOf('[C1]'),
      answer.indexOf('[C2]'),
    ])
    expect(result.anchors.map(anchor => anchor.items.map(item => item.evidenceId))).toEqual([
      ['img-1'], ['img-2'],
    ])
    expect(result.trailing).toEqual([])
  })

  it('anchors at the FIRST marker when one figure is cited repeatedly', () => {
    const answer = 'Intro [C1]. Restated later [C1]. Also here [C1].'
    const result = anchorInlineEvidence(answer, [figure('img-1', { source_index: 1 })])

    expect(result.anchors).toHaveLength(1)
    expect(result.anchors[0].offset).toBe(answer.indexOf('[C1]'))
  })

  it('keeps two figures cited side by side in citation order', () => {
    const result = anchorInlineEvidence('Both shown [C1][C2].', [
      figure('img-1', { source_index: 1 }),
      figure('img-2', { source_index: 2 }),
    ])

    expect(result.anchors.flatMap(anchor => anchor.items.map(item => item.evidenceId)))
      .toEqual(['img-1', 'img-2'])
  })

  it('anchors tables and figures each at their own marker', () => {
    const result = anchorInlineEvidence('Totals [C1] and the screen [C2].', [
      citation({ source_index: 1, evidence_id: 'tbl-1', evidence_kind: 'table', evidence_table: table() }),
      figure('img-1', { source_index: 2 }),
    ])

    expect(result.anchors.map(anchor => anchor.items[0].type)).toEqual(['table', 'image'])
  })

  it('trails evidence when the answer carries no markers at all', () => {
    const result = anchorInlineEvidence('No markers here.', [figure('img-1', { source_index: 1 })])

    expect(result.anchors).toEqual([])
    expect(result.trailing.map(item => item.evidenceId)).toEqual(['img-1'])
  })

  it('trails only the evidence no marker claimed', () => {
    const result = anchorInlineEvidence('Only the first is cited [C1].', [
      figure('img-1', { source_index: 1 }),
      figure('img-2', { source_index: 2 }),
    ])

    expect(result.anchors.flatMap(anchor => anchor.items.map(item => item.evidenceId))).toEqual(['img-1'])
    expect(result.trailing.map(item => item.evidenceId)).toEqual(['img-2'])
  })

  it('never anchors evidence a cap withheld', () => {
    const result = anchorInlineEvidence(
      'One [C1]. Two [C2]. Three [C3].',
      [
        figure('img-1', { source_index: 1 }),
        figure('img-2', { source_index: 2 }),
        figure('img-3', { source_index: 3 }),
      ],
      { imageCap: 1 },
    )

    const shown = [
      ...result.anchors.flatMap(anchor => anchor.items.map(item => item.evidenceId)),
      ...result.trailing.map(item => item.evidenceId),
    ]
    expect(shown).toEqual(['img-1'])
    expect(result.hiddenImages).toBe(2)
  })

  it('ignores a marker whose citation carries no evidence', () => {
    const result = anchorInlineEvidence('Plain source [C1]. Figure [C2].', [
      citation({ source_index: 1 }),
      figure('img-1', { source_index: 2 }),
    ])

    expect(result.anchors).toHaveLength(1)
    expect(result.anchors[0].items.map(item => item.evidenceId)).toEqual(['img-1'])
  })

  it('reads older numeric and Source ID marker spellings', () => {
    expect(citationMarkers('a [1] b [Source ID: C2] c [C3]').map(marker => marker.number))
      .toEqual([1, 2, 3])
  })

  it('resolves markers positionally only when no citation carries an index', () => {
    const indexed = [figure('img-1', { source_index: 2 })]
    // An indexed set must not fall back: [1] names no citation here, and guessing would
    // put a figure beside a claim that cites something else.
    expect(findCitationByMarker(indexed, 1)).toBeUndefined()
    expect(findCitationByMarker(indexed, 2)?.evidence_id).toBe('img-1')

    const legacy = [figure('img-a'), figure('img-b')]
    expect(findCitationByMarker(legacy, 2)?.evidence_id).toBe('img-b')
  })

  it('has nothing to anchor when the answer cited no evidence', () => {
    expect(anchorInlineEvidence('Text [C1].', [citation({ source_index: 1 })]))
      .toMatchObject({ anchors: [], trailing: [], hiddenImages: 0, hiddenTables: 0 })
  })
})
