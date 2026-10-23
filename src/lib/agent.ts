/**
 * Pure helpers for the agent's progress and artifacts, kept apart from the components so the
 * rules can be tested without rendering anything.
 */
import type { AgentArtifact, AgentStep, ChartArtifact, FigureArtifact, FigureRegion } from '../types/ai'

// ── steps ──────────────────────────────────────────────────────────────────────────────────

/** The order the agent works in; a step it did not report is simply absent. */
export const STEP_ORDER = ['understand', 'search', 'review', 'chart', 'figure', 'answer', 'verify'] as const

/**
 * Fold one streamed step into the list: a step reported again (running, then done) replaces
 * its earlier entry in place, a new one is appended, and the list is kept in working order.
 * The input is not mutated.
 */
export function upsertStep(steps: AgentStep[], incoming: AgentStep): AgentStep[] {
  const index = steps.findIndex(item => item.step === incoming.step)
  const next = index === -1 ? [...steps, incoming] : steps.map((item, position) => (position === index ? { ...item, ...incoming } : item))
  const rank = (name: string) => {
    const found = STEP_ORDER.indexOf(name as (typeof STEP_ORDER)[number])
    return found === -1 ? STEP_ORDER.length : found
  }
  return [...next].sort((a, b) => rank(a.step) - rank(b.step))
}

/** Whether any step is still running. */
export const isWorking = (steps: AgentStep[]): boolean => steps.some(item => item.status === 'running')

/** Reads steps back from a stored message, dropping anything malformed. */
export function parseSteps(raw: unknown): AgentStep[] {
  if (!Array.isArray(raw)) return []
  const steps: AgentStep[] = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue
    const { step, status, detail, data, ms } = item as Record<string, unknown>
    if (typeof step !== 'string' || !['running', 'done', 'skipped', 'failed'].includes(String(status))) continue
    steps.push({
      step,
      // A stored step cannot still be running: the answer it belongs to is finished.
      status: status === 'running' ? 'done' : (status as AgentStep['status']),
      detail: typeof detail === 'string' ? detail : undefined,
      data: data && typeof data === 'object' ? (data as Record<string, unknown>) : undefined,
      ms: typeof ms === 'number' ? ms : undefined,
    })
  }
  return steps
}

type Translate = (key: string, vars?: Record<string, string | number>) => string

/** What a step says about itself, from the step id, its state and what it reported. */
export function stepText(t: Translate, step: AgentStep): string {
  const data = step.data || {}
  const key = (suffix: string) => `agent.step.${step.step}.${suffix}`
  if (step.status === 'skipped') {
    const reason = step.detail ? t(key(`skipped.${step.detail}`)) : ''
    return reason && reason !== key(`skipped.${step.detail}`) ? reason : t(key('skipped'))
  }
  if (step.status === 'running') return t(key('running'))
  if (step.step === 'understand' && step.detail) return step.detail
  if (step.step === 'search') {
    return t(key('done'), { hits: Number(data.hits ?? 0), sub: Number(data.sub_questions ?? 1) })
  }
  if (step.step === 'verify') {
    const unverified = Number(data.unverified ?? 0)
    return unverified > 0 ? t(key('flagged'), { count: unverified }) : t(key('done'))
  }
  return t(key('done'))
}

// ── artifacts ──────────────────────────────────────────────────────────────────────────────

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)

function parseChart(item: Record<string, unknown>): ChartArtifact | null {
  const chartType = item.chart_type
  if (chartType !== 'bar' && chartType !== 'line' && chartType !== 'pie') return null
  if (!Array.isArray(item.categories) || !Array.isArray(item.series) || item.series.length === 0) return null
  const categories = item.categories.map(value => String(value ?? ''))
  const series = []
  for (const entry of item.series) {
    const candidate = entry as Record<string, unknown> | null
    if (!candidate || typeof candidate.name !== 'string' || !Array.isArray(candidate.values)) return null
    series.push({ name: candidate.name, values: candidate.values.slice(0, categories.length).map(value => (finite(value) ? value : null)) })
  }
  return {
    type: 'chart',
    id: String(item.id ?? ''),
    chart_type: chartType,
    title: String(item.title ?? ''),
    x_label: String(item.x_label ?? ''),
    categories,
    series,
    evidence_id: String(item.evidence_id ?? ''),
    source_id: String(item.source_id ?? ''),
    truncated: Boolean(item.truncated),
    total_rows: finite(item.total_rows) ? item.total_rows : undefined,
  }
}

