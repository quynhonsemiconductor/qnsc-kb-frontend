import { useCallback, useEffect, useRef, useState } from 'react'

export interface PanelState<T> {
  data: T | null
  /** The last failure, kept alongside the last good `data` so a failed refresh does not blank the panel. */
  error: unknown
  /** True only while there is nothing to show yet. */
  loading: boolean
  /** True while a refresh is in flight and the previous data is still on screen. */
  refreshing: boolean
  /** When `data` was fetched (ms since epoch). */
  updatedAt: number | null
}

const EMPTY: PanelState<never> = { data: null, error: null, loading: true, refreshing: false, updatedAt: null }

/**
 * Load one independent panel of a dashboard.
 *
 * Each panel owns its own request, so one endpoint failing (or not existing yet on an older server)
 * costs that panel and not the page. Two inputs, because they mean different things:
 *
 * - `identity` is WHAT is being shown (a time window). When it changes the old data is wrong for the
 *   new question, so the panel resets to loading instead of showing the previous window under a new label.
 * - `tick` is WHEN to look again. A change refetches in place and keeps the data on screen, so an
 *   auto-refresh never flashes a skeleton.
 *
 * A response that arrives after a newer request was made is ignored, so a slow reply for a window the
 * reader has already left cannot overwrite the one they are looking at.
 */
export function usePanelData<T>(loader: () => Promise<T>, identity: string, tick = 0) {
  const [state, setState] = useState<PanelState<T>>(EMPTY)
  const latestLoader = useRef(loader)
  latestLoader.current = loader
  const sequence = useRef(0)
  const lastIdentity = useRef<string | null>(null)

  const run = useCallback(async (reset: boolean) => {
    const mine = ++sequence.current
    setState((previous) =>
      reset || previous.data === null
        ? { ...EMPTY }
        : { ...previous, refreshing: true },
    )
    try {
      const data = await latestLoader.current()
      if (mine !== sequence.current) return
      setState({ data, error: null, loading: false, refreshing: false, updatedAt: Date.now() })
    } catch (error) {
      if (mine !== sequence.current) return
      setState((previous) => ({ ...previous, error, loading: false, refreshing: false }))
    }
  }, [])

  useEffect(() => {
    const reset = lastIdentity.current !== identity
    lastIdentity.current = identity
    void run(reset)
  }, [identity, tick, run])

  const reload = useCallback(() => run(false), [run])
  return { ...state, reload }
}
