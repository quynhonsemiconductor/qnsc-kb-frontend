import { describe, expect, it } from 'vitest'
import {
  barRects,
  bucketLabel,
  buildHealthSearch,
  DEFAULT_WINDOW,
  errorHeadline,
  formatChange,
  formatCount,
  formatDuration,
  formatRate,
  groupKey,
  isValidRequestId,
  levelTone,
  linePoints,
  niceMax,
  parseHealthSearch,
  pathFromPoints,
  shortId,
  trend,
  workerTone,
  worstLevel,
} from './investigate'

describe('number wording', () => {
  it('shows durations in the unit a person reads them in', () => {
    expect(formatDuration(null)).toBe('—')
    expect(formatDuration(undefined)).toBe('—')
    expect(formatDuration(0.4)).toBe('<1 ms')
    expect(formatDuration(87.6)).toBe('88 ms')
    expect(formatDuration(1500)).toBe('1.50 s')
    expect(formatDuration(12_400)).toBe('12.4 s')
    expect(formatDuration(90_000)).toBe('1.5 min')
  })

  it('keeps small counts exact and compacts large ones', () => {
    expect(formatCount(7)).toBe('7')
    expect(formatCount(999)).toBe('999')
    expect(formatCount(1234)).toBe('1.2K')
    expect(formatCount(15_300)).toBe('15K')
    expect(formatCount(2_500_000)).toBe('2.5M')
    expect(formatCount(null)).toBe('—')
  })

  it('formats rates and tolerates a missing one', () => {
    expect(formatRate(2.345)).toBe('2.3%')
    expect(formatRate(2.345, 2)).toBe('2.35%')
    expect(formatRate(null)).toBe('—')
  })
})

describe('reading a change', () => {
  it('colours a change by whether that direction is bad for this figure', () => {
    expect(trend(12, 'up')).toEqual({ direction: 'up', tone: 'bad' }) // more errors
    expect(trend(-12, 'up')).toEqual({ direction: 'down', tone: 'good' })
    expect(trend(12, 'none')).toEqual({ direction: 'up', tone: 'neutral' }) // more traffic is just traffic
    expect(trend(-8, 'down')).toEqual({ direction: 'down', tone: 'bad' })
  })

  it('does not paint a wobble, and says so when there is nothing to compare', () => {
    expect(trend(0.2, 'up')).toEqual({ direction: 'flat', tone: 'neutral' })
    expect(trend(null, 'up')).toEqual({ direction: 'none', tone: 'neutral' })
    expect(trend(undefined, 'up')).toEqual({ direction: 'none', tone: 'neutral' })
  })

  it('writes signed changes, in percent or percentage points', () => {
    expect(formatChange(12.34, '%')).toBe('+12.3%')
    expect(formatChange(-3, '%')).toBe('−3.0%')
    expect(formatChange(250, '%')).toBe('+250%')
    expect(formatChange(1.5, 'pp')).toBe('+1.5 pp')
    expect(formatChange(0, '%')).toBe('0.0%')
    expect(formatChange(null, 'pp')).toBe('—')
  })
})

describe('chart geometry', () => {
  it('rounds an axis maximum up to a readable number', () => {
    expect(niceMax(0)).toBe(1)
    expect(niceMax(-4)).toBe(1)
    expect(niceMax(Number.NaN)).toBe(1)
    expect(niceMax(7)).toBe(10)
    expect(niceMax(130)).toBe(200)
    expect(niceMax(430)).toBe(500)
    expect(niceMax(501)).toBe(1000)
    expect(niceMax(2)).toBe(2)
  })

  it('draws one bar per value, scaled to the maximum, inside the width', () => {
    const bars = barRects([0, 5, 10], 90, 100, 10, 2)
    expect(bars).toHaveLength(3)
    expect(bars[0].height).toBe(0)
    expect(bars[1].height).toBe(50)
    expect(bars[2]).toMatchObject({ y: 0, height: 100 })
    for (const bar of bars) {
      expect(bar.x).toBeGreaterThanOrEqual(0)
      expect(bar.x + bar.width).toBeLessThanOrEqual(90)
    }
    expect(barRects([], 90, 100, 10)).toEqual([])
  })

  it('never draws a bar taller than the chart, whatever the data', () => {
    expect(barRects([500], 10, 100, 10)[0].height).toBe(100)
    expect(barRects([5], 10, 100, 0)[0].height).toBeLessThanOrEqual(100)
  })

  it('places line points at the centre of each bar slot and leaves gaps for nulls', () => {
    const points = linePoints([10, null, 5], 90, 100, 10)
    expect(points[0]).toEqual({ x: 15, y: 0 })
    expect(points[1]).toBeNull()
    expect(points[2]).toEqual({ x: 75, y: 50 })
  })

  it('starts a new path segment after a gap instead of joining across it', () => {
    const path = pathFromPoints([{ x: 1, y: 2 }, { x: 3, y: 4 }, null, { x: 7, y: 8 }])
    expect(path).toBe('M1.0 2.0 L3.0 4.0 M7.0 8.0')
    expect(pathFromPoints([null, null])).toBe('')
  })

  it('labels a bucket by time of day, or by date once buckets are a day wide', () => {
    expect(bucketLabel('2026-11-02T08:05:00', 60, 'en-GB')).toMatch(/\d{2}:\d{2}/)
    expect(bucketLabel('2026-11-02T08:00:00', 86_400, 'en-US')).toMatch(/Nov/)
    expect(bucketLabel('not a date', 60)).toBe('')
  })
})

