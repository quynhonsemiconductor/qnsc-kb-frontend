import React, { useMemo, useRef, useState } from 'react'
import { barRects, linePoints, niceMax, pathFromPoints } from '../../lib/investigate'

export interface ChartSeries {
  id: string
  label: string
  kind: 'bar' | 'line'
  values: Array<number | null>
  /** Tailwind classes for the mark: a `fill-*` class for bars, a `stroke-*` class for lines. */
  className: string
  /** A `bg-*` class for the legend swatch. */
  swatchClassName: string
  /** Bars share the left axis; a line may use the right one so a latency can ride over a count. */
  axis?: 'left' | 'right'
  /** A bar drawn over the other bars on the same axis, e.g. the errors within the requests. */
  overlay?: boolean
  format: (value: number | null) => string
}

interface Props {
  labels: string[]
  series: ChartSeries[]
  ariaLabel: string
  /** Shown when there is nothing to plot. */
  emptyText: string
  /** The instruction shown until a bucket is inspected. */
  hint: string
  height?: number
}

const WIDTH = 600

/**
 * A small bar-and-line chart in plain SVG.
 *
 * Written rather than imported because the dashboard needs exactly this one shape (counts as bars,
 * a rate or latency as a line) and the app ships no chart library; the geometry is in lib/investigate
 * where it is tested. It is operable without a mouse (arrow keys move between buckets) and every value
 * is available as text in the readout below, so the picture is never the only way to read the data.
 */
export function TimeSeriesChart({ labels, series, ariaLabel, emptyText, hint, height = 160 }: Props) {
  const [active, setActive] = useState<number | null>(null)
  const frame = useRef<HTMLDivElement>(null)
  const count = labels.length

  const leftMax = useMemo(
    () => niceMax(Math.max(0, ...series.filter((s) => s.axis !== 'right').flatMap((s) => s.values.map((v) => v ?? 0)))),
    [series],
  )
  const rightMax = useMemo(
    () => niceMax(Math.max(0, ...series.filter((s) => s.axis === 'right').flatMap((s) => s.values.map((v) => v ?? 0)))),
    [series],
  )
  const hasRight = series.some((s) => s.axis === 'right')
  const empty = series.every((s) => s.values.every((v) => !v))

  const move = (event: React.PointerEvent<HTMLDivElement>) => {
    const box = frame.current?.getBoundingClientRect()
    if (!box || box.width === 0 || count === 0) return
    const ratio = (event.clientX - box.left) / box.width
    setActive(Math.max(0, Math.min(count - 1, Math.floor(ratio * count))))
  }

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (count === 0) return
    const last = count - 1
    const keys: Record<string, number> = {
      ArrowLeft: active === null ? last : Math.max(0, active - 1),
      ArrowRight: active === null ? last : Math.min(last, active + 1),
      Home: 0,
      End: last,
    }
    if (event.key === 'Escape') {
      setActive(null)
      return
    }
    if (event.key in keys) {
      event.preventDefault()
      setActive(keys[event.key])
    }
  }

  const slot = count > 0 ? WIDTH / count : WIDTH
  const readout =
    active === null
      ? hint
      : `${labels[active]} — ${series.map((s) => `${s.label}: ${s.format(s.values[active] ?? null)}`).join(' · ')}`

  return (
    <figure className="space-y-2">
      <div className="relative">
        <div className="pointer-events-none absolute left-0 top-0 z-10 font-mono text-caption text-muted-foreground">
          {series.find((s) => s.axis !== 'right')?.format(leftMax)}
        </div>
        {hasRight && (
          <div className="pointer-events-none absolute right-0 top-0 z-10 font-mono text-caption text-muted-foreground">
            {series.find((s) => s.axis === 'right')?.format(rightMax)}
          </div>
        )}
        <div
          ref={frame}
          role="group"
          aria-label={ariaLabel}
          tabIndex={0}
          onPointerMove={move}
          onPointerLeave={() => setActive(null)}
          onKeyDown={onKeyDown}
          onBlur={() => setActive(null)}
          className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        >
          <svg viewBox={`0 0 ${WIDTH} ${height}`} preserveAspectRatio="none" className="block w-full" style={{ height }} aria-hidden="true">
            {[0, 0.5, 1].map((fraction) => (
              <line key={fraction} x1={0} x2={WIDTH} y1={height * fraction} y2={height * fraction} className="stroke-border" strokeWidth={1} vectorEffect="non-scaling-stroke" />
            ))}
            {active !== null && <rect x={active * slot} y={0} width={slot} height={height} className="fill-foreground/5" />}
            {series
              .filter((s) => s.kind === 'bar')
              .map((s) =>
                barRects(
                  s.values.map((v) => v ?? 0),
                  WIDTH,
                  height,
                  leftMax,
                  s.overlay ? 0 : 1,
                ).map((rect, index) =>
                  rect.height > 0 ? <rect key={`${s.id}-${index}`} x={rect.x} y={rect.y} width={rect.width} height={rect.height} className={s.className} /> : null,
                ),
              )}
            {series
              .filter((s) => s.kind === 'line')
              .map((s) => (
                <path
                  key={s.id}
                  d={pathFromPoints(linePoints(s.values, WIDTH, height, s.axis === 'right' ? rightMax : leftMax))}
                  className={`${s.className} fill-none`}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
          </svg>
          {empty && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-body-sm text-muted-foreground">{emptyText}</div>
          )}
        </div>
      </div>
      <div className="flex justify-between font-mono text-caption text-muted-foreground" aria-hidden="true">
        <span>{labels[0] ?? ''}</span>
        <span>{labels[Math.floor(count / 2)] ?? ''}</span>
        <span>{labels[count - 1] ?? ''}</span>
      </div>
      <figcaption className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-caption text-muted-foreground">
          {series.map((s) => (
            <li key={s.id} className="flex items-center gap-1.5">
              <span className={`inline-block h-2 w-2 rounded-sm ${s.swatchClassName}`} aria-hidden="true" />
              {s.label}
            </li>
          ))}
        </ul>
        <p aria-live="polite" className="min-h-[1.25rem] text-caption font-medium text-foreground">
          {readout}
        </p>
      </figcaption>
    </figure>
  )
}
