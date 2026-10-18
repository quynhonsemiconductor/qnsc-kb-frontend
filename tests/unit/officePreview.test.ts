import { describe, expect, it } from 'vitest'
import {
  PREVIEW_CSP,
  detectOfficeKind,
  escapeHtml,
  formatCell,
  isRenderableOffice,
  officeKindFromName,
  previewDocument,
  sheetsToHtml,
  sniffOfficeKind,
  type SheetLabels,
} from '../../src/utils/officePreview'

const ascii = (text: string) => Array.from(text, char => char.charCodeAt(0))
const ZIP_MAGIC = [0x50, 0x4b, 0x03, 0x04]

/** Bytes shaped like a zip: the magic, some filler, then an entry name as a directory lists it. */
const zipLike = (entryName: string, filler = 64) =>
  new Uint8Array([...ZIP_MAGIC, ...new Array(filler).fill(7), ...ascii(entryName), ...new Array(22).fill(0)])

const labels: SheetLabels = {
  truncatedRows: (shown, total) => `first ${shown} of ${total} rows`,
  truncatedColumns: (shown, total) => `first ${shown} of ${total} columns`,
  emptySheet: 'empty sheet',
}

describe('officeKindFromName', () => {
  it('reads the format from the extension, ignoring case and stray whitespace', () => {
    expect(officeKindFromName('report.docx')).toBe('docx')
    expect(officeKindFromName('REPORT.DOCX')).toBe('docx')
    expect(officeKindFromName('budget.xlsx')).toBe('xlsx')
    expect(officeKindFromName('deck.pptx')).toBe('pptx')
    expect(officeKindFromName('  report.docx  ')).toBe('docx')
  })

  it('treats a macro-enabled workbook as a workbook', () => {
    expect(officeKindFromName('macros.xlsm')).toBe('xlsx')
  })

  it('returns null when the name says nothing usable', () => {
    for (const name of ['guide.pdf', 'file-1', 'archive.docx.exe', '', undefined, null, 'old.doc', 'old.xls']) {
      expect(officeKindFromName(name)).toBeNull()
    }
  })
})

describe('isRenderableOffice', () => {
  it('renders Word and Excel, and not PowerPoint', () => {
    expect(isRenderableOffice('docx')).toBe(true)
    expect(isRenderableOffice('xlsx')).toBe(true)
    // There is no safe, maintained renderer for it; it stays a download.
    expect(isRenderableOffice('pptx')).toBe(false)
    expect(isRenderableOffice(null)).toBe(false)
    expect(isRenderableOffice(undefined)).toBe(false)
  })
})

describe('sniffOfficeKind', () => {
  it('tells the three formats apart by the one entry each has', () => {
    expect(sniffOfficeKind(zipLike('word/document.xml'))).toBe('docx')
    expect(sniffOfficeKind(zipLike('xl/workbook.xml'))).toBe('xlsx')
    expect(sniffOfficeKind(zipLike('ppt/presentation.xml'))).toBe('pptx')
  })

  it('returns null for a zip of something else', () => {
    expect(sniffOfficeKind(zipLike('META-INF/MANIFEST.MF'))).toBeNull()
  })

  it('requires the zip signature, so a name mentioned in other content is not enough', () => {
    const notAZip = new Uint8Array([...ascii('%PDF-1.7 '), ...ascii('word/document.xml')])
    expect(sniffOfficeKind(notAZip)).toBeNull()
    expect(sniffOfficeKind(new Uint8Array([0x50, 0x4b]))).toBeNull()
    expect(sniffOfficeKind(new Uint8Array())).toBeNull()
  })

  it('looks at the end of the file, where a zip keeps its directory', () => {
    const size = 5 * 1024 * 1024 // beyond the 4 MB window
    const atEnd = new Uint8Array(size)
    atEnd.set(ZIP_MAGIC, 0)
    atEnd.set(ascii('xl/workbook.xml'), size - 100)
    expect(sniffOfficeKind(atEnd)).toBe('xlsx')

    const atStartOnly = new Uint8Array(size)
    atStartOnly.set(ZIP_MAGIC, 0)
    atStartOnly.set(ascii('xl/workbook.xml'), 100)
    expect(sniffOfficeKind(atStartOnly)).toBeNull()
  })
})

describe('detectOfficeKind', () => {
  it('trusts a name that says what the file is, without reading it', async () => {
    const garbage = new Blob([new Uint8Array([1, 2, 3])])
    expect(await detectOfficeKind(garbage, 'upload://notes.docx')).toBe('docx')
  })

  it('falls back to the content when the name has no extension', async () => {
    // How a connector import is referenced: `sharepoint://drive-1/item-id`.
    const workbook = new Blob([zipLike('xl/workbook.xml')])
    expect(await detectOfficeKind(workbook, 'item-id')).toBe('xlsx')
    expect(await detectOfficeKind(workbook, null)).toBe('xlsx')
  })

  it('reports nothing for content that is not an Office file', async () => {
    expect(await detectOfficeKind(new Blob(['plain text']), 'item-id')).toBeNull()
  })
})

