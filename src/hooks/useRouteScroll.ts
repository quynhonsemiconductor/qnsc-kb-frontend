import { useEffect, type RefObject } from 'react'
import { useLocation, useNavigationType } from 'react-router-dom'

const positions = new Map<string, number>()

export function useRouteScroll(container: RefObject<HTMLElement | null>) {
  const location = useLocation()
  const navigationType = useNavigationType()

  useEffect(() => {
    const element = container.current
    if (!element) return
    const remember = () => positions.set(location.key, element.scrollTop)
    element.addEventListener('scroll', remember, { passive: true })
    return () => {
      positions.set(location.key, element.scrollTop)
      element.removeEventListener('scroll', remember)
    }
  }, [container, location.key])

  useEffect(() => {
    const element = container.current
    if (!element) return
    const target = navigationType === 'POP' ? positions.get(location.key) ?? 0 : 0
    const frame = window.requestAnimationFrame(() => {
      if (location.hash) {
        let targetId = location.hash.slice(1)
        try { targetId = decodeURIComponent(targetId) } catch { /* use the literal fragment */ }
        const hashTarget = document.getElementById(targetId)
        if (hashTarget) {
          hashTarget.scrollIntoView({ block: 'start' })
          if (hashTarget instanceof HTMLElement) hashTarget.focus({ preventScroll: true })
          return
        }
      }
      element.scrollTo({ top: target, behavior: 'auto' })
      element.focus({ preventScroll: true })
    })
    return () => window.cancelAnimationFrame(frame)
  }, [container, location.hash, location.key, navigationType])
}
