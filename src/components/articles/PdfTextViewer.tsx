import { useCallback, useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from 'pdfjs-dist'
import { RefreshCw } from 'lucide-react'
import { CONTEXT_CHARS, cleanSelectedText, contextAround, spansLines, toFractions, type Overlay, type PendingEdit, type SelectionInfo } from '../../lib/selectionEdit'
import { useLanguage } from '../../i18n/LanguageProvider'

/** Pages are laid out at the width of the pane, never narrower than this (readable) or wider than that (sharp). */
const MIN_WIDTH = 360
const MAX_SCALE = 2.5
/** How far outside the visible area a page is drawn, so scrolling does not show blank pages. */
const RENDER_MARGIN = '800px'

interface PageSlot {
  number: number
  width: number
  height: number
}

/**
 * A PDF drawn by the page itself (pdf.js), so its text can be SELECTED.
 *
 * The browser's own PDF viewer lives in a separate process and exposes no selection to the page,
 * which is why a reader could not point at the text they want to change. Each page is a canvas
 * with a transparent text layer over it; selecting text selects real elements, and the page
 * reports what was selected, the text around it and the page number.
 *
 * Pages are drawn only near the visible area. The document is read from a blob this origin
 * minted, by a worker served from this origin (the CSP's `worker-src 'self'`), with the script
 * features that need `eval` switched off.
 */
export default function PdfTextViewer({
  blob,
  onSelect,
  pending,
}: {
  blob: Blob
  /** Called with the current selection, or null when it is cleared. Not called while idle. */
  onSelect?: (selection: SelectionInfo | null) => void
  /** Changes already queued, drawn over the page they belong to. */
  pending?: PendingEdit[]
}) {
  const { t } = useLanguage()
  const hostRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<'loading' | 'ready' | 'failed'>('loading')
  const [slots, setSlots] = useState<PageSlot[]>([])
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null)
  const [width, setWidth] = useState(0)
  const rendered = useRef(new Map<number, { cancel: () => void }>())

  // Load the document.
  useEffect(() => {
    let alive = true
    let loaded: PDFDocumentProxy | null = null
    setStatus('loading')
    setDoc(null)
    void (async () => {
      try {
        const [pdfjs, workerUrl] = await Promise.all([
          import('pdfjs-dist'),
          import('pdfjs-dist/build/pdf.worker.min.mjs?url').then(module => module.default),
          import('pdfjs-dist/web/pdf_viewer.css'),
        ])
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl
        const task = pdfjs.getDocument({
          data: new Uint8Array(await blob.arrayBuffer()),
          // No eval in a page whose CSP forbids it, and no network fetches for fonts or CMaps.
          isEvalSupported: false,
          disableFontFace: false,
          useSystemFonts: true,
        })
        loaded = await task.promise
        if (!alive) {
          void loaded.destroy()
          return
        }
        const first = await loaded.getPage(1)
        const base = first.getViewport({ scale: 1 })
        setSlots(Array.from({ length: loaded.numPages }, (_, index) => ({ number: index + 1, width: base.width, height: base.height })))
        setDoc(loaded)
        setStatus('ready')
      } catch {
        if (alive) setStatus('failed')
      }
    })()
    return () => {
      alive = false
      for (const job of rendered.current.values()) job.cancel()
      rendered.current.clear()
      if (loaded) void loaded.destroy()
    }
  }, [blob])

  // Fit the pages to the pane.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const measure = () => setWidth(Math.max(MIN_WIDTH, host.clientWidth - 24))
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(host)
    return () => observer.disconnect()
  }, [status])

  // Report the selection.
  const report = useCallback(() => {
    const host = hostRef.current
    if (!host || !onSelect) return
    const selection = window.getSelection()
    if (!selection || selection.rangeCount === 0 || selection.isCollapsed) return onSelect(null)
    const range = selection.getRangeAt(0)
    if (!host.contains(range.startContainer) || !host.contains(range.endContainer)) return onSelect(null)
    const startElement = range.startContainer instanceof Element ? range.startContainer : range.startContainer.parentElement
    const pageElement = startElement?.closest<HTMLElement>('[data-page]')
    const layer = pageElement?.querySelector<HTMLElement>('.textLayer')
    if (!pageElement || !layer) return onSelect(null)
    const text = cleanSelectedText(range.toString())
    // Text before and after, read from the same layer so it is in the order the file reads.
    const before = document.createRange()
    before.selectNodeContents(layer)
    before.setEnd(range.startContainer, range.startOffset)
    const after = document.createRange()
    after.selectNodeContents(layer)
    after.setStart(range.endContainer, range.endOffset)
    const whole = cleanSelectedText(before.toString()) + text + cleanSelectedText(after.toString())
    const start = cleanSelectedText(before.toString()).length
    const around = contextAround(whole, start, text.length, CONTEXT_CHARS)
    const box = range.getBoundingClientRect()
    const info: SelectionInfo = {
      text,
      before: around.before,
      after: around.after,
      page: Number(pageElement.dataset.page),
      rect: { left: box.left, top: box.top, width: box.width, height: box.height },
      multiline: spansLines(Array.from(range.getClientRects())),
    }
    onSelect({ ...info, overlay: pageOverlay(info, pageElement) ?? undefined })
  }, [onSelect])

  useEffect(() => {
    if (!onSelect) return
    // `selectionchange` fires on every drag step; the popover should appear when the reader lets go.
    const done = () => window.setTimeout(report, 0)
    const host = hostRef.current
    host?.addEventListener('mouseup', done)
    host?.addEventListener('keyup', done)
    const clear = () => {
      const selection = window.getSelection()
      if (!selection || selection.isCollapsed) onSelect(null)
    }
    document.addEventListener('selectionchange', clear)
    return () => {
      host?.removeEventListener('mouseup', done)
      host?.removeEventListener('keyup', done)
      document.removeEventListener('selectionchange', clear)
    }
  }, [onSelect, report, status])

  if (status === 'loading') {
    return <div role="status" className="grid h-full place-items-center text-body-sm text-muted-foreground"><span className="flex items-center gap-2"><RefreshCw size={15} className="animate-spin" />{t('original.loading')}</span></div>
  }
  if (status === 'failed' || !doc) {
    return <div className="grid h-full place-items-center px-6 text-center text-body-sm text-muted-foreground">{t('original.failed')}</div>
  }
  return (
    <div ref={hostRef} className="h-full overflow-auto bg-surface-muted py-3" data-testid="pdf-text-viewer">
      <div className="mx-auto flex w-fit flex-col gap-3">
        {slots.map(slot => (
          <PdfPage key={slot.number} doc={doc} slot={slot} width={width} rendered={rendered} scrollRoot={hostRef} overlays={(pending || []).filter(edit => edit.overlay?.page === slot.number)} />
        ))}
      </div>
    </div>
  )
}