describe('failures', () => {
  it('identifies a group by what failed and how', () => {
    const group = { method: 'POST', path: '/upload-source', status_code: 500, error_type: 'ValueError' }
    expect(groupKey(group)).toBe('POST /upload-source 500 ValueError')
    expect(groupKey({ ...group, error_type: null })).toBe('POST /upload-source 500 ')
    expect(groupKey(group)).not.toBe(groupKey({ ...group, status_code: 502 }))
  })

  it('takes the first real line of a traceback as its headline', () => {
    expect(errorHeadline('\n  \nValueError: bad value\n\nTraceback (most recent call last):')).toBe('ValueError: bad value')
    expect(errorHeadline(null)).toBe('')
    expect(errorHeadline('x'.repeat(300), 20)).toHaveLength(20)
    expect(errorHeadline('x'.repeat(300), 20).endsWith('…')).toBe(true)
  })

  it('shortens a request id for a table cell only when it is long', () => {
    expect(shortId('0f3a9c1e-77aa-4b12-9d00-aaaaaaaaaaaa')).toBe('0f3a9c1e…')
    expect(shortId('req-1')).toBe('req-1')
  })

  it('accepts exactly the request ids the server would', () => {
    expect(isValidRequestId('0f3a9c1e-77aa-4b12-9d00-aaaaaaaaaaaa')).toBe(true)
    expect(isValidRequestId(' req_1.2-x ')).toBe(true)
    expect(isValidRequestId('')).toBe(false)
    expect(isValidRequestId('has space')).toBe(false)
    expect(isValidRequestId('a/b')).toBe(false)
    expect(isValidRequestId('x'.repeat(101))).toBe(false)
    expect(isValidRequestId('x'.repeat(100))).toBe(true)
  })
})

describe('verdict tone', () => {
  it('maps a level to a badge tone', () => {
    expect(levelTone('ok')).toBe('success')
    expect(levelTone('warning')).toBe('warning')
    expect(levelTone('critical')).toBe('danger')
    expect(levelTone(undefined)).toBe('default')
  })

  it('treats a queue nobody consumes as broken, and an unknown verdict as worth a look', () => {
    expect(workerTone('healthy')).toBe('success')
    expect(workerTone('busy')).toBe('success')
    expect(workerTone('no_consumer')).toBe('danger')
    expect(workerTone('queue_unconsumed')).toBe('danger')
    expect(workerTone('broker_unreachable')).toBe('danger')
    expect(workerTone('something_new')).toBe('warning')
    expect(workerTone(undefined)).toBe('warning')
  })

  it('lets the worst level speak for the whole system', () => {
    expect(worstLevel([])).toBe('ok')
    expect(worstLevel(['ok', undefined])).toBe('ok')
    expect(worstLevel(['ok', 'warning'])).toBe('warning')
    expect(worstLevel(['warning', 'critical', 'ok'])).toBe('critical')
  })
})

describe('page state in the URL', () => {
  it('falls back to the defaults for anything it does not understand', () => {
    expect(parseHealthSearch('')).toEqual({ tab: 'overview', windowHours: DEFAULT_WINDOW, requestId: '' })
    expect(parseHealthSearch('?tab=hack&window=13&request=a b')).toEqual({
      tab: 'overview',
      windowHours: DEFAULT_WINDOW,
      requestId: '',
    })
  })

  it('reads a linked investigation', () => {
    expect(parseHealthSearch('?tab=investigate&window=168&request=req-77')).toEqual({
      tab: 'investigate',
      windowHours: 168,
      requestId: 'req-77',
    })
  })

  it('writes only what differs from the defaults, and round-trips', () => {
    expect(buildHealthSearch({})).toBe('')
    expect(buildHealthSearch({ tab: 'overview', windowHours: DEFAULT_WINDOW })).toBe('')
    expect(buildHealthSearch({ tab: 'investigate' })).toBe('?tab=investigate')
    const state = { tab: 'investigate' as const, windowHours: 6 as const, requestId: 'req-1' }
    expect(parseHealthSearch(buildHealthSearch(state))).toEqual(state)
  })

  it('never writes a request id the server would reject', () => {
    expect(buildHealthSearch({ tab: 'investigate', requestId: 'not valid!' })).toBe('?tab=investigate')
  })
})
