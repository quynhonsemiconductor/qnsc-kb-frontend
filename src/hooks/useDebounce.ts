import { useEffect, useState } from 'react'

export function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debouncedValue
}

export function useDeferredSearch(query: string, delay: number = 300) {
  const debouncedQuery = useDebounce(query, delay)
  const isStale = query !== debouncedQuery
  return { debouncedQuery, isStale }
}
