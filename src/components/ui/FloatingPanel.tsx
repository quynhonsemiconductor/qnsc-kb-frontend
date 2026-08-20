import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

type FloatingPanelProps = {
  anchorRef: React.RefObject<HTMLElement | null>
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
  width?: number
}

type PanelPosition = { top: number; left: number; width: number; maxHeight: number }

export function FloatingPanel({ anchorRef, open, onClose, children, className = '', width: widthOverride }: FloatingPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<PanelPosition>({ top: 0, left: 0, width: 0, maxHeight: 320 })

  useEffect(() => {
    if (!open) return
    const updatePosition = () => {
      const anchor = anchorRef.current
      if (!anchor) return
      const rect = anchor.getBoundingClientRect()
      const gap = 4
      const padding = 8
      const roomBelow = window.innerHeight - rect.bottom - gap - padding
      const roomAbove = rect.top - gap - padding
      const openAbove = roomBelow < 180 && roomAbove > roomBelow
      const maxHeight = Math.max(120, Math.min(360, openAbove ? roomAbove : roomBelow))
      const width = Math.min(widthOverride ?? rect.width, window.innerWidth - padding * 2)
      setPosition({
        top: openAbove ? Math.max(padding, rect.top - gap - maxHeight) : rect.bottom + gap,
        left: Math.min(Math.max(padding, rect.left), Math.max(padding, window.innerWidth - width - padding)),
        width,
        maxHeight,
      })
    }
    const closeOnOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return
      onClose()
    }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    updatePosition()
    document.addEventListener('mousedown', closeOnOutside)
    document.addEventListener('keydown', closeOnEscape)
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      document.removeEventListener('mousedown', closeOnOutside)
      document.removeEventListener('keydown', closeOnEscape)
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [anchorRef, onClose, open, widthOverride])

  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <div ref={panelRef} className={`fixed z-[1000] overflow-y-auto rounded-xl border border-border bg-surface-elevated shadow-[0_18px_40px_rgb(var(--shadow)/.28)] ${className}`} style={{ top: position.top, left: position.left, width: position.width, maxHeight: position.maxHeight }}>
      {children}
    </div>,
    document.body,
  )
}
