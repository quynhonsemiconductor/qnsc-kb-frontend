import { describe, expect, it } from 'vitest'
import { shouldTick } from '../../src/hooks/usePolling'

/**
 * Status banners reported whatever had been true when the page loaded: a connector that
 * finished authorizing, a sync that completed, an article that finished indexing all
 * needed a manual reload to appear. usePolling refreshes them in place.
 *
 * The three guards below are the whole policy, and each exists to stop polling being
 * worse than the staleness it fixes.
 */
describe('polling policy', () => {
  const state = { active: true, hidden: false, inFlight: false }

  it('refreshes while the screen is showing something in progress', () => {
    expect(shouldTick(state)).toBe(true)
  })

  it('stops once the caller says there is nothing in flight to watch', () => {
    expect(shouldTick({ ...state, active: false })).toBe(false)
  })

  it('does not poll a tab nobody is looking at', () => {
    // Status screens are exactly the ones people leave open in a background tab.
    expect(shouldTick({ ...state, hidden: true })).toBe(false)
  })

  it('does not stack a second request on a slow one', () => {
    // A request slower than the interval would otherwise overlap itself, turning a
    // refresh into a stampede against an API that is already struggling.
    expect(shouldTick({ ...state, inFlight: true })).toBe(false)
  })

  it('needs every condition, not just one', () => {
    expect(shouldTick({ active: false, hidden: true, inFlight: true })).toBe(false)
    expect(shouldTick({ active: true, hidden: true, inFlight: false })).toBe(false)
  })
})
