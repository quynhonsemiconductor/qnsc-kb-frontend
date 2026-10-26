import { useRef, useState } from 'react'
import { Maximize2, Minus, Plus } from 'lucide-react'

export interface ImageViewerLabels {
  zoomIn: string
  zoomOut: string
  fit: string
}

const MIN_SCALE = 0.25
const MAX_SCALE = 8

const clamp = (value: number) => Math.min(MAX_SCALE, Math.max(MIN_SCALE, value))

/**
 * An image the reader can zoom (buttons, wheel, double click) and drag to pan.
 *
 * The transform lives in state rather than on the DOM so a re-render never snaps the
 * picture back, and pointer capture keeps a drag going when the pointer leaves the image.
 */
export default function ImageViewer({ src, alt, labels }: { src: string; alt: string; labels: ImageViewerLabels }) {
  const [view, setView] = useState({ scale: 1, x: 0, y: 0 })
  const drag = useRef<{ x: number; y: number; originX: number; originY: number } | null>(null)

  const zoom = (factor: number) => setView(current => ({ ...current, scale: clamp(current.scale * factor) }))
  const reset = () => setView({ scale: 1, x: 0, y: 0 })

  const button = 'grid h-8 w-8 place-items-center rounded-control border border-border bg-surface text-foreground transition hover:bg-surface-muted'

  return (
    <div className="flex h-[min(75dvh,56rem)] flex-col">
      <div className="flex items-center justify-center gap-1.5 border-b border-border bg-surface px-3 py-2">
        <button type="button" onClick={() => zoom(1 / 1.25)} aria-label={labels.zoomOut} title={labels.zoomOut} className={button}><Minus size={14} /></button>
        <span className="w-14 text-center text-caption font-semibold tabular-nums text-muted-foreground" aria-live="polite">{Math.round(view.scale * 100)}%</span>
        <button type="button" onClick={() => zoom(1.25)} aria-label={labels.zoomIn} title={labels.zoomIn} className={button}><Plus size={14} /></button>
        <button type="button" onClick={reset} aria-label={labels.fit} title={labels.fit} className={button}><Maximize2 size={14} /></button>
      </div>
      <div
        className="relative min-h-0 flex-1 cursor-grab touch-none select-none overflow-hidden bg-canvas active:cursor-grabbing"
        onWheel={event => zoom(event.deltaY < 0 ? 1.1 : 1 / 1.1)}
        onDoubleClick={() => setView(current => (current.scale === 1 ? { scale: 2, x: 0, y: 0 } : { scale: 1, x: 0, y: 0 }))}
        onPointerDown={event => {
          event.currentTarget.setPointerCapture(event.pointerId)
          drag.current = { x: event.clientX, y: event.clientY, originX: view.x, originY: view.y }
        }}
        onPointerMove={event => {
          const start = drag.current
          if (!start) return
          setView(current => ({ ...current, x: start.originX + event.clientX - start.x, y: start.originY + event.clientY - start.y }))
        }}
        onPointerUp={() => { drag.current = null }}
        onPointerCancel={() => { drag.current = null }}
      >
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="absolute inset-0 m-auto max-h-full max-w-full object-contain"
          style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})`, transformOrigin: 'center' }}
        />
      </div>
    </div>
  )
}
