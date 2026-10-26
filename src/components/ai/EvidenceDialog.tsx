import React, { useEffect, useId } from 'react'
import { X } from 'lucide-react'
import { FocusTrap } from '../ui/FocusTrap'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'

/**
 * A large dialog for looking closely at one figure or table. Wider than the shared Modal
 * (which tops out at a form's width), closes on Escape or a click outside, and hands focus
 * back to what opened it.
 */
export default function EvidenceDialog({ title, closeLabel, onClose, actions, children }: {
  title: string
  closeLabel: string
  onClose: () => void
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  const titleId = useId()
  useBodyScrollLock(true)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div className="fixed inset-0 z-modal flex items-center justify-center p-3 sm:p-6" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="absolute inset-0 bg-scrim/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <FocusTrap className="contents">
        <div className="relative flex max-h-[calc(100dvh-1.5rem)] w-full max-w-6xl flex-col overflow-hidden rounded-panel border border-border bg-surface-elevated shadow-modal sm:max-h-[calc(100dvh-3rem)]">
          <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
            <h2 id={titleId} className="min-w-0 flex-1 truncate text-body font-semibold text-foreground">{title}</h2>
            {actions}
            <button type="button" onClick={onClose} aria-label={closeLabel} className="grid h-8 w-8 place-items-center rounded-control text-muted-foreground transition hover:bg-surface-muted hover:text-foreground">
              <X size={16} />
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-auto">{children}</div>
        </div>
      </FocusTrap>
    </div>
  )
}
