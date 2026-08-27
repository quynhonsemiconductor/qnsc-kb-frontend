import React, { useEffect } from 'react'
import { X } from 'lucide-react'
import { FocusTrap } from './FocusTrap'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function Modal({ open, onClose, title, children, size = 'md', className = '' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleEscape)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  if (!open) return null

  const sizes = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-3xl',
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
    >
      <div
        className="absolute inset-0 bg-background/75 backdrop-blur-sm animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />
      <FocusTrap active={open}>
        <div className={`relative w-full ${sizes[size]} rounded-panel border border-border bg-surface-elevated p-6 shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom duration-300 ${className}`}>
          {title && (
            <div className="mb-4 flex items-center justify-between">
              <h2 id="modal-title" className="text-h4 font-semibold text-foreground">{title}</h2>
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
