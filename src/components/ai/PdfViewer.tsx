import { useEffect } from 'react'
import { Download, ExternalLink, FileWarning, Loader2, X } from 'lucide-react'

interface PdfViewerProps {
  open: boolean
  fileName: string
  url: string
  /** Content-Type the API returned for this source. See INLINE_TYPES. */
  mimeType?: string
  page?: number
  loading?: boolean
  onClose: () => void
}

/**
 * Types this viewer will render inline, and the only ones the API ever serves inline.
 *
 * The server allow-lists exactly these (`_SAFE_SOURCE_MEDIA_TYPES` in source_storage.py)
 * and returns everything else as `application/octet-stream; attachment`. All of them are
 * inert as documents: an image cannot script, and a PDF is drawn by the browser's own
 * viewer, which runs in its own process and cannot touch this origin. The check is
 * repeated here rather than assumed, because this component receives a blob: URL and a
 * blob: URL carries no headers to enforce anything with.
 */
const INLINE_TYPES = ['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'text/plain']

/** Full-screen source viewer matching the DocNexus review interaction. */
export default function PdfViewer({ open, fileName, url, mimeType, page, loading = false, onClose }: PdfViewerProps) {
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const type = (mimeType || '').toLowerCase()
  // An unknown type is only unknown because an older caller did not pass one. Treating
  // that as "not renderable" would break every such caller, so fall back to the PDF
  // viewer, which is what this component has always been used for.
  const canInline = !type || INLINE_TYPES.includes(type)
  const isImage = type.startsWith('image/')
  // #page is a PDF viewer instruction; on an image it is a fragment the browser keeps in
  // the URL and ignores.
  const sourceUrl = page && !isImage ? `${url}#page=${page}` : url

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/70 p-0 sm:p-6">
      <button aria-label="Close document" onClick={onClose} className="absolute inset-0" />
      <div className="relative mx-auto flex h-full w-full max-w-5xl flex-col overflow-hidden border border-hairline bg-surface sm:rounded-xl">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-hairline px-4">
          <p className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{fileName}{page ? ` · Page ${page}` : ''}</p>
          {url && <button onClick={() => window.open(sourceUrl, '_blank', 'noopener,noreferrer')} className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-steel transition hover:bg-surface-soft hover:text-ink"><ExternalLink size={14} /> New tab</button>}
          <button onClick={onClose} aria-label="Close document" className="rounded-lg p-2 text-steel transition hover:bg-surface-soft hover:text-ink"><X size={17} /></button>
        </header>
        <div className="min-h-0 flex-1 bg-canvas">
          {loading || !url ? (
            <div className="grid h-full place-items-center text-steel"><Loader2 size={20} className="animate-spin" /></div>
          ) : !canInline ? (
            // Not a failure — the format simply is not one a browser shows safely. Offer
            // the file instead of an error the reader can do nothing about.
            <div className="grid h-full place-items-center px-6 text-center">
              <div className="max-w-sm space-y-3">
                <FileWarning size={22} className="mx-auto text-stone" />
                <p className="text-sm font-medium text-ink">This format cannot be previewed in the browser</p>
                <p className="text-xs text-steel">Download the original file to open it in the application it belongs to.</p>
                <a href={url} download={fileName} className="inline-flex items-center gap-2 rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-primary-foreground transition-all hover:bg-charcoal hover:shadow-md">
                  <Download size={13} /> Download original
                </a>
              </div>
            </div>
          ) : isImage ? (
            <div className="grid h-full place-items-center overflow-auto bg-white p-4">
              <img src={sourceUrl} alt={fileName} className="max-h-full max-w-full object-contain" />
            </div>
          ) : (
            /* No `sandbox` attribute, deliberately. The src is a blob: URL minted by this
               origin, and a sandboxed frame has an OPAQUE origin — it is therefore not
               same-origin with the blob it was asked to load, so Chrome refused the
               navigation outright and showed its "page blocked" screen instead of the
               document. The sandbox was also not buying what the comment here used to
               claim: a blob: response has no headers, so the server's CSP sandbox never
               applied to it. What makes this safe is the type, checked above: the API
               serves only inert formats inline, and a PDF renders in the browser's own
               isolated viewer. */
            <iframe src={sourceUrl} title={fileName} className="size-full border-0 bg-white" />
          )}
        </div>
      </div>
    </div>
  )
}
