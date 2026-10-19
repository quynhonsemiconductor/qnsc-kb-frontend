import { previewDocument, type PreviewSheet, type RenderableOfficeKind } from './officePreview'
import type { ImageLabels } from './imageRender'
import type { PptxLabels } from './pptxRender'

/**
 * What drawing a file produced.
 *
 * Most formats come out as one finished HTML document. A spreadsheet comes out as its data
 * instead, because the pane lets the reviewer move between sheets and pages of rows, and
 * each of those is a different document built from the same parsed data.
 */
export type OfficeRendering =
  | { type: 'html'; html: string }
  | { type: 'sheets'; sheets: PreviewSheet[] }

export type OfficeLabels = PptxLabels & ImageLabels

/**
 * Draw a Word, Excel, PowerPoint, TIFF or BMP file for the review pane.
 *
 * Every renderer, and the libraries behind them, is imported on demand: they are large, and
 * most reviews are of PDFs, so nobody should download them until such a file is opened.
 *
 * This only PARSES the file and builds markup. Nothing in the document is executed, and the
 * result is meant for a sandboxed iframe, never for the application's own DOM.
 */
export async function renderOffice(blob: Blob, kind: RenderableOfficeKind, labels: OfficeLabels): Promise<OfficeRendering> {
  switch (kind) {
    case 'xlsx': {
      const { default: readXlsxFile } = await import('read-excel-file/browser')
      return { type: 'sheets', sheets: (await readXlsxFile(blob)) as PreviewSheet[] }
    }
    case 'pptx': {
      const { renderPptxHtml } = await import('./pptxRender')
      return { type: 'html', html: await renderPptxHtml(blob, labels) }
    }
    case 'tiff':
    case 'bmp': {
      const { renderBitmapHtml } = await import('./imageRender')
      return { type: 'html', html: await renderBitmapHtml(blob, kind, labels) }
    }
    case 'docx':
      return { type: 'html', html: await renderDocxHtml(blob) }
  }
}

async function renderDocxHtml(blob: Blob): Promise<string> {
  const { renderAsync } = await import('docx-preview')
  // Rendered into an off-screen stage that is part of the page, so anything that depends on
  // layout works, then lifted out as markup. The stage is always removed again.
  const stage = document.createElement('div')
  stage.setAttribute('aria-hidden', 'true')
  stage.style.cssText = 'position:fixed;left:-100000px;top:0;width:1200px;visibility:hidden;pointer-events:none'
  const styles = document.createElement('div')
  const body = document.createElement('div')
  stage.append(styles, body)
  document.body.append(stage)
  try {
    await renderAsync(blob, body, styles, {
      // Images are inlined as data: URLs, the only kind the preview's CSP allows. Fonts are
      // left to the reader's system: embedded ones are obfuscated and would need a font-src.
      useBase64URL: true,
      ignoreFonts: true,
      inWrapper: true,
      breakPages: true,
      renderHeaders: true,
      renderFooters: true,
      renderFootnotes: true,
      renderEndnotes: true,
      renderComments: false,
      renderChanges: false,
    })
    return previewDocument(styles.innerHTML + body.innerHTML)
  } finally {
    stage.remove()
  }
}
