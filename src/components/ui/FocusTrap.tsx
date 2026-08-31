import React, { useEffect, useRef } from 'react'

interface FocusTrapProps {
  children: React.ReactNode
  active?: boolean
  className?: string
}

export function FocusTrap({ children, active = true, className }: FocusTrapProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!active) return

    const container = containerRef.current
    if (!container) return

    // Captured before focus moves inside, so it can be handed back on close. Without this
    // a keyboard user who opened a dialog from a button in a long list was returned to the
    // top of the document and had to find their place again.
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const focusableSelector = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      const focusableElements = container.querySelectorAll<HTMLElement>(focusableSelector)
      if (focusableElements.length === 0) return

      const first = focusableElements[0]
      const last = focusableElements[focusableElements.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    container.addEventListener('keydown', handleKeyDown)

    // Only take focus if the content has not already placed it. Dialog bodies use autoFocus
    // to land on the text field or the confirm button, and stealing that for whatever
    // happens to be first in the DOM would move focus somewhere the author did not choose.
    const focusableElements = container.querySelectorAll<HTMLElement>(focusableSelector)
    if (focusableElements.length > 0 && !container.contains(document.activeElement)) {
      focusableElements[0].focus()
    }

    return () => {
      container.removeEventListener('keydown', handleKeyDown)
      // Only restore if focus is still inside the trap. If something else has deliberately
      // moved focus elsewhere by now, yanking it back would be the more surprising outcome.
      if (opener?.isConnected && container.contains(document.activeElement)) opener.focus()
    }
  }, [active])

  return (
    <div ref={containerRef} className={className}>
      {children}
    </div>
  )
}
