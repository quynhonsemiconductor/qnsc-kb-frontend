import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { calculateFloatingPosition, getRootFontSize, type FloatingPosition } from '../../lib/floating-position'

type FloatingPanelProps = {
  anchorRef: React.RefObject<HTMLElement | null>
  open: boolean
  onClose: () => void
  children: React.ReactNode
  className?: string
  /** Fixed width in px. Prefer widthRem so the panel scales with the workspace. */
  width?: number
  /** Preferred width in rem, resolved against the current root font size. */
  widthRem?: number
}

/** Floor on panel width. Without one, a panel anchored to an icon button inherited the
 *  BUTTON's width — 2rem — and its contents were crushed into a column too narrow to read.
 *  Expressed in rem so it grows with the workspace scale. */
const MIN_WIDTH_REM = 14
const MAX_HEIGHT_REM = 24
const MIN_HEIGHT_REM = 8

const samePosition = (left: FloatingPosition, right: FloatingPosition) =>
  left.top === right.top && left.left === right.left && left.width === right.width
  && left.maxHeight === right.maxHeight && left.openAbove === right.openAbove

export function FloatingPanel({ anchorRef, open, onClose, children, className = '', width: widthOverride, widthRem }: FloatingPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<FloatingPosition>({ top: 0, left: 0, width: 0, maxHeight: 320, openAbove: false })

  // Every call site passes an inline arrow for onClose, so depending on it here
  // re-ran this effect on each render. Combined with the unconditional
  // setPosition below that produced an endless render loop while the panel was
  // open, so the handler is held in a ref instead.
  const onCloseRef = useRef(onClose)
  useEffect(() => { onCloseRef.current = onClose })

  useEffect(() => {
    if (!open) return
    const updatePosition = () => {
      const anchor = anchorRef.current
      if (!anchor) return
      const rect = anchor.getBoundingClientRect()
      const rem = getRootFontSize()
      const next = calculateFloatingPosition({
        anchor: rect,
        viewportWidth: window.innerWidth,
        viewportHeight: window.innerHeight,
        rem,
        preferredWidth: widthRem != null ? widthRem * rem : widthOverride ?? rect.width,
        minWidthRem: MIN_WIDTH_REM,
        minHeightRem: MIN_HEIGHT_REM,
        maxHeightRem: MAX_HEIGHT_REM,
      })
      setPosition(current => samePosition(current, next) ? current : next)
    }
    const closeOnOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return
      onCloseRef.current()
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      onCloseRef.current()
      anchorRef.current?.focus()
    }
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
  }, [anchorRef, open, widthOverride, widthRem])

  if (!open || typeof document === 'undefined') return null
  return createPortal(
    <div ref={panelRef} className={`fixed z-popover overflow-y-auto rounded-xl border border-border bg-surface-elevated shadow-popover ${className}`} style={{ top: position.top, left: position.left, width: position.width, maxHeight: position.maxHeight, transform: position.openAbove ? 'translateY(-100%)' : undefined }}>
      {children}
    </div>,
    document.body,
  )
}
