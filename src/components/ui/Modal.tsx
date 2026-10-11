import React, { useEffect, useId } from 'react'
import { X } from 'lucide-react'
import { FocusTrap } from './FocusTrap'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Modal({ open, onClose, title, children, size = 'md', className = '' }: ModalProps) {
  // Unique per mounted modal. A hardcoded id made two open modals both label themselves
  // from whichever heading happened to be first in the document.
  const titleId = useId()
  useBodyScrollLock(open)

  useEffect(() => {
    if (!open) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onClose])

  if (!open) return null

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-3xl',
  }

  return (
    <div
      className="fixed inset-0 z-modal flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? titleId : undefined}
      aria-label={title ? undefined : 'Dialog'}
    >
      <div
        className="absolute inset-0 bg-background/75 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />
      <FocusTrap active={open}>
        <div className={`dialog-scroll relative max-h-[calc(100dvh-2rem)] w-full overflow-y-auto ${sizes[size]} rounded-panel border border-border bg-surface-elevated p-6 shadow-modal animate-in fade-in zoom-in-95 slide-in-from-bottom duration-300 ${className}`}>
          {title && (
            <div className="mb-4 flex items-center justify-between">
              <h2 id={titleId} className="text-h4 font-semibold text-foreground">{title}</h2>
              <button
                type="button"
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-control text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
                aria-label="Close"
              >
                <X size={16} />
              </button>
            </div>
          )}
          {!title && (
            <button
              type="button"
              onClick={onClose}
              className="absolute right-4 top-4 grid h-8 w-8 place-items-center rounded-control text-muted-foreground transition hover:bg-surface-muted hover:text-foreground"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          )}
          {children}
        </div>
      </FocusTrap>
    </div>
  )
}