/** A region the server sent, only if it is a sensible rectangle inside the picture. */
export function parseRegion(raw: unknown): FigureRegion | null {
  const item = raw as Record<string, unknown> | null
  if (!item || !finite(item.x) || !finite(item.y) || !finite(item.w) || !finite(item.h)) return null
  const { x, y } = item
  if (x < 0 || y < 0 || x > 1 || y > 1 || item.w <= 0 || item.h <= 0) return null
  return { x, y, w: Math.min(item.w, 1 - x), h: Math.min(item.h, 1 - y), label: typeof item.label === 'string' ? item.label.slice(0, 60) : '' }
}

function parseFigure(item: Record<string, unknown>): FigureArtifact | null {
  if (typeof item.evidence_id !== 'string' || typeof item.article_id !== 'string') return null
  const regions = (Array.isArray(item.regions) ? item.regions : []).map(parseRegion).filter((region): region is FigureRegion => region !== null)
  if (regions.length === 0) return null
  return {
    type: 'figure_annotation',
    id: String(item.id ?? ''),
    evidence_id: item.evidence_id,
    article_id: item.article_id,
    source_id: String(item.source_id ?? ''),
    title: String(item.title ?? ''),
    caption: String(item.caption ?? ''),
    regions,
  }
}

/** Artifacts from the stream or from a stored message, keeping only well-formed ones. */
export function parseArtifacts(raw: unknown): AgentArtifact[] {
  if (!Array.isArray(raw)) return []
  const out: AgentArtifact[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const item = entry as Record<string, unknown>
    const parsed = item.type === 'chart' ? parseChart(item) : item.type === 'figure_annotation' ? parseFigure(item) : null
    if (parsed) out.push(parsed)
  }
  return out
}

/** Numbers the backend flagged as appearing in no cited source. */
export function parseUnverifiedNumbers(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((item): item is string => typeof item === 'string').slice(0, 10) : []
}

// ── chart geometry ─────────────────────────────────────────────────────────────────────────

/** Axis tick values that land on round numbers and include the range. */
export function niceTicks(min: number, max: number, count = 5): number[] {
  if (!finite(min) || !finite(max)) return [0]
  if (min === max) return [min === 0 ? 0 : Math.min(0, min), max === 0 ? 1 : Math.max(0, max)]
  const span = max - min
  const rough = span / Math.max(1, count - 1)
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const fraction = rough / magnitude
  const step = (fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10) * magnitude
  const first = Math.floor(min / step) * step
  const last = Math.ceil(max / step) * step
  const ticks: number[] = []
  for (let value = first; value <= last + step / 2; value += step) ticks.push(Number(value.toFixed(10)))
  return ticks
}

/** The value range a chart's y axis must cover: bars start at zero, lines may not. */
export function valueRange(chart: ChartArtifact): { min: number; max: number } {
  const values = chart.series.flatMap(item => item.values).filter(finite)
  if (values.length === 0) return { min: 0, max: 1 }
  const min = Math.min(...values)
  const max = Math.max(...values)
  return chart.chart_type === 'line' ? { min, max } : { min: Math.min(0, min), max: Math.max(0, max) }
}

/** Pie slices as start/end angles in radians from 12 o'clock, ignoring missing and negative values. */
export function pieSlices(values: Array<number | null>): Array<{ index: number; value: number; start: number; end: number; share: number } | null> {
  const positive = values.map(value => (finite(value) && value > 0 ? value : 0))
  const total = positive.reduce((sum, value) => sum + value, 0)
  let angle = 0
  return positive.map((value, index) => {
    if (value === 0 || total === 0) return null
    const start = angle
    angle += (value / total) * Math.PI * 2
    return { index, value, start, end: angle, share: value / total }
  })
}

/** A number as a reader of Vietnamese expects it, short on an axis and full in a tooltip. */
export function formatValue(value: number, compact = false): string {
  if (!finite(value)) return ''
  if (compact && Math.abs(value) >= 1_000_000_000) return `${formatValue(value / 1_000_000_000)} tỷ`
  if (compact && Math.abs(value) >= 1_000_000) return `${formatValue(value / 1_000_000)} tr`
  return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value)
}
