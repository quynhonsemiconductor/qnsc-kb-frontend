import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

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

type PanelPosition = { top: number; left: number; width: number; maxHeight: number }

const samePosition = (left: PanelPosition, right: PanelPosition) =>
  left.top === right.top && left.left === right.left && left.width === right.width && left.maxHeight === right.maxHeight

/** Floor on panel width. Without one, a panel anchored to an icon button inherited the
 *  BUTTON's width — 2rem — and its contents were crushed into a column too narrow to read.
 *  Expressed in rem so it grows with the workspace scale. */
const MIN_WIDTH_REM = 14
const MAX_HEIGHT_REM = 24
const MIN_HEIGHT_REM = 8
const GAP_REM = 0.25
const EDGE_PADDING_REM = 0.5

/** The workspace scale steps the root font size at 1536/1920/2560px, so every measurement
 *  below is derived from it rather than frozen in pixels. */
const rootFontSize = () => {
  const parsed = parseFloat(getComputedStyle(document.documentElement).fontSize)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 16
}

export function FloatingPanel({ anchorRef, open, onClose, children, className = '', width: widthOverride, widthRem }: FloatingPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState<PanelPosition>({ top: 0, left: 0, width: 0, maxHeight: 320 })

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
      const rem = rootFontSize()
      const gap = GAP_REM * rem
      const padding = EDGE_PADDING_REM * rem
      const roomBelow = window.innerHeight - rect.bottom - gap - padding
      const roomAbove = rect.top - gap - padding
      const openAbove = roomBelow < MIN_HEIGHT_REM * rem && roomAbove > roomBelow
      const maxHeight = Math.max(
        MIN_HEIGHT_REM * rem,
        Math.min(MAX_HEIGHT_REM * rem, openAbove ? roomAbove : roomBelow),
      )
      // Never narrower than MIN_WIDTH_REM, and never wider than the viewport allows. The
      // anchor's width is only a STARTING point: an icon-button anchor is 2rem wide, and
      // inheriting that turned every panel hung off one into an unreadable sliver.
      const available = window.innerWidth - padding * 2
      const preferred = widthRem != null ? widthRem * rem : widthOverride ?? rect.width
      const width = Math.min(Math.max(preferred, Math.min(MIN_WIDTH_REM * rem, available)), available)
      const next: PanelPosition = {
        top: openAbove ? Math.max(padding, rect.top - gap - maxHeight) : rect.bottom + gap,
        left: Math.min(Math.max(padding, rect.left), Math.max(padding, window.innerWidth - width - padding)),
        width,
        maxHeight,
      }
      setPosition(current => samePosition(current, next) ? current : next)
    }
    const closeOnOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (anchorRef.current?.contains(target) || panelRef.current?.contains(target)) return
      onCloseRef.current()
    }
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onCloseRef.current() }
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
    <div ref={panelRef} className={`fixed z-[1000] overflow-y-auto rounded-xl border border-border bg-surface-elevated shadow-[0_18px_40px_rgb(var(--shadow)/.28)] ${className}`} style={{ top: position.top, left: position.left, width: position.width, maxHeight: position.maxHeight }}>
      {children}
    </div>,
    document.body,
  )
}
