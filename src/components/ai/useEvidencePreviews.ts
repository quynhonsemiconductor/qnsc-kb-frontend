import { useEffect, useRef, useState } from 'react'
import { downloadEvidencePreview } from '../../api/articles'
import type { InlineEvidenceItem } from '../../lib/inline-evidence'

export interface EvidencePreviews {
  urls: Record<string, string>
  failed: Record<string, true>
}

/**
 * Fetch the preview images for one answer's evidence, and own their object URLs.
 *
 * ONE owner per answer, deliberately. The figures are now anchored to the paragraphs
 * that cite them, so they render at several points in the message — but fetching from
 * each of those points would request the same picture more than once and scatter the
 * revocation across components that unmount at different times. The answer holds the
 * URLs; the anchors only read them.
 *
 * Images arrive as authenticated blobs rather than URLs a browser can fetch on its own,
 * and a blob URL nobody revokes keeps its bytes for the lifetime of the document. A
 * transcript scrolls through many answers and each may hold several pictures, so the
 * release paths below are deliberately exhaustive.
 */
export function useEvidencePreviews(items: InlineEvidenceItem[]): EvidencePreviews {
  const images = items.filter(
    (item): item is Extract<InlineEvidenceItem, { type: 'image' }> => item.type === 'image',
  )
  // The identity of what is being shown, so the effect refetches when the answer's
  // evidence actually changes rather than on every render of its parent.
  const key = images.map(image => image.evidenceId).join('|')
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [failed, setFailed] = useState<Record<string, true>>({})
  const createdRef = useRef<string[]>([])

  useEffect(() => {
    if (!images.length) return

    let active = true
    const mine: string[] = []

    void Promise.all(
      images.map(async (image) => {
        try {
          const { url } = await downloadEvidencePreview(image.articleId, image.evidenceId)
          if (!active) {
            // Arrived after this effect was superseded: release it here, because the
            // cleanup below has already run and will never see it.
            URL.revokeObjectURL(url)
            return
          }
          mine.push(url)
          createdRef.current.push(url)
          setUrls(current => ({ ...current, [image.evidenceId]: url }))
        } catch {
          // A preview that cannot be produced is not worth breaking the answer for. The
          // caption and the click-through to the full source both still work.
          if (active) setFailed(current => ({ ...current, [image.evidenceId]: true }))
        }
      }),
    )

    return () => {
      active = false
      for (const url of mine) URL.revokeObjectURL(url)
      createdRef.current = createdRef.current.filter(item => !mine.includes(item))
      // Both maps are keyed by evidence id and describe the set being torn down, so
      // neither may outlive it: a kept `failed` entry would mark a later fetch of the
      // same evidence as broken before it was even attempted.
      setUrls({})
      setFailed({})
    }
  }, [key])

  // Unmount: anything still held, including a URL whose effect cleanup already ran.
  useEffect(() => {
    return () => {
      for (const url of createdRef.current) URL.revokeObjectURL(url)
      createdRef.current = []
    }
  }, [])

  return { urls, failed }
}
