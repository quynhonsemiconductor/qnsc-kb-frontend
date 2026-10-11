export type FloatingPosition = {
  top: number
  left: number
  width: number
  maxHeight: number
  openAbove: boolean
}

type Rect = Pick<DOMRect, 'top' | 'right' | 'bottom' | 'left' | 'width'>

type FloatingPositionOptions = {
  anchor: Rect
  viewportWidth: number
  viewportHeight: number
  rem: number
  preferredWidth: number
  minWidthRem: number
  maxWidthRem?: number
  minHeightRem: number
  maxHeightRem: number
  gapRem?: number
  edgePaddingRem?: number
}

export function getRootFontSize() {
  const parsed = parseFloat(getComputedStyle(document.documentElement).fontSize)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 16
}

export function calculateFloatingPosition({
  anchor,
  viewportWidth,
  viewportHeight,
  rem,
  preferredWidth,
  minWidthRem,
  maxWidthRem,
  minHeightRem,
  maxHeightRem,
  gapRem = 0.25,
  edgePaddingRem = 0.5,
}: FloatingPositionOptions): FloatingPosition {
  const gap = gapRem * rem
  const padding = edgePaddingRem * rem
  const roomBelow = Math.max(0, viewportHeight - anchor.bottom - gap - padding)
  const roomAbove = Math.max(0, anchor.top - gap - padding)
  const openAbove = roomBelow < minHeightRem * rem && roomAbove > roomBelow
  const availableWidth = Math.max(0, viewportWidth - padding * 2)
  const maximumWidth = maxWidthRem == null ? availableWidth : Math.min(maxWidthRem * rem, availableWidth)
  const width = Math.min(Math.max(preferredWidth, Math.min(minWidthRem * rem, availableWidth)), maximumWidth)
  const leftAligned = anchor.left
  const rightAligned = anchor.right - width
  const preferredLeft = leftAligned + width <= viewportWidth - padding ? leftAligned : rightAligned
  const left = Math.min(Math.max(padding, preferredLeft), Math.max(padding, viewportWidth - width - padding))
  const availableHeight = openAbove ? roomAbove : roomBelow

  return {
    top: openAbove ? anchor.top - gap : anchor.bottom + gap,
    left,
    width,
    maxHeight: Math.min(maxHeightRem * rem, availableHeight),
    openAbove,
  }
}
