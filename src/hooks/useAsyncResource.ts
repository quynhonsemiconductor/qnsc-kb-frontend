import { useCallback, useEffect, useState } from 'react'

type Entry<T> = { data?: T; promise?: Promise<T> }
const cache = new Map<string, Entry<unknown>>()

/** Small request cache/deduplicator for screens that share read endpoints. */
export function useAsyncResource<T>(key: string, loader: () => Promise<T>) {
  const [state, setState] = useState<{ data?: T; error?: unknown }>(() => {
    const entry = cache.get(key) as Entry<T> | undefined
    return entry?.data === undefined ? {} : { data: entry.data }
  })
  const load = useCallback(async () => {
    const existing = cache.get(key) as Entry<T> | undefined
    if (existing?.data !== undefined) { setState({ data: existing.data }); return existing.data }
    const promise = existing?.promise || loader()
    cache.set(key, { promise })
    try {
      const data = await promise
      cache.set(key, { data })
      setState({ data })
      return data
    } catch (error) {
      // The failure is reported to this caller but NOT cached. A cached rejection is
      // permanent: nothing here expires it, so a single timeout or dropped connection used
      // to pin every screen sharing the key to its error state until a full page reload,
      // and `reload()` was the only escape. Dropping the entry means the next mount or
      // reload simply asks again.
      cache.delete(key)
      setState({ error })
      throw error
    }
  }, [key, loader])
  useEffect(() => { void load() }, [load])
  return { data: state.data, error: state.error, loading: state.data === undefined && !state.error, reload: () => { cache.delete(key); return load() } }
}

export function invalidateAsyncResource(keyPrefix: string) {
  for (const key of cache.keys()) if (key.startsWith(keyPrefix)) cache.delete(key)
}

/**
 * Drop every cached response. Called on both sides of an identity change by the auth store.
 *
 * Keys name an endpoint ('home-summary'), not a user, so entries outlive the session that
 * produced them: without this, signing out and signing in as someone else in the same tab
 * rendered the previous user's data from this Map before any request was made. In-flight
 * promises are dropped along with settled data — a request issued as the old user must not
 * be able to populate a screen belonging to the new one.
 */
export function clearAsyncResourceCache() {
  cache.clear()
}
