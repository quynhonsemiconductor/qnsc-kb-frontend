import { useEffect } from 'react'

let lockCount = 0
let previousOverflow = ''

export function acquireBodyScrollLock() {
  if (lockCount === 0) {
    previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  lockCount += 1
  let released = false

  return () => {
    if (released) return
    released = true
    lockCount = Math.max(0, lockCount - 1)
    if (lockCount === 0) document.body.style.overflow = previousOverflow
  }
}

export function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    return acquireBodyScrollLock()
  }, [active])
}
