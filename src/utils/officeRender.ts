import { previewDocument, sheetsToHtml, type PreviewSheet, type RenderableOfficeKind, type SheetLabels } from './officePreview'

/**
 * Turn a Word or Excel file into a self-contained HTML document for the review pane.
 *
 * The libraries are imported on demand: they are large, and most reviews are of PDFs, so
 * nobody should download them until a .docx or .xlsx is actually opened.
 *
 * This only PARSES the file and builds markup. Nothing in the document is executed, and the
 * result is meant for a sandboxed iframe, never for the application's own DOM.
 */
export async function renderOfficeHtml(
  blob: Blob,
  kind: RenderableOfficeKind,
  labels: SheetLabels,
): Promise<string> {
  if (kind === 'xlsx') {
    const { default: readXlsxFile } = await import('read-excel-file/browser')
    const sheets = (await readXlsxFile(blob)) as PreviewSheet[]
    return previewDocument(sheetsToHtml(sheets, labels))
  }

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
