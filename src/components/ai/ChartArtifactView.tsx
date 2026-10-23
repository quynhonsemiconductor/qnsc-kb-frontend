import { useRef, useState } from 'react'
import { Download, Table2 } from 'lucide-react'
import type { ChartArtifact } from '../../types/ai'
import { formatValue, niceTicks, pieSlices, valueRange } from '../../lib/agent'
import { useLanguage } from '../../i18n/LanguageProvider'

const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626']
const W = 640
const H = 320
const MARGIN = { top: 16, right: 16, bottom: 52, left: 64 }

/**
 * A chart drawn from the JSON the server built out of a retrieved table.
 *
 * Plain SVG, no chart library and nothing evaluated: the page only places shapes at
 * coordinates computed here. The numbers shown are the server's, read from the stored table,
 * and the same numbers are available as a table below ("show data") so a reader can check
 * the picture against them.
 */
export default function ChartArtifactView({ chart }: { chart: ChartArtifact }) {
  const { t } = useLanguage()
  const svgRef = useRef<SVGSVGElement>(null)
  const [showData, setShowData] = useState(false)

  const download = () => {
    const svg = svgRef.current
    if (!svg) return
    const markup = new XMLSerializer().serializeToString(svg)
    const image = new Image()
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }))
    image.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = W * 2
      canvas.height = H * 2
      const context = canvas.getContext('2d')
      if (context) {
        context.fillStyle = '#ffffff'
        context.fillRect(0, 0, canvas.width, canvas.height)
        context.drawImage(image, 0, 0, canvas.width, canvas.height)
        canvas.toBlob(blob => {
          if (!blob) return
          const link = document.createElement('a')
          link.href = URL.createObjectURL(blob)
          link.download = `${chart.title || 'chart'}.png`.replace(/[\\/:*?"<>|]+/g, '_')
          link.click()
          URL.revokeObjectURL(link.href)
        })
      }
      URL.revokeObjectURL(url)
    }
    image.src = url
  }

  const plotW = W - MARGIN.left - MARGIN.right
  const plotH = H - MARGIN.top - MARGIN.bottom
  const range = valueRange(chart)
  const ticks = niceTicks(range.min, range.max)
  const lo = ticks[0]
  const hi = ticks[ticks.length - 1]
  const y = (value: number) => MARGIN.top + plotH - ((value - lo) / (hi - lo || 1)) * plotH
  const slot = plotW / Math.max(1, chart.categories.length)
  const x = (index: number) => MARGIN.left + slot * index + slot / 2
  const labelEvery = Math.max(1, Math.ceil(chart.categories.length / 10))

  const body = (() => {
    if (chart.chart_type === 'pie') {
      const slices = pieSlices(chart.series[0]?.values || [])
      const cx = W / 2 - 90
      const cy = H / 2
      const r = Math.min(H / 2 - 20, 120)
      const point = (angle: number) => `${cx + r * Math.sin(angle)} ${cy - r * Math.cos(angle)}`
      return (
        <>
          {slices.map(slice => {
            if (!slice) return null
            const large = slice.end - slice.start > Math.PI ? 1 : 0
            const full = slice.share > 0.9999
            return (
              <path
                key={slice.index}
                d={full ? `M ${cx - r} ${cy} A ${r} ${r} 0 1 1 ${cx + r} ${cy} A ${r} ${r} 0 1 1 ${cx - r} ${cy} Z` : `M ${cx} ${cy} L ${point(slice.start)} A ${r} ${r} 0 ${large} 1 ${point(slice.end)} Z`}
                fill={COLORS[slice.index % COLORS.length]}
                opacity={1 - 0.25 * Math.floor(slice.index / COLORS.length)}
                stroke="#ffffff"
                strokeWidth={1.5}
              >
                <title>{`${chart.categories[slice.index]}: ${formatValue(slice.value)} (${(slice.share * 100).toFixed(1)}%)`}</title>
              </path>
            )
          })}
          {chart.categories.slice(0, 12).map((label, index) => (
            <g key={index} transform={`translate(${W / 2 + 60} ${30 + index * 20})`}>
              <rect width={11} height={11} rx={2} fill={COLORS[index % COLORS.length]} opacity={1 - 0.25 * Math.floor(index / COLORS.length)} />
              <text x={17} y={10} fontSize={11} className="fill-current">{label.length > 28 ? `${label.slice(0, 27)}…` : label}</text>
            </g>
          ))}
        </>
      )
    }

    const groupWidth = Math.min(slot * 0.72, 56 * chart.series.length)
    const barWidth = groupWidth / chart.series.length
    return (
      <>
        {ticks.map(tick => (
          <g key={tick}>
            <line x1={MARGIN.left} x2={W - MARGIN.right} y1={y(tick)} y2={y(tick)} stroke="currentColor" opacity={0.12} />
            <text x={MARGIN.left - 8} y={y(tick) + 4} textAnchor="end" fontSize={11} className="fill-current opacity-70">{formatValue(tick, true)}</text>
          </g>
        ))}
        {chart.categories.map((label, index) => index % labelEvery === 0 && (
          <text key={index} x={x(index)} y={H - MARGIN.bottom + 18} textAnchor="middle" fontSize={11} className="fill-current opacity-70">
            {label.length > 14 ? `${label.slice(0, 13)}…` : label}
          </text>
        ))}
        {chart.chart_type === 'bar' && chart.series.map((series, seriesIndex) => series.values.map((value, index) => value === null ? null : (
          <rect
            key={`${seriesIndex}-${index}`}
            x={x(index) - groupWidth / 2 + seriesIndex * barWidth + 1}
            y={Math.min(y(value), y(0))}
            width={Math.max(1, barWidth - 2)}
            height={Math.abs(y(value) - y(0))}
            rx={2}
            fill={COLORS[seriesIndex % COLORS.length]}
          >
            <title>{`${chart.categories[index]} · ${series.name}: ${formatValue(value)}`}</title>
          </rect>
        )))}
        {chart.chart_type === 'line' && chart.series.map((series, seriesIndex) => {
          const points = series.values.map((value, index) => (value === null ? null : { px: x(index), py: y(value), value, index }))
          // A missing value breaks the line instead of being drawn as zero.
          const segments: Array<NonNullable<(typeof points)[number]>[]> = []
          for (const point of points) {
            if (point === null) segments.push([])
            else (segments[segments.length - 1] ?? segments[segments.push([]) - 1]).push(point)
          }
          const color = COLORS[seriesIndex % COLORS.length]
          return (
            <g key={seriesIndex}>
              {segments.filter(segment => segment.length > 1).map((segment, position) => (
                <polyline key={position} fill="none" stroke={color} strokeWidth={2.2} points={segment.map(point => `${point.px},${point.py}`).join(' ')} />
              ))}
              {points.map(point => point && (
                <circle key={point.index} cx={point.px} cy={point.py} r={3.5} fill={color}>
                  <title>{`${chart.categories[point.index]} · ${series.name}: ${formatValue(point.value)}`}</title>
                </circle>
              ))}
            </g>
          )
        })}
        <line x1={MARGIN.left} x2={W - MARGIN.right} y1={y(Math.max(lo, Math.min(0, hi)))} y2={y(Math.max(lo, Math.min(0, hi)))} stroke="currentColor" opacity={0.4} />
        {chart.x_label && <text x={MARGIN.left + plotW / 2} y={H - 8} textAnchor="middle" fontSize={11} className="fill-current opacity-60">{chart.x_label}</text>}
      </>
    )
  })()

  return (
    <figure className="rounded-xl border border-border bg-surface-elevated p-3" data-testid="chart-artifact">
      <figcaption className="mb-2 flex flex-wrap items-center gap-2">
        <span className="min-w-0 flex-1 text-body-sm font-semibold text-foreground">{chart.title}</span>
        {chart.source_id && <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-caption font-semibold text-muted-foreground">{chart.source_id}</span>}
        <button type="button" onClick={() => setShowData(value => !value)} aria-pressed={showData} className="ask-press inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-caption text-muted-foreground hover:bg-surface-muted hover:text-foreground">
          <Table2 size={12} />{t('agent.chart.data')}
        </button>
        <button type="button" onClick={download} className="ask-press inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-caption text-muted-foreground hover:bg-surface-muted hover:text-foreground">
          <Download size={12} />{t('agent.chart.download')}
        </button>
      </figcaption>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={chart.title} className="h-auto w-full text-foreground" xmlns="http://www.w3.org/2000/svg">
        {body}
      </svg>
      {chart.chart_type !== 'pie' && chart.series.length > 1 && (
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
          {chart.series.map((series, index) => (
            <li key={series.name} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLORS[index % COLORS.length] }} />{series.name}</li>
          ))}
        </ul>
      )}
      {chart.truncated && <p className="mt-1 text-caption text-warning-text">{t('agent.chart.truncated', { shown: chart.categories.length, total: chart.total_rows ?? chart.categories.length })}</p>}
      {showData && (
        <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-border">
          <table className="w-full text-caption">
            <thead className="sticky top-0 bg-surface-muted text-left">
              <tr><th className="px-2 py-1 font-semibold">{chart.x_label || ''}</th>{chart.series.map(series => <th key={series.name} className="px-2 py-1 text-right font-semibold">{series.name}</th>)}</tr>
            </thead>
            <tbody>
              {chart.categories.map((category, index) => (
                <tr key={index} className="border-t border-border">
                  <td className="px-2 py-1">{category}</td>
                  {chart.series.map(series => <td key={series.name} className="px-2 py-1 text-right tabular-nums">{series.values[index] === null || series.values[index] === undefined ? '–' : formatValue(series.values[index] as number)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </figure>
  )
}
