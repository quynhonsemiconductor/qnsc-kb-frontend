import { describe, expect, it } from 'vitest'
import {
  QUEUE_PAGE_SIZE,
  appendPage,
  formatQueueCount,
  hasMore,
  parseTotalCount,
  refreshFirstPage,
} from '../../src/utils/draftQueue'

const rows = (from: number, to: number) =>
  Array.from({ length: to - from }, (_, index) => ({ id: `d${from + index}`, status: 'old' }))

describe('parseTotalCount', () => {
  it('reads the header the API sends', () => {
    expect(parseTotalCount('534')).toBe(534)
    expect(parseTotalCount(534)).toBe(534)
    expect(parseTotalCount('0')).toBe(0)
  })

  it('treats a missing or unusable header as "the server did not say"', () => {
    // An API that predates paging sends no header; that must not read as 0 or as the row count.
    for (const raw of [undefined, null, '', 'abc', '-3', '1.5x', NaN]) {
      expect(parseTotalCount(raw)).toBeNull()
    }
  })
})

describe('hasMore', () => {
  it('is true only while the server has rows that are not loaded', () => {
    expect(hasMore(500, 534)).toBe(true)
    expect(hasMore(534, 534)).toBe(false)
    expect(hasMore(0, 0)).toBe(false)
  })

  it('is false when the total is unknown, so an older API never shows a pager', () => {
    expect(hasMore(500, null)).toBe(false)
  })
})

describe('appendPage', () => {
  it('adds the next page after what is loaded', () => {
    expect(appendPage(rows(0, 3), rows(3, 5)).map(item => item.id)).toEqual(['d0', 'd1', 'd2', 'd3', 'd4'])
  })

  it('skips a row the shifting offset served twice', () => {
    // Drafts decided between two requests move the window; d2 comes back on the next page.
    const merged = appendPage(rows(0, 3), rows(2, 5))
    expect(merged.map(item => item.id)).toEqual(['d0', 'd1', 'd2', 'd3', 'd4'])
  })

  it('does not mutate its inputs', () => {
    const current = rows(0, 2)
    const incoming = rows(2, 4)
    appendPage(current, incoming)
    expect(current).toHaveLength(2)
    expect(incoming).toHaveLength(2)
  })
})

describe('refreshFirstPage', () => {
  it('replaces the head so a polled status change shows up', () => {
    const current = [{ id: 'a', status: 'processing' }, { id: 'b', status: 'ready' }]
    const polled = [{ id: 'a', status: 'ready' }, { id: 'b', status: 'ready' }]
    expect(refreshFirstPage(current, polled, 2)).toEqual(polled)
  })

  it('keeps rows loaded beyond the first page instead of discarding them every poll', () => {
    const current = rows(0, 7) // a first page of 5, plus two loaded further down
    const polled = rows(0, 5).map(item => ({ ...item, status: 'new' }))

    const merged = refreshFirstPage(current, polled, 5)

    expect(merged.map(item => item.id)).toEqual(['d0', 'd1', 'd2', 'd3', 'd4', 'd5', 'd6'])
    expect(merged.slice(0, 5).every(item => item.status === 'new')).toBe(true)
    expect(merged.slice(5).every(item => item.status === 'old')).toBe(true)
  })

  it('does not repeat a row the new first page now covers', () => {
    // d5 used to be on page 2; after other drafts left the queue it moved onto page 1.
    const current = rows(0, 7)
    const polled = [...rows(0, 4), { id: 'd5', status: 'new' }]

    const ids = refreshFirstPage(current, polled, 5).map(item => item.id)

    expect(ids.filter(id => id === 'd5')).toHaveLength(1)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('defaults to the API page size', () => {
    const current = rows(0, QUEUE_PAGE_SIZE + 3)
    const polled = rows(0, QUEUE_PAGE_SIZE)
    expect(refreshFirstPage(current, polled)).toHaveLength(QUEUE_PAGE_SIZE + 3)
  })
})

describe('formatQueueCount', () => {
  it('marks a count as a lower bound while rows are still unloaded', () => {
    expect(formatQueueCount(120, true)).toBe('120+')
    expect(formatQueueCount(120, false)).toBe('120')
    expect(formatQueueCount(0, false)).toBe('0')
  })
})