describe('escapeHtml', () => {
  it('escapes every character that can open markup or break out of an attribute', () => {
    expect(escapeHtml(`<a href="x" onclick='y'>&</a>`)).toBe(
      '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    )
  })

  it('turns nothing into an empty string', () => {
    expect(escapeHtml(null)).toBe('')
    expect(escapeHtml(undefined)).toBe('')
  })
})

describe('formatCell', () => {
  it('shows empties as empty', () => {
    expect(formatCell(null)).toBe('')
    expect(formatCell(undefined)).toBe('')
  })

  it('shows a date without a time when there is none', () => {
    expect(formatCell(new Date(Date.UTC(2026, 9, 18)))).toBe('2026-10-18')
    expect(formatCell(new Date(Date.UTC(2026, 9, 18, 13, 45)))).toBe('2026-10-18 13:45')
    expect(formatCell(new Date('not a date'))).toBe('')
  })

  it('absorbs the floating-point error of a date stored as a serial number', () => {
    // Found in a real browser against a real .xlsx: 13:45 came back as 13:44:59.999 and was
    // shown as 13:44. Midnight is worse: 23:59:59.999 truncated to the PREVIOUS day.
    expect(formatCell(new Date(Date.UTC(2026, 5, 30, 13, 44, 59, 999)))).toBe('2026-06-30 13:45')
    expect(formatCell(new Date(Date.UTC(2026, 2, 30, 23, 59, 59, 999)))).toBe('2026-03-31')
    expect(formatCell(new Date(Date.UTC(2026, 2, 31, 0, 0, 0, 1)))).toBe('2026-03-31')
  })

  it('shows booleans the way a spreadsheet does', () => {
    expect(formatCell(true)).toBe('TRUE')
    expect(formatCell(false)).toBe('FALSE')
  })

  it('removes floating-point noise but keeps real values', () => {
    expect(formatCell(0.1 + 0.2)).toBe('0.3')
    expect(formatCell(42)).toBe('42')
    expect(formatCell(-1234.5)).toBe('-1234.5')
    expect(formatCell(Number.NaN)).toBe('')
    expect(formatCell(Number.POSITIVE_INFINITY)).toBe('')
  })

  it('passes text through untouched', () => {
    expect(formatCell('Quy trình nghỉ phép')).toBe('Quy trình nghỉ phép')
  })
})

describe('sheetsToHtml', () => {
  it('draws a heading and a table per sheet, with row numbers', () => {
    const html = sheetsToHtml(
      [
        { sheet: 'Doanh thu', data: [['Quý', 'Tiền'], ['Q1', 100]] },
        { sheet: 'Chi phí', data: [['A']] },
      ],
      labels,
    )

    expect(html).toContain('<h2>Doanh thu</h2>')
    expect(html).toContain('<h2>Chi phí</h2>')
    expect(html).toContain('<th scope="row">1</th><td>Quý</td><td>Tiền</td>')
    expect(html).toContain('<th scope="row">2</th><td>Q1</td><td>100</td>')
  })

  it('never lets cell text or a sheet name become markup', () => {
    // The document is an untrusted upload, so this is the point of the whole function.
    const payload = '<img src=x onerror=alert(1)><script>alert(2)</script>'
    const html = sheetsToHtml([{ sheet: `<b>${payload}</b>`, data: [[payload, '" onmouseover="alert(3)']] }], labels)

    expect(html).not.toMatch(/<(?!\/?(section|h2|p|div|table|tbody|tr|th|td)[\s>])/i)
    expect(html).not.toContain('<img')
    expect(html).not.toContain('<script')
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;')
    expect(html).toContain('&quot; onmouseover=&quot;alert(3)')
  })

  it('pads a short row so every row has the same number of cells', () => {
    const html = sheetsToHtml([{ sheet: 'S', data: [['a', 'b', 'c'], ['x']] }], labels)
    expect(html).toContain('<th scope="row">2</th><td>x</td><td></td><td></td>')
  })

  it('says so when it shows only part of a sheet, rather than truncating silently', () => {
    const data = Array.from({ length: 12 }, (_, row) => Array.from({ length: 8 }, (_, col) => `r${row}c${col}`))
    const html = sheetsToHtml([{ sheet: 'Big', data }], labels, { rows: 5, columns: 3 })

    expect(html).toContain('first 5 of 12 rows')
    expect(html).toContain('first 3 of 8 columns')
    expect(html.match(/<tr>/g)).toHaveLength(5)
    expect(html).not.toContain('r5c0')
    expect(html).not.toContain('r0c3')
  })

  it('adds no note when everything fits', () => {
    const html = sheetsToHtml([{ sheet: 'Small', data: [['a', 'b']] }], labels)
    expect(html).not.toContain('class="note"')
  })

  it('marks an empty sheet instead of drawing an empty table', () => {
    const html = sheetsToHtml([{ sheet: 'Nothing', data: [] }, { sheet: 'Blank', data: [[]] }], labels)
    expect(html.match(/empty sheet/g)).toHaveLength(2)
    expect(html).not.toContain('<table>')
  })
})

describe('previewDocument', () => {
  it('wraps the body in a document that carries its own restrictive CSP', () => {
    const html = previewDocument('<p>hello</p>')

    expect(html).toContain('<!doctype html>')
    expect(html).toContain(`<meta http-equiv="Content-Security-Policy" content="${PREVIEW_CSP}">`)
    expect(html).toContain('<p>hello</p>')
    expect(html).toContain('<base target="_blank">')
  })

  it('allows no scripts, no network and no frames: only inline styles and data images', () => {
    expect(PREVIEW_CSP).toContain("default-src 'none'")
    expect(PREVIEW_CSP).not.toContain('script-src')
    expect(PREVIEW_CSP).not.toContain("'unsafe-eval'")
    expect(PREVIEW_CSP).not.toMatch(/connect-src|frame-src|form-action/)
    expect(PREVIEW_CSP).toContain('img-src data:')
  })

  it('appends extra CSS after the base styles', () => {
    expect(previewDocument('', 'body{background:red}')).toContain('body{background:red}')
  })
})
