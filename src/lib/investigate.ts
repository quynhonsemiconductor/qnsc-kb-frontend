import type { FailureGroup, Level } from '../api/investigate'
import { parseApiDate } from './formatters'

// Everything the Investigate view decides that does not need a DOM lives here, so it can be tested
// without rendering: number wording, which direction of change is bad, chart geometry, URL state.

export const WINDOW_OPTIONS = [1, 6, 24, 72, 168] as const
export type WindowHours = (typeof WINDOW_OPTIONS)[number]
export const DEFAULT_WINDOW: WindowHours = 24

export const HEALTH_TABS = ['overview', 'investigate', 'quality'] as const
export type HealthTab = (typeof HEALTH_TABS)[number]

/** The backend's own pattern for a request id (src/api/main.py), so a typo is caught before a lookup. */
export const REQUEST_ID_PATTERN = /^[A-Za-z0-9._-]{1,100}$/

export function isValidRequestId(value: string): boolean {
  return REQUEST_ID_PATTERN.test(value.trim())
}

// ── numbers ───────────────────────────────────────────────────────────────────────────────

export function formatDuration(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || Number.isNaN(ms)) return '—'
  if (ms < 1) return '<1 ms'
  if (ms < 1000) return `${Math.round(ms)} ms`
  if (ms < 60_000) return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`
  return `${(ms / 60_000).toFixed(1)} min`
}

/** 1,234 -> "1.2K". Small numbers stay exact: a count of 7 must not read as "7.0". */
export function formatCount(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  const abs = Math.abs(value)
  if (abs < 1000) return String(Math.round(value))
  if (abs < 1_000_000) return `${(value / 1000).toFixed(abs < 10_000 ? 1 : 0)}K`
  if (abs < 1_000_000_000) return `${(value / 1_000_000).toFixed(abs < 10_000_000 ? 1 : 0)}M`
  return `${(value / 1_000_000_000).toFixed(1)}B`
}

export function formatRate(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—'
  return `${value.toFixed(digits)}%`
}

export type Tone = 'good' | 'bad' | 'neutral'
export type Direction = 'up' | 'down' | 'flat' | 'none'

/**
 * How a change should be read. `worseWhen` says which way is bad for THIS figure: more errors is
 * bad, more traffic is just traffic. A move smaller than `epsilon` is flat, so a 0.2% wobble does
 * not paint a card red. A missing change (no earlier window to compare with) is `none`.
 */
export function trend(
  change: number | null | undefined,
  worseWhen: 'up' | 'down' | 'none',
  epsilon = 0.5,
): { direction: Direction; tone: Tone } {
  if (change === null || change === undefined || Number.isNaN(change)) return { direction: 'none', tone: 'neutral' }
  if (Math.abs(change) < epsilon) return { direction: 'flat', tone: 'neutral' }
  const direction: Direction = change > 0 ? 'up' : 'down'
  if (worseWhen === 'none') return { direction, tone: 'neutral' }
  return { direction, tone: direction === worseWhen ? 'bad' : 'good' }
}

export function formatChange(change: number | null | undefined, unit: '%' | 'pp'): string {
  if (change === null || change === undefined || Number.isNaN(change)) return '—'
  const sign = change > 0 ? '+' : change < 0 ? '−' : ''
  const magnitude = Math.abs(change)
  const text = magnitude >= 100 ? magnitude.toFixed(0) : magnitude.toFixed(1)
  return unit === 'pp' ? `${sign}${text} pp` : `${sign}${text}%`
}

// ── time ──────────────────────────────────────────────────────────────────────────────────

/** A short label for one chart bucket: the time of day for sub-day buckets, the date otherwise. */
export function bucketLabel(iso: string, bucketSeconds: number, locale?: string): string {
  const date = parseApiDate(iso)
  if (!date) return ''
  if (bucketSeconds >= 86_400) return date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
  const time = date.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
  // Across more than one day the time alone is ambiguous, so the date comes with it.
  return bucketSeconds >= 3600
    ? `${date.toLocaleDateString(locale, { month: 'short', day: 'numeric' })} ${time}`
    : time
}

// ── chart geometry ────────────────────────────────────────────────────────────────────────

/** Round a maximum UP to 1, 2 or 5 times a power of ten, so an axis ends on a readable number. */
export function niceMax(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 1
  const power = 10 ** Math.floor(Math.log10(value))
  const fraction = value / power
  const step = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10
  return step * power
}

export interface Rect { x: number; y: number; width: number; height: number }
export interface Pt { x: number; y: number }

/** One bar per value, filling `width` with `gap` between them. A zero value is a zero-height bar. */
export function barRects(values: number[], width: number, height: number, max: number, gap = 1): Rect[] {
  if (values.length === 0) return []
  const slot = width / values.length
  const barWidth = Math.max(1, slot - gap)
  const top = max > 0 ? max : 1
  return values.map((value, index) => {
    const h = Math.max(0, Math.min(1, value / top)) * height
    return { x: index * slot + (slot - barWidth) / 2, y: height - h, width: barWidth, height: h }
  })
}

/** Points for a line at the CENTRE of each bar's slot, so a line and bars line up. Null = a gap. */
export function linePoints(values: Array<number | null>, width: number, height: number, max: number): Array<Pt | null> {
  if (values.length === 0) return []
  const slot = width / values.length
  const top = max > 0 ? max : 1
  return values.map((value, index) =>
    value === null || Number.isNaN(value)
      ? null
      : { x: index * slot + slot / 2, y: height - Math.max(0, Math.min(1, value / top)) * height },
  )
}

/** An SVG path through the points. A null starts a new segment rather than drawing across the gap. */
export function pathFromPoints(points: Array<Pt | null>): string {
  let path = ''
  let drawing = false
  for (const point of points) {
    if (!point) {
      drawing = false
      continue
    }
    path += `${drawing ? 'L' : 'M'}${point.x.toFixed(1)} ${point.y.toFixed(1)} `
    drawing = true
  }
  return path.trim()
}

// ── failures ──────────────────────────────────────────────────────────────────────────────

export function groupKey(group: Pick<FailureGroup, 'method' | 'path' | 'status_code' | 'error_type'>): string {
  return `${group.method} ${group.path} ${group.status_code} ${group.error_type ?? ''}`
}

/**
 * The line worth reading first from a stored traceback. The backend stores the message, then the
 * traceback; the message is the first non-empty line.
 */
export function errorHeadline(detail: string | null | undefined, max = 160): string {
  const line = (detail ?? '').split('\n').map((item) => item.trim()).find(Boolean) ?? ''
  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}

/** A request id shortened for a table cell. The full id stays available for copying. */
export function shortId(id: string, keep = 8): string {
  return id.length > keep + 1 ? `${id.slice(0, keep)}…` : id
}

// ── tone of a verdict ─────────────────────────────────────────────────────────────────────

export function levelTone(level: Level | undefined): 'success' | 'warning' | 'danger' | 'default' {
  if (level === 'ok') return 'success'
  if (level === 'warning') return 'warning'
  if (level === 'critical') return 'danger'
  return 'default'
}

const WORKER_TONE: Record<string, 'success' | 'warning' | 'danger'> = {
  healthy: 'success',
  busy: 'success',
  inline_mode: 'success',
  queue_unconsumed: 'danger',
  no_consumer: 'danger',
  broker_unreachable: 'danger',
}

export function workerTone(verdict: string | undefined): 'success' | 'warning' | 'danger' {
  return (verdict && WORKER_TONE[verdict]) || 'warning'
}

/** The worst of several levels, so one banner can speak for the whole system. */
export function worstLevel(levels: Array<Level | undefined>): Level {
  if (levels.includes('critical')) return 'critical'
  if (levels.includes('warning')) return 'warning'
  return 'ok'
}

// ── URL state ─────────────────────────────────────────────────────────────────────────────

export interface HealthLocation {
  tab: HealthTab
  windowHours: WindowHours
  requestId: string
}

/**
 * Read the page state out of a query string, accepting only values the page understands. The state
 * is in the URL so an investigation can be linked: "look at this failing request" is one paste.
 */
export function parseHealthSearch(search: string): HealthLocation {
  const params = new URLSearchParams(search)
  const tab = params.get('tab')
  const hours = Number(params.get('window'))
  const requestId = (params.get('request') ?? '').trim()
  return {
    tab: (HEALTH_TABS as readonly string[]).includes(tab ?? '') ? (tab as HealthTab) : 'overview',
    windowHours: (WINDOW_OPTIONS as readonly number[]).includes(hours) ? (hours as WindowHours) : DEFAULT_WINDOW,
    requestId: isValidRequestId(requestId) ? requestId : '',
  }
}

/** The inverse of `parseHealthSearch`. Defaults are omitted, so the common URL stays clean. */
export function buildHealthSearch(state: Partial<HealthLocation>): string {
  const params = new URLSearchParams()
  if (state.tab && state.tab !== 'overview') params.set('tab', state.tab)
  if (state.windowHours && state.windowHours !== DEFAULT_WINDOW) params.set('window', String(state.windowHours))
  if (state.requestId && isValidRequestId(state.requestId)) params.set('request', state.requestId.trim())
  const text = params.toString()
  return text ? `?${text}` : ''
}
