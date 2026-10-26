import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import TableArtifactView from '../../src/components/ai/TableArtifactView'
import type { EvidenceTableLabels } from '../../src/components/ai/EvidenceTable'
import {
  MAX_TABLE_COLUMNS, MAX_TABLE_ROWS, STEP_ORDER, coverageText, parseArtifacts, parseCoverage, parseTable, stepText, upsertStep,
} from '../../src/lib/agent'
import type { AgentStep, TableArtifact } from '../../src/types/ai'

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

/** A translator that shows the key and its variables, so a test can see exactly what was asked for. */
const t = (key: string, vars?: Record<string, string | number>) => (vars && Object.keys(vars).length ? `${key} ${JSON.stringify(vars)}` : key)

const recent = {
  type: 'table',
  id: 'catalog-recent',
  title: 'Tài liệu cập nhật gần nhất',
  columns: ['Tên tài liệu', 'Loại', 'Số trang'],
  rows: [['Quy trình A', 'SOP', 12], ['Chính sách B', 'POLICY', 3], ['Hướng dẫn C', 'SOP', 40]],
  link_column: 0,
  row_links: [{ article_id: 'id-a' }, { article_id: 'id-b' }, { article_id: 'id-c' }],
  total_rows: 3,
  truncated: false,
}

describe('table artifacts', () => {
  it('reads a well-formed table, keeping numbers as numbers and the links with their rows', () => {
    const table = parseTable(recent) as TableArtifact

    expect(table.type).toBe('table')
    expect(table.columns).toEqual(['Tên tài liệu', 'Loại', 'Số trang'])
    expect(table.rows[0]).toEqual(['Quy trình A', 'SOP', 12])
    expect(table.link_column).toBe(0)
    expect(table.row_links).toEqual([{ article_id: 'id-a' }, { article_id: 'id-b' }, { article_id: 'id-c' }])
  })

  it('is accepted by parseArtifacts alongside charts, and malformed ones are dropped', () => {
    const parsed = parseArtifacts([recent, { type: 'table' }, { type: 'table', columns: [], rows: [[1]] }, { type: 'table', columns: ['a'], rows: [] }, null, 'x'])

    expect(parsed).toHaveLength(1)
    expect(parsed[0].type).toBe('table')
  })

  it('drops a malformed row together with its link, so no later link lands on the wrong row', () => {
    const table = parseTable({
      ...recent,
      rows: [['A', 'SOP', 1], 'garbage', ['C', 'SOP', 3]],
      row_links: [{ article_id: 'id-a' }, { article_id: 'id-garbage' }, { article_id: 'id-c' }],
    }) as TableArtifact

    expect(table.rows.map(row => row[0])).toEqual(['A', 'C'])
    expect(table.row_links).toEqual([{ article_id: 'id-a' }, { article_id: 'id-c' }])
  })

  it('has no links when the link column is out of range or the links are missing', () => {
    expect((parseTable({ ...recent, link_column: 9 }) as TableArtifact).row_links).toBeNull()
    expect((parseTable({ ...recent, link_column: -1 }) as TableArtifact).link_column).toBeNull()
    expect((parseTable({ ...recent, link_column: 1.5 }) as TableArtifact).link_column).toBeNull()
    expect((parseTable({ ...recent, row_links: null }) as TableArtifact).link_column).toBeNull()
    expect((parseTable({ ...recent, link_column: null }) as TableArtifact).row_links).toBeNull()
  })

  it('treats a link with no usable article id as no link rather than a link to nothing', () => {
    const table = parseTable({ ...recent, row_links: [{ article_id: 5 }, null, { article_id: 'id-c' }] }) as TableArtifact

    expect(table.row_links?.map(link => link.article_id)).toEqual(['', '', 'id-c'])
  })

  it('bounds the rows, the columns and each cell', () => {
    const wide = Array.from({ length: MAX_TABLE_COLUMNS + 5 }, (_, i) => `c${i}`)
    const rows = Array.from({ length: MAX_TABLE_ROWS + 50 }, (_, i) => wide.map(() => (i === 0 ? 'x'.repeat(2000) : i)))

    const table = parseTable({ type: 'table', columns: wide, rows, title: 't' }) as TableArtifact

    expect(table.columns).toHaveLength(MAX_TABLE_COLUMNS)
    expect(table.rows).toHaveLength(MAX_TABLE_ROWS)
    expect(table.rows[0][0]).toHaveLength(500)
    expect(table.rows[1]).toHaveLength(MAX_TABLE_COLUMNS)
  })

  it('pads short rows, and turns non-finite numbers and missing cells into empty ones', () => {
    const table = parseTable({ type: 'table', columns: ['a', 'b', 'c'], rows: [[1, null], [Infinity, undefined, 'x']] }) as TableArtifact

    expect(table.rows).toEqual([[1, null, null], [null, null, 'x']])
  })

  it('only claims a total that is at least the rows it has', () => {
    expect((parseTable({ ...recent, total_rows: 1 }) as TableArtifact).total_rows).toBeUndefined()
    expect((parseTable({ ...recent, total_rows: 250 }) as TableArtifact).total_rows).toBe(250)
  })
})

