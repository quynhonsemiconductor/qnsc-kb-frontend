import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import AnswerText, { type AnswerEvidenceLabels } from '../../src/components/ai/AnswerText'
import type { Citation } from '../../src/types/ai'

// The API client reads localStorage when it is first imported; this suite runs without a DOM.
vi.hoisted(() => {
  const memory = new Map<string, string>()
  Object.assign(globalThis, {
    localStorage: {
      getItem: (key: string) => memory.get(key) ?? null,
      setItem: (key: string, value: string) => void memory.set(key, value),
      removeItem: (key: string) => void memory.delete(key),
    },
  })
})

/*
 * Rendered end to end, because the failure this pins was invisible to every unit test of
 * its parts: the anchor plugin wrote its property, react-markdown handed the component the
 * same value under a different name, and the component read the wrong one. The figure was
 * "claimed" by an anchor nobody rendered, so it appeared nowhere at all.
 */

const labels: AnswerEvidenceLabels = {
  moreImages: '{{count}} more', moreTables: '{{count}} more', tableRowSummary: '{{shown}}/{{total}}', unavailable: 'unavailable', open: 'open',
  openAtPage: 'Open at page {{page}}', zoom: 'Enlarge', download: 'Download', askPrompt: '{{label}} {{page}}', ask: 'Ask', zoomIn: 'in', zoomOut: 'out', fit: 'fit',
  close: 'Close', rowSummary: '{{shown}}/{{total}}', filter: 'Filter', copy: 'Copy', copied: 'Copied', csv: 'CSV', expand: 'Expand', showAll: 'Show all',
  loadingAll: 'Loading', loadFailed: 'Failed', noMatch: 'No match', sortBy: 'Sort by',
}

const table = { columns: ['Hạng mục', 'Số ảnh'], rows: [['Chó', '8'], ['Mèo', '43']] }

const citations: Citation[] = [
  { source_index: 1, article_id: 'a1', title: 'Sách', page_number: 55, page_evidence: [{ evidence_id: 'f1', kind: 'figure', label: 'Figure 1 on page 55', page_number: 55 }] },
  { source_index: 2, article_id: 'a1', title: 'Sách', page_number: 29, evidence_id: 't0', evidence_kind: 'table', evidence_label: 'Bảng 0', evidence_table: table },
  { source_index: 3, article_id: 'a1', title: 'Sách', page_number: 30, page_evidence: [{ evidence_id: 't1', kind: 'table', label: 'Bảng lỗi', page_number: 30, table }] },
]

const render = (content: string, evidence = true) =>
  renderToStaticMarkup(createElement(AnswerText, { content, citations, onCitationClick: () => undefined, evidence: evidence ? { labels } : undefined }))

describe('figures and tables inside the rendered answer', () => {
  it('places a figure on the cited page right after the paragraph that cites it', () => {
    const html = render('Đường cong giảm dần [C1].\n\nMột đoạn khác không có trích dẫn.')
    expect(html).toContain('Figure 1 on page 55')
    expect(html.indexOf('Figure 1 on page 55')).toBeGreaterThan(html.indexOf('Đường cong'))
    expect(html.indexOf('Figure 1 on page 55')).toBeLessThan(html.indexOf('Một đoạn khác'))
  })

  it('renders the table of a citation and the table on a cited page', () => {
    const html = render('Bảng 0 [C2].\n\nBảng lỗi [C3].')
    expect(html).toContain('aria-label="Bảng 0"')
    expect(html).toContain('aria-label="Bảng lỗi"')
    expect(html).toContain('Chó')
  })

  it('never leaks the anchor plumbing into the DOM', () => {
    expect(render('Đường cong giảm dần [C1].')).not.toMatch(/data-evidence-anchor|dataEvidenceAnchor/)
  })

  it('shows nothing while the answer is still streaming (no evidence prop)', () => {
    const html = render('Đường cong giảm dần [C1].', false)
    expect(html).not.toContain('Figure 1 on page 55')
    expect(html).not.toMatch(/data-evidence-anchor/)
  })

  it('shows an item cited from a list item and from a quote exactly once', () => {
    const html = render('- Một ý [C1]\n\n> Trích dẫn [C1]')
    expect(html.split('Figure 1 on page 55').length - 1).toBe(2) // alt/caption of the one figure
  })
})
