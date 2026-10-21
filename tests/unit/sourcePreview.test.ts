import { describe, expect, it } from 'vitest'
import {
  INLINE_SOURCE_TYPES,
  canInlineSourceType,
  fileNameFromContentDisposition,
  indexNeedsAttention,
  sourceFileNameFromRef,
  sourcePreviewMode,
} from '../../src/utils/sourcePreview'

describe('inline source allow-list', () => {
  it('permits exactly the inert formats the API serves inline', () => {
    for (const type of INLINE_SOURCE_TYPES) expect(canInlineSourceType(type)).toBe(true)
    expect(canInlineSourceType('APPLICATION/PDF')).toBe(true)
    expect(canInlineSourceType('application/pdf')).toBe(true)
  })

  it('refuses anything else, including formats that can carry active content', () => {
    for (const type of [
      'text/html',
      'image/svg+xml',
      'application/msword',
      'application/octet-stream',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ]) {
      expect(canInlineSourceType(type)).toBe(false)
    }
  })

  it('treats an absent type as renderable, for callers that never sent one', () => {
    expect(canInlineSourceType(undefined)).toBe(true)
    expect(canInlineSourceType(null)).toBe(true)
    expect(canInlineSourceType('')).toBe(true)
  })
})

describe('source preview mode', () => {
  it('reports unavailable ahead of everything else', () => {
    // A draft with no stored file must not sit on a spinner forever, even while a request
    // is notionally in flight.
    expect(sourcePreviewMode({ unavailable: true, loading: true, url: 'blob:x' })).toBe('unavailable')
  })

  it('waits while loading, and while there is no url yet', () => {
    expect(sourcePreviewMode({ loading: true })).toBe('loading')
    expect(sourcePreviewMode({ loading: false, url: null })).toBe('loading')
  })

  it('offers a download instead of rendering a format browsers cannot show safely', () => {
    expect(sourcePreviewMode({ url: 'blob:x', mimeType: 'application/msword' })).toBe('download')
    expect(sourcePreviewMode({ url: 'blob:x', mimeType: 'image/svg+xml' })).toBe('download')
  })

  it('renders a Word or Excel file in the page, because the browser will not show it itself', () => {
    const octet = 'application/octet-stream'
    expect(sourcePreviewMode({ url: 'blob:x', mimeType: octet, officeKind: 'docx' })).toBe('office')
    expect(sourcePreviewMode({ url: 'blob:x', mimeType: octet, officeKind: 'xlsx' })).toBe('office')
  })

  it('renders PowerPoint, TIFF and BMP in the page too', () => {
    const octet = 'application/octet-stream'
    for (const officeKind of ['pptx', 'tiff', 'bmp'] as const) {
      expect(sourcePreviewMode({ url: 'blob:x', mimeType: octet, officeKind })).toBe('office')
    }
  })

  it('still offers anything unidentified as a download', () => {
    const octet = 'application/octet-stream'
    expect(sourcePreviewMode({ url: 'blob:x', mimeType: octet, officeKind: null })).toBe('download')
    expect(sourcePreviewMode({ url: 'blob:x', mimeType: octet })).toBe('download')
  })

  it('lets the API-approved inline types win over a detected Office kind', () => {
    expect(sourcePreviewMode({ url: 'blob:x', mimeType: 'application/pdf', officeKind: 'docx' })).toBe('embed')
  })

  it('renders images as images and everything else inline-safe as an embed', () => {
    expect(sourcePreviewMode({ url: 'blob:x', mimeType: 'image/png' })).toBe('image')
    expect(sourcePreviewMode({ url: 'blob:x', mimeType: 'image/jpeg' })).toBe('image')
    expect(sourcePreviewMode({ url: 'blob:x', mimeType: 'application/pdf' })).toBe('embed')
    expect(sourcePreviewMode({ url: 'blob:x', mimeType: 'text/plain' })).toBe('embed')
  })
})

describe('source file name', () => {
  it('takes the file name out of an upload reference', () => {
    expect(sourceFileNameFromRef('upload://server_access_quick_guide (1).pdf')).toBe('server_access_quick_guide (1).pdf')
  })

  it('takes the last segment of a connector reference', () => {
    expect(sourceFileNameFromRef('sharepoint://drive-1/folder/policy.docx')).toBe('policy.docx')
  })

  it('drops query strings and fragments rather than rendering plumbing', () => {
    expect(sourceFileNameFromRef('upload://guide.pdf?version=3')).toBe('guide.pdf')
    expect(sourceFileNameFromRef('upload://guide.pdf#page=2')).toBe('guide.pdf')
  })

  it('decodes percent-encoding so a name reads as it was uploaded', () => {
    expect(sourceFileNameFromRef('upload://quy%20tr%C3%ACnh.pdf')).toBe('quy trình.pdf')
  })

  it('falls back rather than returning an empty label', () => {
    expect(sourceFileNameFromRef('')).toBe('Original file')
    expect(sourceFileNameFromRef(null)).toBe('Original file')
    expect(sourceFileNameFromRef('upload://')).toBe('Original file')
  })
})

describe('file name from Content-Disposition', () => {
  it('reads the quoted form the API sends', () => {
    expect(fileNameFromContentDisposition('attachment; filename="quy_trinh.docx"')).toBe('quy_trinh.docx')
    expect(fileNameFromContentDisposition('inline; filename="a b.pdf"')).toBe('a b.pdf')
  })

  it('prefers the encoded form and decodes it', () => {
    expect(fileNameFromContentDisposition("attachment; filename=\"x.docx\"; filename*=UTF-8''quy%20tr%C3%ACnh.docx")).toBe('quy trình.docx')
  })

  it('reads an unquoted name and survives a malformed encoding', () => {
    expect(fileNameFromContentDisposition('attachment; filename=report.xlsx')).toBe('report.xlsx')
    expect(fileNameFromContentDisposition("attachment; filename*=UTF-8''%E0%A4%A; filename=\"ok.pdf\"")).toBe('ok.pdf')
  })

  it('returns null when there is no name', () => {
    expect(fileNameFromContentDisposition(undefined)).toBeNull()
    expect(fileNameFromContentDisposition('')).toBeNull()
    expect(fileNameFromContentDisposition('attachment')).toBeNull()
    expect(fileNameFromContentDisposition('attachment; filename=""')).toBeNull()
  })
})

describe('index state needing attention', () => {
  it('flags a published article that is queued, indexing or failed', () => {
    for (const state of ['pending', 'processing', 'failed']) expect(indexNeedsAttention(state, 'published')).toBe(true)
  })

  it('says nothing about a ready article', () => {
    expect(indexNeedsAttention('ready', 'published')).toBe(false)
  })

  it('never flags a draft, which is not indexed at all', () => {
    for (const status of ['draft', 'pending_review', 'archived', undefined, null]) expect(indexNeedsAttention('pending', status)).toBe(false)
  })

  it('ignores an unknown or missing state', () => {
    expect(indexNeedsAttention('legacy', 'published')).toBe(false)
    expect(indexNeedsAttention(undefined, 'published')).toBe(false)
  })
})
