import { useEffect } from 'react'
import { ExternalLink, Loader2, X } from 'lucide-react'

interface PdfViewerProps {
  open: boolean
  fileName: string
  url: string
  page?: number
  loading?: boolean
  onClose: () => void
}

/** Full-screen source viewer matching the DocNexus review interaction. */
export default function PdfViewer({ open, fileName, url, page, loading = false, onClose }: PdfViewerProps) {
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose])

  if (!open) return null

  const sourceUrl = page ? `${url}#page=${page}` : url

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
          {loading || !url ? <div className="grid h-full place-items-center text-steel"><Loader2 size={20} className="animate-spin" /></div> : <iframe src={sourceUrl} title={fileName} sandbox="allow-same-origin" className="size-full border-0 bg-white" />}
        </div>
      </div>
    </div>
  )
}
