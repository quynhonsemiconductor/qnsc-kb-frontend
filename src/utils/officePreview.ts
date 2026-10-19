/**
 * Rules for previewing the formats a browser will not show by itself: Word, Excel,
 * PowerPoint, TIFF and BMP.
 *
 * The API serves all of them as `application/octet-stream; attachment` (they are not on the
 * inline allow-list in `sourcePreview.ts`, deliberately: a browser asked to open these would
 * hand them to another program). The review pane therefore got the bytes and could only offer
 * a download. These functions are the parts of drawing them in the page that can be tested
 * without a browser: telling the formats apart, and turning a spreadsheet into HTML that
 * cannot carry anything but text.
 *
 * Nothing here runs a document's content. The documents are untrusted uploads, so the HTML
 * built here is only ever shown in a sandboxed `<iframe>` (see OfficePreview.tsx), and every
 * cell value is escaped on the way in.
 */

/** Every format the review pane can draw itself. (The name predates TIFF and BMP joining Office.) */
export type OfficeKind = 'docx' | 'xlsx' | 'pptx' | 'tiff' | 'bmp'
export type RenderableOfficeKind = OfficeKind

const KIND_BY_EXTENSION: Record<string, OfficeKind> = {
  docx: 'docx',
  xlsx: 'xlsx',
  // Macro-enabled workbooks are the same package. Nothing is executed, so the macros are
  // simply not there in the preview.
  xlsm: 'xlsx',
  pptx: 'pptx',
  tif: 'tiff',
  tiff: 'tiff',
  bmp: 'bmp',
}

/** The kind a file name says it is, or null when the name says nothing usable. */
export function officeKindFromName(name?: string | null): OfficeKind | null {
  const match = /\.([A-Za-z0-9]+)$/.exec(String(name ?? '').trim())
  return match ? (KIND_BY_EXTENSION[match[1].toLowerCase()] ?? null) : null
}

/** Whether the pane can draw it: every kind it recognises. */
export function isRenderableOffice(kind: OfficeKind | null | undefined): kind is RenderableOfficeKind {
  return kind === 'docx' || kind === 'xlsx' || kind === 'pptx' || kind === 'tiff' || kind === 'bmp'
}

/**
 * How much of the end of the file is searched for the package's entry names.
 *
 * A zip lists every entry in its central directory, which sits at the END of the file, so the
 * tail is enough however large the archive is. 4 MB holds the directory of tens of thousands
 * of entries.
 */
const SNIFF_WINDOW_BYTES = 4 * 1024 * 1024

const ENTRY_NAMES: ReadonlyArray<readonly [OfficeKind, string]> = [
  ['docx', 'word/document.xml'],
  ['xlsx', 'xl/workbook.xml'],
  ['pptx', 'ppt/presentation.xml'],
]

/**
 * Tell the formats apart by what is inside, for files whose name does not say.
 *
 * A connector import is referenced as `sharepoint://drive/item-id`, with no extension, so the
 * name alone would leave exactly those files undetected. An OOXML file is a zip whose entry
 * names are stored in the clear, and each format has one entry no other has; TIFF and BMP
 * start with a fixed signature.
 *
 * Returns null for anything else, including a zip of something else.
 */
export function sniffOfficeKind(bytes: Uint8Array): OfficeKind | null {
  const startsWith = (...signature: number[]) =>
    bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value)
  // TIFF: "II*" then a zero byte (little-endian), or a zero byte then "MM*" order (big-endian).
  if (startsWith(0x49, 0x49, 0x2a, 0x00) || startsWith(0x4d, 0x4d, 0x00, 0x2a)) return 'tiff'
  // BMP: "BM", then a size, then two reserved fields that are always zero (which is what
  // keeps a text file that merely begins with "BM" from being taken for one).
  if (startsWith(0x42, 0x4d) && bytes.length >= 14 && bytes[6] === 0 && bytes[7] === 0 && bytes[8] === 0 && bytes[9] === 0) {
    return 'bmp'
  }
  if (!startsWith(0x50, 0x4b, 0x03, 0x04)) return null
  const tail = bytes.subarray(Math.max(0, bytes.length - SNIFF_WINDOW_BYTES))
  const text = new TextDecoder('latin1').decode(tail)
  for (const [kind, entry] of ENTRY_NAMES) {
    if (text.includes(entry)) return kind
  }
  return null
}

/**
 * What kind of Office file this is: by name when the name says, otherwise by content.
 *
 * Reading the bytes only to sniff them is the slower path, so it is only taken when the name
 * is no help (a connector reference such as `sharepoint://drive/item-id`).
 */
export async function detectOfficeKind(blob: Blob, fileName?: string | null): Promise<OfficeKind | null> {
  return officeKindFromName(fileName) ?? sniffOfficeKind(new Uint8Array(await blob.arrayBuffer()))
}

/** Bytes as base64, in chunks so a large picture does not exceed the argument limit of one call. */
export function toBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunk = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunk) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunk))
  }
  return btoa(binary)
}

