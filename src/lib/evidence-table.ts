import type { EvidenceTable } from '../types/ai'

/**
 * What a reader can do with a table shown inside an answer: sort it, filter it, copy it,
 * take it away. Pure, so the behaviour that decides what ends up in a spreadsheet is tested.
 */

type Cell = string | number | null | undefined
export type SortDirection = 'asc' | 'desc'

export function cellText(value: Cell): string {
  return value === null || value === undefined ? '' : String(value)
}

/**
 * A number out of a cell, or null. Reads "1,234.5", "1.234,5", "12%", "(5)" and "-3" the way
 * a person would; anything with other text in it is not a number, so a code like "A-12" or
 * a date is compared as text instead of being half-parsed.
 */
export function parseCellNumber(value: Cell): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null
  let text = cellText(value).trim()
  if (!text) return null
  let negative = false
  if (/^\(.*\)$/.test(text)) {
    negative = true
    text = text.slice(1, -1).trim()
  }
  text = text.replace(/%$/, '').trim()
  if (!/^[-+]?\d[\d.,\s]*$/.test(text)) return null
  text = text.replace(/\s/g, '')
  const lastComma = text.lastIndexOf(',')
  const lastDot = text.lastIndexOf('.')
  if (lastComma >= 0 && lastDot >= 0) {
    // Both present: the later one is the decimal mark, the other groups thousands.
    text = lastComma > lastDot ? text.replace(/\./g, '').replace(',', '.') : text.replace(/,/g, '')
  } else if (lastComma >= 0) {
    // One comma: a decimal mark unless it groups exactly three digits ("1,234").
    text = /^[-+]?\d{1,3}(,\d{3})+$/.test(text) ? text.replace(/,/g, '') : text.replace(',', '.')
  } else if ((text.match(/\./g) || []).length > 1) {
    text = text.replace(/\./g, '')
  }
  const parsed = Number(text)
  if (!Number.isFinite(parsed)) return null
  return negative ? -parsed : parsed
}

/** Rows ordered by one column; numbers by value when the whole column is numeric, else text. Stable. */
export function sortRows<R extends ReadonlyArray<Cell>>(
  rows: R[],
  column: number,
  direction: SortDirection,
): R[] {
  const filled = rows.filter(row => cellText(row[column]).trim() !== '')
  const numeric = filled.length > 0 && filled.every(row => parseCellNumber(row[column]) !== null)
  const factor = direction === 'asc' ? 1 : -1
  return rows
    .map((row, index) => ({ row, index }))
    .sort((left, right) => {
      const a = left.row[column]
      const b = right.row[column]
      const aEmpty = cellText(a).trim() === ''
      const bEmpty = cellText(b).trim() === ''
      // Empty cells go last in either direction: they are missing data, not the smallest value.
      if (aEmpty || bEmpty) return aEmpty === bEmpty ? left.index - right.index : aEmpty ? 1 : -1
      const order = numeric
        ? (parseCellNumber(a) as number) - (parseCellNumber(b) as number)
        : cellText(a).localeCompare(cellText(b), undefined, { numeric: true, sensitivity: 'base' })
      return order !== 0 ? order * factor : left.index - right.index
    })
    .map(entry => entry.row)
}

/** Rows with any cell containing the query, ignoring case and Vietnamese diacritics. */
export function filterRows<R extends ReadonlyArray<Cell>>(rows: R[], query: string): R[] {
  const needle = fold(query)
  if (!needle) return rows
  return rows.filter(row => row.some(cell => fold(cellText(cell)).includes(needle)))
}

function fold(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .trim()
}

/** Tab-separated, for pasting into a spreadsheet. Tabs and newlines inside a cell become spaces. */
export function tableToTsv(table: Pick<EvidenceTable, 'columns' | 'rows'>): string {
  const clean = (value: Cell) => cellText(value).replace(/[\t\r\n]+/g, ' ')
  return [table.columns.map(clean).join('\t'), ...table.rows.map(row => table.columns.map((_, i) => clean(row[i])).join('\t'))].join('\n')
}

/**
 * A cell that a spreadsheet would run as a formula. Text starting with = + @ (or a tab or
 * return) is executed by Excel; "-" only when what follows is not a plain number, so a
 * negative value stays a number.
 */
function isFormulaLike(text: string): boolean {
  if (/^[=+@\t\r]/.test(text)) return !/^\+?\d[\d.,]*$/.test(text)
  return /^-/.test(text) && parseCellNumber(text) === null
}

const BOM = String.fromCharCode(0xfeff)

function csvField(value: Cell): string {
  let text = cellText(value)
  // Tables come from uploaded documents, so a cell is untrusted: neutralise a formula
  // before it reaches a spreadsheet, without touching ordinary numbers.
  if (isFormulaLike(text)) text = `'${text}`
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text
}

/** RFC 4180 CSV with a byte-order mark so Excel reads the Vietnamese text as UTF-8. */
export function tableToCsv(table: Pick<EvidenceTable, 'columns' | 'rows'>): string {
  const lines = [table.columns.map(csvField).join(','), ...table.rows.map(row => table.columns.map((_, i) => csvField(row[i])).join(','))]
  return `${BOM}${lines.join('\r\n')}\r\n`
}

/** A file name from a label: letters and digits kept (Vietnamese included), the rest a dash. */
export function safeFileName(label: string, extension: string): string {
  const base = label.normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-+|-+$/g, '').slice(0, 60)
  return `${base || 'table'}.${extension}`
}
