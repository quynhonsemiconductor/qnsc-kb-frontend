import { describe, expect, it } from 'vitest'
import {
  STEP_ORDER,
  formatValue,
  isWorking,
  niceTicks,
  parseArtifacts,
  parseRegion,
  parseSteps,
  parseUnverifiedNumbers,
  pieSlices,
  stepText,
  upsertStep,
  valueRange,
} from '../../src/lib/agent'
import { dispatchAIStreamPayload } from '../../src/lib/ai-stream'
import type { AgentStep, ChartArtifact } from '../../src/types/ai'

const step = (name: string, status: AgentStep['status'], extra: Partial<AgentStep> = {}): AgentStep => ({ step: name, status, ...extra })

describe('folding streamed steps', () => {
  it('replaces a step reported again instead of listing it twice', () => {
    const once = upsertStep([], step('search', 'running'))
    const twice = upsertStep(once, step('search', 'done', { data: { hits: 3 } }))
    expect(twice).toEqual([{ step: 'search', status: 'done', data: { hits: 3 } }])
  })

  it('keeps steps in working order whatever order they arrive in', () => {
    let steps: AgentStep[] = []
    for (const name of ['verify', 'search', 'understand', 'answer']) steps = upsertStep(steps, step(name, 'done'))
    expect(steps.map(item => item.step)).toEqual(['understand', 'search', 'answer', 'verify'])
    expect(STEP_ORDER.indexOf('chart')).toBeLessThan(STEP_ORDER.indexOf('answer'))
  })

  it('puts an unknown step last and never mutates its input', () => {
    const before = [step('search', 'done')]
    const after = upsertStep(before, step('mystery', 'running'))
    expect(after.map(item => item.step)).toEqual(['search', 'mystery'])
    expect(before).toHaveLength(1)
  })

  it('knows whether anything is still running', () => {
    expect(isWorking([step('search', 'done'), step('answer', 'running')])).toBe(true)
    expect(isWorking([step('search', 'done'), step('answer', 'skipped')])).toBe(false)
  })
})

describe('reading stored steps', () => {
  it('keeps well-formed steps and drops the rest', () => {
    const parsed = parseSteps([
      { step: 'search', status: 'done', ms: 420, data: { hits: 2 } },
      { step: 'x', status: 'weird' },
      { status: 'done' },
      null,
      'text',
    ])
    expect(parsed).toEqual([{ step: 'search', status: 'done', detail: undefined, data: { hits: 2 }, ms: 420 }])
    expect(parseSteps('nope')).toEqual([])
  })

  it('never reports a stored step as still running', () => {
    expect(parseSteps([{ step: 'answer', status: 'running' }])[0].status).toBe('done')
  })
})

describe('what each step says', () => {
  const t = (key: string, vars?: Record<string, string | number>) => `${key}${vars ? JSON.stringify(vars) : ''}`

  it('says what it is doing while running', () => {
    expect(stepText(t, step('search', 'running'))).toBe('agent.step.search.running')
  })

  it('reports what the search found', () => {
    expect(stepText(t, step('search', 'done', { data: { hits: 7, sub_questions: 2 } }))).toBe('agent.step.search.done{"hits":7,"sub":2}')
  })

  it('shows the plan summary the model wrote', () => {
    expect(stepText(t, step('understand', 'done', { detail: 'So sánh hai quy trình' }))).toBe('So sánh hai quy trình')
  })

  it('names the reason a step was skipped, and falls back when it has no wording for it', () => {
    const known = (key: string) => (key === 'agent.step.figure.skipped.not_allowed' ? 'too sensitive' : key)
    expect(stepText(known, step('figure', 'skipped', { detail: 'not_allowed' }))).toBe('too sensitive')
    expect(stepText(known, step('figure', 'skipped', { detail: 'brand_new_reason' }))).toBe('agent.step.figure.skipped')
    expect(stepText(known, step('chart', 'skipped'))).toBe('agent.step.chart.skipped')
  })

  it('counts numbers that did not match when verifying', () => {
    expect(stepText(t, step('verify', 'done', { data: { unverified: 2 } }))).toBe('agent.step.verify.flagged{"count":2}')
    expect(stepText(t, step('verify', 'done', { data: { unverified: 0 } }))).toBe('agent.step.verify.done')
  })
})

