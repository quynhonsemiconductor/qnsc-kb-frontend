import { describe, expect, it } from 'vitest'
import { formatDateTime, formatDay, parseApiDate, toDateInputValue } from '../../src/lib/formatters'

/**
 * Every timestamp in the UI was wrong by the reader's UTC offset.
 *
 * The API stores and returns naive UTC — datetime columns carry no timezone and values
 * come from datetime.utcnow() — so a response reads `2026-08-29T09:23:23.847907`, with no
 * `Z` and no offset. ECMAScript parses a date-TIME string with no offset as LOCAL time,
 * so the browser read 09:23 UTC as 09:23 local. In Vietnam (UTC+7) a sync that started at
 * 16:58 was shown as "Started 09:58".
 *
 * These assertions compare against explicit UTC instants rather than re-deriving them, so
 * they mean the same thing on a developer machine in ICT and on a CI runner in UTC. A
 * test written as "parsing differs from new Date()" would pass locally and prove nothing
 * in CI, where the offset is zero.
 */
describe('API timestamps are read as UTC', () => {
  it('reads a naive timestamp as UTC, not as local time', () => {
    // The exact shape FastAPI emits, and the whole bug.
    expect(parseApiDate('2026-08-29T09:23:23.847907')?.getTime())
      .toBe(Date.UTC(2026, 7, 29, 9, 23, 23, 847))
  })

  it('agrees with the same instant written explicitly as UTC', () => {
    expect(parseApiDate('2026-08-29T09:23:23')?.getTime())
      .toBe(parseApiDate('2026-08-29T09:23:23Z')?.getTime())
  })

  it('honours an offset when the API does send one', () => {
    // Must not be re-stamped as UTC: that would move it by the offset.
    expect(parseApiDate('2026-08-29T09:23:23+07:00')?.getTime())
      .toBe(Date.UTC(2026, 7, 29, 2, 23, 23))
    expect(parseApiDate('2026-08-29T09:23:23-05:00')?.getTime())
      .toBe(Date.UTC(2026, 7, 29, 14, 23, 23))
  })

  it('leaves a date-only value alone', () => {
    // ECMAScript already reads this as UTC, and appending `Z` would make it invalid.
    expect(parseApiDate('2026-08-29')?.getTime()).toBe(Date.UTC(2026, 7, 29))
  })

  it('accepts a space separator, which Safari rejects outright', () => {
    expect(parseApiDate('2026-08-29 09:23:23')?.getTime())
      .toBe(Date.UTC(2026, 7, 29, 9, 23, 23))
  })

  it('returns null for nothing rather than an Invalid Date', () => {
    // Rendering "Invalid Date" is how a missing timestamp used to reach the screen.
    for (const value of [null, undefined, '', '   ', 'not a date']) {
      expect(parseApiDate(value as string | null)).toBeNull()
    }
  })
})

describe('formatting for the reader', () => {
  it('falls back instead of printing Invalid Date', () => {
    expect(formatDateTime(null)).toBe('—')
    expect(formatDay(undefined, 'No schedule set')).toBe('No schedule set')
    expect(formatDateTime('nonsense', 'Never synced')).toBe('Never synced')
  })

  it('renders a real timestamp rather than the fallback', () => {
    expect(formatDateTime('2026-08-29T09:23:23.847907')).not.toBe('—')
  })

  it('pre-fills a date input with the LOCAL day', () => {
    // Late-UTC instants are where this matters: east of Greenwich the local date has
    // already rolled over, and toISOString() would fill in yesterday.
    // en-CA renders YYYY-MM-DD in local time, deriving the expectation independently.
    const value = '2026-08-29T20:00:00'
    const local = parseApiDate(value)!.toLocaleDateString('en-CA')
    expect(toDateInputValue(value)).toBe(local)
  })

  it('gives an empty input value for nothing', () => {
    expect(toDateInputValue(null)).toBe('')
  })
})

describe('the regression itself', () => {
  it('runs in a timezone where the two readings actually differ', () => {
    // Guards the guard: in UTC this whole file would pass against the broken code.
    expect(new Date().getTimezoneOffset()).not.toBe(0)
  })

  it('the raw parse this replaced lands on a different instant', () => {
    const naive = '2026-08-29T09:23:23'
    expect(new Date(naive).getTime()).not.toBe(parseApiDate(naive)!.getTime())
    // Off by exactly the reader's offset, which is the symptom that was reported.
    // getTimezoneOffset() is UTC-minus-local, so it is negative east of Greenwich:
    // reading 09:23 UTC as 09:23 local puts the clock 7 hours BEHIND here.
    const offsetMs = new Date(naive).getTimezoneOffset() * 60_000
    expect(parseApiDate(naive)!.getTime() - new Date(naive).getTime()).toBe(-offsetMs)
  })
})
