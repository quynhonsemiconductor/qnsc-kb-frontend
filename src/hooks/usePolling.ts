import { useEffect, useRef } from 'react'

/**
 * Decide whether a scheduled tick should actually run.
 *
 * Pulled out of the hook so the policy is testable without a React renderer, and so the
 * three rules stay visible in one place:
 *
 * - `active` lets a caller poll only while something is genuinely in progress, so a
 *   settled screen costs nothing.
 * - `hidden` stops a background tab polling forever. Status screens are exactly the ones
 *   people leave open, and a tab nobody is looking at should not keep asking.
 * - `inFlight` prevents pile-up. A request slower than the interval would otherwise
 *   overlap itself, and on a struggling API that turns a refresh into a stampede.
 */
export function shouldTick(state: { active: boolean; hidden: boolean; inFlight: boolean }): boolean {
  return state.active && !state.hidden && !state.inFlight
}

/**
 * Re-run `tick` on an interval while `active`, so status shown on screen keeps up with
 * status on the server without the reader reloading the page.
 *
 * Polling pauses while the tab is hidden and runs once immediately when it becomes
 * visible again: coming back to a stale tab is precisely when the old value is most
 * misleading, and waiting out a full interval to correct it is what makes an interface
 * feel broken.
 *
 * `tick` is held in a ref, so callers can pass an inline closure over fresh state
 * without memoising it and without restarting the timer on every render.
 */
export function usePolling(tick: () => void | Promise<void>, intervalMs: number, active = true): void {
  const latest = useRef(tick)
  latest.current = tick

  useEffect(() => {
    if (!active) return
    let inFlight = false
    let stopped = false

    const run = async () => {
      if (stopped || !shouldTick({ active, hidden: document.hidden, inFlight })) return
      inFlight = true
      try {
        await latest.current()
      } catch {
        // A failed refresh must leave the last good value on screen. The screen's own
        // loader already reports errors; a retry every interval reporting the same one
        // would bury the content under a banner nobody can dismiss.
      } finally {
        inFlight = false
      }
    }

    const timer = window.setInterval(() => void run(), intervalMs)
    const onVisibility = () => { if (!document.hidden) void run() }
    document.addEventListener('visibilitychange', onVisibility)
    return () => {
      stopped = true
      window.clearInterval(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [active, intervalMs])
}