describe('artifacts from the server', () => {
  const chart = { type: 'chart', id: 'c1', chart_type: 'bar', title: 'Doanh thu', x_label: 'Quý', categories: ['Q1', 'Q2'], series: [{ name: 'Doanh thu', values: [10, null] }], evidence_id: 'e', source_id: 'C1' }
  const figure = { type: 'figure_annotation', id: 'f1', evidence_id: 'e', article_id: 'a', source_id: 'C2', title: 'Sơ đồ', caption: 'Giai đoạn 2', regions: [{ x: 0.2, y: 0.3, w: 0.4, h: 0.2, label: 'GĐ2' }] }

  it('accepts a well-formed chart and figure', () => {
    const parsed = parseArtifacts([chart, figure])
    expect(parsed.map(item => item.type)).toEqual(['chart', 'figure_annotation'])
    expect((parsed[0] as ChartArtifact).series[0].values).toEqual([10, null])
  })

  it('drops anything malformed rather than failing the whole answer', () => {
    expect(parseArtifacts([{ ...chart, chart_type: 'radar' }, { ...chart, series: [] }, { ...figure, regions: [] }, { type: 'script', src: 'x' }, null, 7])).toEqual([])
    expect(parseArtifacts(undefined)).toEqual([])
    expect(parseArtifacts({ type: 'chart' })).toEqual([])
  })

  it('turns non-numbers in a series into gaps and trims to the category count', () => {
    const parsed = parseArtifacts([{ ...chart, series: [{ name: 's', values: [1, 'x', Infinity, 4] }] }])
    expect((parsed[0] as ChartArtifact).series[0].values).toEqual([1, null])
  })

  it('keeps a region only if it is a rectangle inside the picture, clamping its far edge', () => {
    expect(parseRegion({ x: 0.9, y: 0.1, w: 0.5, h: 0.2, label: 'a' })).toEqual({ x: 0.9, y: 0.1, w: 0.09999999999999998, h: 0.2, label: 'a' })
    for (const bad of [{ x: -0.1, y: 0, w: 0.2, h: 0.2 }, { x: 0, y: 0, w: 0, h: 0.2 }, { x: 2, y: 0, w: 0.1, h: 0.1 }, { x: 'a', y: 0, w: 0.1, h: 0.1 }, null]) {
      expect(parseRegion(bad)).toBeNull()
    }
  })

  it('reads the unverified numbers, at most ten, strings only', () => {
    expect(parseUnverifiedNumbers(['1244', 5, '9%'])).toEqual(['1244', '9%'])
    expect(parseUnverifiedNumbers(Array.from({ length: 20 }, (_, i) => `${i}00`))).toHaveLength(10)
    expect(parseUnverifiedNumbers(null)).toEqual([])
  })
})

describe('chart geometry', () => {
  it('chooses round axis ticks that cover the data', () => {
    const ticks = niceTicks(0, 1800)
    expect(ticks[0]).toBeLessThanOrEqual(0)
    expect(ticks[ticks.length - 1]).toBeGreaterThanOrEqual(1800)
    expect(ticks).toEqual([0, 500, 1000, 1500, 2000])
  })

  it('copes with a flat or empty range', () => {
    expect(niceTicks(5, 5).length).toBeGreaterThanOrEqual(2)
    expect(niceTicks(Number.NaN, 3)).toEqual([0])
  })

  const base: ChartArtifact = { type: 'chart', id: 'c', chart_type: 'bar', title: '', x_label: '', categories: ['a', 'b'], series: [{ name: 's', values: [120, 180] }], evidence_id: 'e', source_id: '' }

  it('starts bars at zero but lets a line zoom to its data', () => {
    expect(valueRange(base)).toEqual({ min: 0, max: 180 })
    expect(valueRange({ ...base, chart_type: 'line' })).toEqual({ min: 120, max: 180 })
    expect(valueRange({ ...base, series: [{ name: 's', values: [null, null] }] })).toEqual({ min: 0, max: 1 })
  })

  it('splits a pie by share and skips missing and negative values', () => {
    const slices = pieSlices([1, 3, null, -2])
    expect(slices[0]?.share).toBeCloseTo(0.25)
    expect(slices[1]?.share).toBeCloseTo(0.75)
    expect(slices[2]).toBeNull()
    expect(slices[3]).toBeNull()
    expect(slices[1]?.end).toBeCloseTo(Math.PI * 2)
    expect(pieSlices([0, null])).toEqual([null, null])
  })

  it('formats numbers the Vietnamese way, short on an axis', () => {
    expect(formatValue(1234.5)).toBe('1.234,5')
    expect(formatValue(2_500_000, true)).toBe('2,5 tr')
    expect(formatValue(3_000_000_000, true)).toBe('3 tỷ')
    expect(formatValue(Number.NaN)).toBe('')
  })
})

describe('the stream', () => {
  it('hands a step event to the step handler and no other', () => {
    const received: AgentStep[] = []
    const handlers = { onToken: () => undefined, onSources: () => undefined, onDone: () => undefined, onStep: (item: AgentStep) => received.push(item) }
    dispatchAIStreamPayload({ type: 'step', step: 'search', status: 'running', data: { queries: ['a'] } }, handlers)
    expect(received).toEqual([{ step: 'search', status: 'running', detail: undefined, data: { queries: ['a'] } }])
  })

  it('ignores a step event when nobody listens for it', () => {
    expect(() => dispatchAIStreamPayload({ type: 'step', step: 'search', status: 'done' }, { onToken: () => undefined, onSources: () => undefined, onDone: () => undefined })).not.toThrow()
  })
})
