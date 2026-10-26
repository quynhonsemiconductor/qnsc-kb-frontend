import { describe, expect, it } from 'vitest'
import { filterRows, parseCellNumber, safeFileName, sortRows, tableToCsv, tableToTsv } from '../../src/lib/evidence-table'
import { anchorInlineEvidence, evidenceUnits, selectInlineEvidence } from '../../src/lib/inline-evidence'
import type { Citation } from '../../src/types/ai'

describe('parseCellNumber', () => {
  it('reads numbers the way a person writes them', () => {
    expect(parseCellNumber('1,234.5')).toBe(1234.5)
    expect(parseCellNumber('1.234,5')).toBe(1234.5)
    expect(parseCellNumber('1,234')).toBe(1234)
    expect(parseCellNumber('12,5')).toBe(12.5)
    expect(parseCellNumber('12%')).toBe(12)
    expect(parseCellNumber('(5)')).toBe(-5)
    expect(parseCellNumber('-3')).toBe(-3)
    expect(parseCellNumber(7)).toBe(7)
  })
  it('does not half-parse text, codes or dates', () => {
    for (const value of ['A-12', '12 kg', '2026-01-05', 'n/a', '', null, undefined]) expect(parseCellNumber(value)).toBeNull()
  })
})

describe('sortRows', () => {
  const rows = [['b', '10'], ['a', '9'], ['c', ''], ['d', '100']]
  it('orders a numeric column by value, not by text', () => {
    expect(sortRows(rows, 1, 'asc').map(r => r[1])).toEqual(['9', '10', '100', ''])
    expect(sortRows(rows, 1, 'desc').map(r => r[1])).toEqual(['100', '10', '9', ''])
  })
  it('keeps empty cells last in either direction', () => {
    expect(sortRows(rows, 1, 'desc').at(-1)?.[0]).toBe('c')
  })
  it('orders a text column naturally and is stable on ties', () => {
    const text = [['item 10', 'x'], ['item 2', 'y'], ['item 2', 'z']]
    expect(sortRows(text, 0, 'asc').map(r => r[1])).toEqual(['y', 'z', 'x'])
  })
  it('does not mutate its input', () => {
    const copy = rows.map(r => [...r])
    sortRows(rows, 1, 'asc')
    expect(rows).toEqual(copy)
  })
})

describe('filterRows', () => {
  const rows = [['Đồ thị', '1'], ['Bảng lỗi', '2']]
  it('ignores case and Vietnamese diacritics', () => {
    expect(filterRows(rows, 'do thi')).toHaveLength(1)
    expect(filterRows(rows, 'BANG LOI')).toHaveLength(1)
    expect(filterRows(rows, 'ĐỒ')).toHaveLength(1)
  })
  it('returns every row for an empty query', () => {
    expect(filterRows(rows, '  ')).toBe(rows)
  })
})

describe('export', () => {
  const table = { columns: ['Tên', 'Giá'], rows: [['a, "b"', '1,5'], ['=SUM(A1)', '-3'], ['-cmd', '+84 90']] }
  it('writes TSV with tabs and newlines inside a cell flattened', () => {
    expect(tableToTsv({ columns: ['a'], rows: [['x\ty\nz']] })).toBe('a\nx y z')
  })
  it('writes RFC 4180 CSV with a BOM and quoting', () => {
    const csv = tableToCsv(table)
    expect(csv.startsWith(String.fromCharCode(0xfeff))).toBe(true)
    expect(csv).toContain('"a, ""b""","1,5"')
  })
  it('neutralises spreadsheet formulas but leaves negative numbers alone', () => {
    const csv = tableToCsv(table)
    expect(csv).toContain("'=SUM(A1)")
    expect(csv).toContain("'-cmd")
    expect(csv).toContain(',-3\r\n')
    expect(csv).toContain("'+84 90")
  })
  it('makes a safe file name, keeping Vietnamese letters', () => {
    expect(safeFileName('Bảng 1: Lỗi / ảnh mờ', 'csv')).toBe('Bảng-1-Lỗi-ảnh-mờ.csv')
    expect(safeFileName('///', 'csv')).toBe('table.csv')
  })
})

describe('evidence on the cited page', () => {
  const citation: Citation = {
    source_index: 1,
    article_id: 'a1',
    title: 'Sách',
    page_number: 55,
    highlight_text: 'đoạn văn',
    page_evidence: [
      { evidence_id: 'f1', kind: 'figure', label: 'Figure 1 on page 55', page_number: 55, preview_url: '/p/f1' },
      { evidence_id: 't1', kind: 'table', label: 'Table 1', page_number: 55, table: { columns: ['a'], rows: [['1']] } },
    ],
  }
  it('turns each page figure or table into a citation of its own', () => {
    const units = evidenceUnits(citation)
    expect(units.map(u => u.evidence_id)).toEqual(['f1', 't1'])
    expect(units[0]).toMatchObject({ article_id: 'a1', evidence_kind: 'figure', page_number: 55, highlight_text: 'đoạn văn' })
    expect(units[0].page_evidence).toBeUndefined()
  })
  it("keeps the citation's own evidence first", () => {
    const own = { ...citation, evidence_id: 'own', evidence_kind: 'figure' as const }
    expect(evidenceUnits(own).map(u => u.evidence_id)).toEqual(['own', 'f1', 't1'])
  })
  it('ignores malformed page evidence', () => {
    expect(evidenceUnits({ ...citation, page_evidence: [{} as never, null as never] })).toEqual([])
  })
  it('selects them for the answer, tables and figures counted separately', () => {
    const { items } = selectInlineEvidence([citation])
    expect(items.map(i => `${i.type}:${i.evidenceId}`)).toEqual(['image:f1', 'table:t1'])
  })
  it('anchors them at the marker that cites their page', () => {
    const { anchors, trailing } = anchorInlineEvidence('Đường cong sai số giảm dần [C1].', [citation])
    expect(trailing).toEqual([])
    expect(anchors).toHaveLength(1)
    expect(anchors[0].items.map(i => i.evidenceId)).toEqual(['f1', 't1'])
  })
  it('shows an item once even when two citations reach it', () => {
    const second = { ...citation, source_index: 2 }
    const { anchors } = anchorInlineEvidence('A [C1]. B [C2].', [citation, second])
    expect(anchors.flatMap(a => a.items).map(i => i.evidenceId)).toEqual(['f1', 't1'])
  })
})
