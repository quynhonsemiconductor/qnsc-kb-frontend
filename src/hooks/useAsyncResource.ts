import { useCallback, useEffect, useState } from 'react'

type Entry<T> = { data?: T; promise?: Promise<T>; error?: unknown }
const cache = new Map<string, Entry<unknown>>()

/** Small request cache/deduplicator for screens that share read endpoints. */
export function useAsyncResource<T>(key: string, loader: () => Promise<T>) {
  const [state, setState] = useState<Entry<T>>(() => (cache.get(key) as Entry<T> | undefined) || {})
  const load = useCallback(async () => {
    const existing = cache.get(key) as Entry<T> | undefined
    if (existing?.data !== undefined) { setState(existing); return existing.data }
    const promise = existing?.promise || loader()
    cache.set(key, { ...(existing || {}), promise })
    try {
      const data = await promise
      cache.set(key, { data })
      setState({ data })
      return data
    } catch (error) {
      cache.set(key, { error })
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
