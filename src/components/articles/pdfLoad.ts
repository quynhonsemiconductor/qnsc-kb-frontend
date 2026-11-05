import type { PDFDocumentLoadingTask, PDFDocumentProxy } from 'pdfjs-dist'

/** The real pdf.js module surface this loader uses — no structural stand-in. */
export type PdfModule = Pick<typeof import('pdfjs-dist'), 'getDocument'>

export interface PdfLoadHandlers {
  onDocument(document: PDFDocumentProxy): void
  onError(): void
}

/**
 * Start loading a PDF and return the one cancellation handle the effect needs.
 *
 * `cancel()` is safe at every await: before `getDocument` the load simply stops,
 * after it the loading task is destroyed exactly once. The task owns the worker
 * and the document (pdfjs-dist 6 removed PDFDocumentProxy.destroy), so
 * destroying it also aborts a load that has not resolved and cleans up a load
 * that rejects after the component unmounted.
 */
export function startPdfLoad(
  getPdf: () => Promise<PdfModule>,
  blob: Blob,
  handlers: PdfLoadHandlers,
): { cancel(): void } {
  let cancelled = false
  let task: PDFDocumentLoadingTask | null = null

  const destroyTask = () => {
    const current = task
    task = null
    if (current) void current.destroy()
  }

  void (async () => {
    try {
      const pdfjs = await getPdf()
      if (cancelled) return

      const data = new Uint8Array(await blob.arrayBuffer())
      if (cancelled) return

      task = pdfjs.getDocument({ data, disableFontFace: false, useSystemFonts: true })
      const document = await task.promise
      if (cancelled) {
        destroyTask()
        return
      }
      handlers.onDocument(document)
    } catch {
      // getPdf() (a dynamic chunk), blob.arrayBuffer() and task.promise all fail
      // here. Cancelling destroys the task if one exists; a missing task is a
      // no-op, so a failed import never touches a document that was never made.
      if (cancelled) destroyTask()
      else handlers.onError()
    }
  })()

  return {
    cancel() {
      cancelled = true
      destroyTask()
    },
  }
}
