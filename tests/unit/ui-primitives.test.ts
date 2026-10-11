import { describe, expect, it, vi } from 'vitest'
import { calculateFloatingPosition } from '../../src/lib/floating-position'
import { acquireBodyScrollLock } from '../../src/hooks/useBodyScrollLock'

const rect = (left: number, top: number, width: number, height: number) => ({
  left,
  top,
  width,
  right: left + width,
  bottom: top + height,
})

describe('floating surface positioning', () => {
  it('opens below when there is room and keeps the requested width', () => {
    const result = calculateFloatingPosition({
      anchor: rect(100, 60, 80, 32),
      viewportWidth: 800,
      viewportHeight: 600,
      rem: 16,
      preferredWidth: 288,
      minWidthRem: 14,
      maxWidthRem: 24,
      minHeightRem: 8,
      maxHeightRem: 24,
    })

    expect(result).toMatchObject({ top: 96, left: 100, width: 288, openAbove: false })
    expect(result.maxHeight).toBe(384)
  })

  it('right-aligns at the viewport edge and anchors short panels above the trigger', () => {
    const result = calculateFloatingPosition({
      anchor: rect(740, 540, 40, 32),
      viewportWidth: 800,
      viewportHeight: 600,
      rem: 16,
      preferredWidth: 320,
      minWidthRem: 14,
      maxWidthRem: 24,
      minHeightRem: 8,
      maxHeightRem: 24,
    })

    expect(result).toMatchObject({ top: 536, left: 460, width: 320, openAbove: true })
    expect(result.maxHeight).toBe(384)
  })

  it('clamps wide panels to a narrow viewport', () => {
    const result = calculateFloatingPosition({
      anchor: rect(280, 50, 32, 32),
      viewportWidth: 320,
      viewportHeight: 500,
      rem: 16,
      preferredWidth: 500,
      minWidthRem: 14,
      maxWidthRem: 24,
      minHeightRem: 8,
      maxHeightRem: 24,
    })

    expect(result.left).toBe(8)
    expect(result.width).toBe(304)
  })
})

describe('body scroll locking', () => {
  it('restores the prior style only after the final lock is released', () => {
    vi.stubGlobal('document', { body: { style: { overflow: 'clip' } } })
    const releaseFirst = acquireBodyScrollLock()
    const releaseSecond = acquireBodyScrollLock()

    try {
      expect(document.body.style.overflow).toBe('hidden')
      releaseFirst()
      expect(document.body.style.overflow).toBe('hidden')
      releaseSecond()
      expect(document.body.style.overflow).toBe('clip')
      releaseSecond()
      expect(document.body.style.overflow).toBe('clip')
    } finally {
      releaseFirst()
      releaseSecond()
      vi.unstubAllGlobals()
    }
  })
})