const labels: EvidenceTableLabels = {
  rowSummary: '{{shown}}/{{total}}', filter: 'Filter', copy: 'Copy', copied: 'Copied', csv: 'CSV', expand: 'Expand', close: 'Close',
  showAll: 'Show all', loadingAll: 'Loading', loadFailed: 'Failed', noMatch: 'No match', sortBy: 'Sort by', ask: 'Ask',
}

const render = (artifact: TableArtifact) =>
  renderToStaticMarkup(createElement(MemoryRouter, null, createElement(TableArtifactView, { artifact, labels })))

describe('TableArtifactView', () => {
  it('shows the title and every row, with the link column opening each row\'s own document', () => {
    const html = render(parseTable(recent) as TableArtifact)

    expect(html).toContain('Tài liệu cập nhật gần nhất')
    for (const [text, id] of [['Quy trình A', 'id-a'], ['Chính sách B', 'id-b'], ['Hướng dẫn C', 'id-c']]) {
      expect(html).toContain(`href="/articles/${id}"`)
      expect(html).toMatch(new RegExp(`href="/articles/${id}"[^>]*>${text}</a>`))
    }
  })

  it('links only the link column', () => {
    const html = render(parseTable(recent) as TableArtifact)

    expect(html.match(/href="\/articles\//g)).toHaveLength(3)
    expect(html).toContain('>SOP</td>')
    expect(html).toContain('>12</td>')
  })

  it('renders plain text when there are no links, and never makes a link from a title', () => {
    const html = render(parseTable({ ...recent, link_column: null, row_links: null }) as TableArtifact)

    expect(html).not.toContain('href="/articles/')
    expect(html).toContain('>Quy trình A</td>')
  })

  it('does not link a row whose document is unknown, and encodes the id it does link', () => {
    const html = render(parseTable({ ...recent, row_links: [{ article_id: '' }, { article_id: 'a/b c' }, {}] }) as TableArtifact)

    expect(html.match(/href="\/articles\//g)).toHaveLength(1)
    expect(html).toContain('href="/articles/a%2Fb%20c"')
  })

  it('shows a title with markup as text, not as markup', () => {
    const html = render(parseTable({ ...recent, title: '<img src=x onerror=alert(1)>' }) as TableArtifact)

    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;img src=x')
  })

  it('keeps the interactive tools of an evidence table', () => {
    const html = render(parseTable(recent) as TableArtifact)

    expect(html).toContain('type="search"')
    expect(html).toContain('CSV')
    expect(html).toContain('Expand')
  })
})

describe('agent steps for collection and corpus questions', () => {
  it('orders them: understand, then catalog or digests, then synthesize, before searching and answering', () => {
    const order = [...STEP_ORDER]

    expect(order.indexOf('understand')).toBeLessThan(order.indexOf('catalog'))
    expect(order.indexOf('digests')).toBeLessThan(order.indexOf('synthesize'))
    expect(order.indexOf('synthesize')).toBeLessThan(order.indexOf('answer'))
    const folded = [{ step: 'answer', status: 'running' }, { step: 'digests', status: 'done' }, { step: 'understand', status: 'done' }] as AgentStep[]
    expect(folded.reduce(upsertStep, [] as AgentStep[]).map(step => step.step)).toEqual(['understand', 'digests', 'answer'])
  })

  it('says what each step did', () => {
    const done = (step: string, data: Record<string, unknown> = {}): AgentStep => ({ step, status: 'done', data })

    expect(stepText(t, done('catalog', { total: 42 }))).toBe('agent.step.catalog.done {"total":42}')
    expect(stepText(t, done('digests', { total: 40, with_digest: 31 }))).toBe('agent.step.digests.done {"with_digest":31,"total":40}')
    expect(stepText(t, done('synthesize', { used: 12, calls: 3 }))).toBe('agent.step.synthesize.done {"used":12,"calls":3}')
    expect(stepText(t, done('synthesize', { used: 12, cache_hit: true }))).toBe('agent.step.synthesize.cached {"used":12}')
  })

  it('says why a step was skipped, falling back to the general wording', () => {
    const skipped = (step: string, detail?: string): AgentStep => ({ step, status: 'skipped', detail })
    const translate = (key: string) => (key.endsWith('.no_digests') ? 'no summaries' : key)

    expect(stepText(translate, skipped('digests', 'no_digests'))).toBe('no summaries')
    expect(stepText(translate, skipped('digests', 'whatever'))).toBe('agent.step.digests.skipped')
    expect(stepText(translate, { step: 'understand', status: 'skipped', detail: 'catalog' })).toBe('agent.step.understand.skipped')
  })
})

describe('coverage', () => {
  it('reads what the server sent and refuses what is not a count', () => {
    expect(parseCoverage({ total: 40, with_digest: 30, considered: 30, used: 12, partial: true, reason: 'budget' }))
      .toEqual({ total: 40, with_digest: 30, considered: 30, used: 12, partial: true, reason: 'budget' })
    expect(parseCoverage(undefined)).toBeUndefined()
    expect(parseCoverage(null)).toBeUndefined()
    expect(parseCoverage('x')).toBeUndefined()
    expect(parseCoverage({ total: 'a', used: 1 })).toBeUndefined()
    expect(parseCoverage({ total: 5, used: -1 })).toBeUndefined()
    expect(parseCoverage({ total: 5 })).toBeUndefined()
  })

  it('fills the optional counts sensibly and floors fractional ones', () => {
    expect(parseCoverage({ total: 5.9, used: 3 })).toEqual({ total: 5, with_digest: 0, considered: 3, used: 3, partial: false, reason: '' })
  })

  it('says only what was used when the whole collection was read', () => {
    expect(coverageText(t, { total: 6, with_digest: 6, considered: 6, used: 6, partial: false, reason: '' }))
      .toEqual({ summary: 'chat.coverage.summary {"used":6,"total":6}', note: null })
  })

  it.each([
    ['missing_digests', 'chat.coverage.missingDigests {"missing":10}'],
    ['ceiling', 'chat.coverage.ceiling {"considered":30}'],
    ['budget', 'chat.coverage.budget'],
    ['map_failed', 'chat.coverage.mapFailed'],
  ])('explains a partial answer: %s', (reason, note) => {
    const text = coverageText(t, { total: 40, with_digest: 30, considered: 30, used: 12, partial: true, reason })

    expect(text.note).toBe(note)
    expect(text.summary).toBe('chat.coverage.summary {"used":12,"total":40}')
  })

  it('does not invent a reason for a partial answer it has no words for', () => {
    expect(coverageText(t, { total: 40, with_digest: 30, considered: 30, used: 12, partial: true, reason: 'new_reason' }).note).toBeNull()
  })
})