function PdfPage({
  doc,
  slot,
  width,
  rendered,
  scrollRoot,
  overlays,
}: {
  doc: PDFDocumentProxy
  slot: PageSlot
  width: number
  rendered: React.MutableRefObject<Map<number, { cancel: () => void }>>
  scrollRoot: React.RefObject<HTMLDivElement | null>
  overlays: PendingEdit[]
}) {
  const wrapper = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const layer = useRef<HTMLDivElement>(null)
  const [visible, setVisible] = useState(slot.number <= 2)
  const scale = Math.min(MAX_SCALE, Math.max(0.2, width / slot.width))
  const box = { width: slot.width * scale, height: slot.height * scale }

  useEffect(() => {
    const element = wrapper.current
    if (!element) return
    // Rooted at the scrolling pane: an observer rooted at the viewport counts a page the pane has
    // clipped away as not intersecting, whatever the margin, so pages below the fold never drew.
    const observer = new IntersectionObserver(entries => setVisible(entries.some(entry => entry.isIntersecting)), { root: scrollRoot.current, rootMargin: RENDER_MARGIN })
    observer.observe(element)
    return () => observer.disconnect()
  }, [scrollRoot])

  useEffect(() => {
    const target = canvas.current
    const textLayer = layer.current
    if (!visible || !target || !textLayer || !width) return
    let alive = true
    let task: { cancel: () => void } | null = null
    let text: { cancel: () => void } | null = null
    void (async () => {
      try {
        const pdfjs = await import('pdfjs-dist')
        const page = await doc.getPage(slot.number)
        if (!alive) return
        const viewport = page.getViewport({ scale })
        const ratio = Math.min(window.devicePixelRatio || 1, 2)
        target.width = Math.floor(viewport.width * ratio)
        target.height = Math.floor(viewport.height * ratio)
        target.style.width = `${viewport.width}px`
        target.style.height = `${viewport.height}px`
        const context = target.getContext('2d')
        if (!context) return
        task = page.render({ canvasContext: context, viewport, transform: ratio === 1 ? undefined : [ratio, 0, 0, ratio, 0, 0], canvas: target })
        const layerBox = textLayer
        layerBox.replaceChildren()
        layerBox.style.setProperty('--scale-factor', String(viewport.scale))
        layerBox.style.setProperty('--total-scale-factor', String(viewport.scale))
        const builder = new pdfjs.TextLayer({ textContentSource: page.streamTextContent(), container: layerBox, viewport })
        text = builder
        await Promise.all([(task as unknown as { promise: Promise<void> }).promise, builder.render()])
      } catch {
        // A cancelled render (scrolled away, resized) is expected; a failed one leaves a blank page.
      }
    })()
    const job = { cancel: () => { alive = false; task?.cancel(); text?.cancel() } }
    rendered.current.set(slot.number, job)
    return () => {
      job.cancel()
      rendered.current.delete(slot.number)
    }
  }, [visible, doc, slot.number, scale, width, rendered])

  return (
    <div ref={wrapper} data-page={slot.number} className="relative bg-white shadow-sm" style={{ width: box.width, height: box.height }}>
      <canvas ref={canvas} className="absolute inset-0" />
      <div ref={layer} className="textLayer absolute inset-0" style={{ width: box.width, height: box.height }} />
      {overlays.map(edit => edit.overlay && <ChangeChip key={edit.id} overlay={edit.overlay} text={edit.replace} />)}
    </div>
  )
}

/** The new text, drawn over the place it will replace, so the reader sees the correction in the document. */
export function ChangeChip({ overlay, text }: { overlay: Overlay; text: string }) {
  return (
    <div
      data-testid="change-chip"
      className="pointer-events-none absolute z-10 overflow-hidden rounded-sm border border-amber-500 bg-amber-100 text-[11px] font-semibold leading-tight text-amber-950 shadow-sm"
      style={{ left: `${overlay.left * 100}%`, top: `${overlay.top * 100}%`, minWidth: `${overlay.width * 100}%`, minHeight: `${overlay.height * 100}%` }}
    >
      <span className="whitespace-nowrap px-0.5">{text || '∅'}</span>
    </div>
  )
}

/** Where a selection sits on its page, as fractions of the page, for drawing a queued change. */
export function pageOverlay(selection: SelectionInfo, pageElement: Element | null): Overlay | null {
  if (!pageElement || selection.page === undefined) return null
  const page = pageElement.getBoundingClientRect()
  const fractions = toFractions(selection.rect, { left: page.left, top: page.top, width: page.width, height: page.height })
  return fractions ? { ...fractions, page: selection.page } : null
}