/** Text safe to place inside HTML, in element content or in a quoted attribute. */
export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/** What a cell shows. Anything that is not obviously a scalar is shown as its text. */
export function formatCell(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    // Rounded to the nearest minute, as Excel rounds what it displays. A date is stored as a
    // serial number with a fraction, and converting it back leaves floating-point error:
    // 13:45 arrives as 13:44:59.999 and midnight as 23:59:59.999 of the day before, so
    // truncating would show the wrong minute, or the wrong DAY.
    const moment = new Date(Math.round(value.getTime() / 60_000) * 60_000)
    const day = moment.toISOString().slice(0, 10)
    const hasTime = moment.getUTCHours() + moment.getUTCMinutes() > 0
    return hasTime ? `${day} ${moment.toISOString().slice(11, 16)}` : day
  }
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE'
  // 0.1 + 0.2 is stored as 0.30000000000000004; twelve significant digits is what Excel shows.
  if (typeof value === 'number') return Number.isFinite(value) ? String(Number.parseFloat(value.toPrecision(12))) : ''
  return String(value)
}

/** Rows drawn at a time. A whole sheet is reachable page by page; it is never cut off. */
export const ROWS_PER_PAGE = 500
/** Columns drawn. Spreadsheets allow 16,384; past this a table is not something to read anyway. */
export const MAX_PREVIEW_COLUMNS = 200

export interface SheetLabels {
  truncatedColumns(shown: number, total: number): string
  emptySheet: string
}

export interface PreviewSheet {
  sheet: string
  data: unknown[][]
}

export const sheetColumnCount = (sheet: PreviewSheet): number =>
  sheet.data.reduce((widest, row) => Math.max(widest, row.length), 0)

/** Pages in a sheet of `rowCount` rows. An empty sheet still has one (that says it is empty). */
export function sheetPageCount(rowCount: number, perPage: number = ROWS_PER_PAGE): number {
  return Math.max(1, Math.ceil(rowCount / perPage))
}

/**
 * One page of one sheet as an HTML fragment: its rows, numbered as in the spreadsheet.
 *
 * Paged rather than capped, because a preview of a 25 MB workbook that builds a million DOM
 * cells would freeze the tab it is meant to help, while one that silently stops at row 1,000
 * shows the reviewer less than they approve. Every row is reachable; only a page is drawn.
 */
export function sheetPageHtml(
  sheet: PreviewSheet,
  page: number,
  labels: SheetLabels,
  limits: { rows?: number; columns?: number } = {},
): string {
  const perPage = limits.rows ?? ROWS_PER_PAGE
  const maxColumns = limits.columns ?? MAX_PREVIEW_COLUMNS
  const totalColumns = sheetColumnCount(sheet)
  if (sheet.data.length === 0 || totalColumns === 0) {
    return `<p class="note">${escapeHtml(labels.emptySheet)}</p>`
  }
  const columns = Math.min(totalColumns, maxColumns)
  const first = Math.min(Math.max(0, page), sheetPageCount(sheet.data.length, perPage) - 1) * perPage
  const note =
    totalColumns > columns ? `<p class="note">${escapeHtml(labels.truncatedColumns(columns, totalColumns))}</p>` : ''
  const body = sheet.data
    .slice(first, first + perPage)
    .map((row, index) => {
      const cells = Array.from({ length: columns }, (_, column) => `<td>${escapeHtml(formatCell(row[column]))}</td>`)
      return `<tr><th scope="row">${first + index + 1}</th>${cells.join('')}</tr>`
    })
    .join('')
  return `${note}<div class="scroll"><table><tbody>${body}</tbody></table></div>`
}

/**
 * The CSP inside the preview document, as a second line of defence behind the iframe's own
 * sandbox. A preview needs inline styles and `data:` images and nothing else: no scripts, no
 * network, no frames, no forms.
 */
export const PREVIEW_CSP = "default-src 'none'; img-src data:; style-src 'unsafe-inline'; font-src data:"

const BASE_CSS = `
html,body{margin:0;padding:0}
body{font:13px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1f2937;background:#fff}
h2{margin:0;padding:10px 12px;font-size:13px;font-weight:600;background:#f3f4f6;border-bottom:1px solid #d1d5db;position:sticky;left:0}
.note{margin:0;padding:6px 12px;font-size:12px;color:#92400e;background:#fffbeb;border-bottom:1px solid #fde68a}
.scroll{overflow:auto}
table{border-collapse:collapse;min-width:100%}
td,th{border:1px solid #e5e7eb;padding:3px 8px;vertical-align:top;white-space:pre-wrap;max-width:420px;overflow-wrap:break-word}
td{min-width:84px}
th{background:#f9fafb;color:#6b7280;font-weight:500;text-align:right;position:sticky;left:0}
section+section{margin-top:18px}
`

/**
 * A complete document for the sandboxed iframe's `srcdoc`.
 *
 * `<base target="_blank">` keeps a link in a document from navigating the frame; the sandbox
 * (no `allow-popups`) means it does nothing at all, which is the intent: a preview is not a
 * browser.
 */
export function previewDocument(bodyHtml: string, css = ''): string {
  return (
    '<!doctype html><html><head><meta charset="utf-8">' +
    `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">` +
    '<base target="_blank">' +
    `<style>${BASE_CSS}${css}</style></head><body>${bodyHtml}</body></html>`
  )
}
