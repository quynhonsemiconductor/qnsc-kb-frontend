import { useEffect, useRef, useState } from 'react'
import { FileImage, FileSpreadsheet } from 'lucide-react'
import { downloadEvidencePreview } from '../../api/articles'
import EvidenceTable from './EvidenceTable'
import { selectInlineEvidence, type InlineEvidenceItem } from '../../lib/inline-evidence'
import type { Citation } from '../../types/ai'

interface InlineEvidenceProps {
  citations?: Citation[]
  /** Opens the existing full source panel, so nothing the citation list offered is lost. */
  onSelect: (citation: Citation) => void
  labels: {
    heading: string
    /** "{{count}} more figure(s)…" — what the image cap withheld. */
    moreImages: string
    /** "{{count}} more table(s)…" — what the table cap withheld. */
    moreTables: string
    /** EvidenceTable's own "{{shown}} of {{total}} rows" template. Different string. */
    tableRowSummary: string
    unavailable: string
    open: string
  }
}

/**
 * The figures and tables an answer cited, rendered under the answer itself.
 *
 * Images arrive as authenticated blobs rather than URLs the browser can fetch on its
 * own, so each one is requested here and released on the way out. That ownership is the
 * delicate part: a transcript scrolls through many answers, every answer may hold
 * several pictures, and a blob URL that nobody revokes keeps its bytes for the lifetime
 * of the document. The ref below therefore holds every URL this component created, and
 * the cleanup revokes all of them — on unmount, and again whenever the cited evidence
 * changes underneath it.
 */
export default function InlineEvidence({ citations, onSelect, labels }: InlineEvidenceProps) {
  const { items, hiddenImages, hiddenTables } = selectInlineEvidence(citations)
  // The identity of what is being shown, so the effect refetches when the answer's
  // evidence actually changes rather than on every parent render.
  const key = items.map(item => `${item.type}:${item.evidenceId}`).join('|')
  const [urls, setUrls] = useState<Record<string, string>>({})
  const [failed, setFailed] = useState<Record<string, true>>({})
  const createdRef = useRef<string[]>([])

  useEffect(() => {
    const images = items.filter((item): item is Extract<InlineEvidenceItem, { type: 'image' }> => item.type === 'image')
    if (!images.length) return

    let active = true
    const mine: string[] = []

    void Promise.all(
      images.map(async (image) => {
        try {
          const { url } = await downloadEvidencePreview(image.articleId, image.evidenceId)
          if (!active) {
            // Arrived after this effect was superseded: release it here, because the
            // cleanup below has already run and will not see it.
            URL.revokeObjectURL(url)
            return
          }
          mine.push(url)
          createdRef.current.push(url)
          setUrls(current => ({ ...current, [image.evidenceId]: url }))
        } catch {
          // A preview that cannot be produced is not an error worth breaking the answer
          // for. The caption and the click-through to the full source both still work.
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

  if (!items.length) return null

  return (
    <section className="mt-4 pl-10" aria-label={labels.heading}>
      <p className="mb-2 text-caption font-semibold uppercase tracking-widest text-stone">{labels.heading}</p>
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <figure key={`${item.type}-${item.evidenceId}`} className="m-0">
            {item.type === 'table' ? (
              <EvidenceTable table={item.table} label={item.label} rowSummaryTemplate={labels.tableRowSummary} />
            ) : urls[item.evidenceId] ? (
              <button
                type="button"
                onClick={() => onSelect(item.citation)}
                title={labels.open}
                className="ask-press block w-full overflow-hidden rounded-xl border border-hairline bg-canvas transition hover:border-info/40 hover:shadow-sm"
              >
                <img
                  src={urls[item.evidenceId]}
                  alt={item.label}
                  loading="lazy"
                  decoding="async"
                  className="max-h-96 w-full object-contain"
                />
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onSelect(item.citation)}
                className="ask-press flex w-full items-center gap-2 rounded-xl border border-dashed border-hairline px-3 py-3 text-left text-body-sm text-stone transition hover:border-info/40 hover:text-ink"
              >
                <FileImage size={14} className="shrink-0 text-info" />
                <span className="min-w-0 flex-1 truncate">{item.label}</span>
                <span className="shrink-0 text-caption">{failed[item.evidenceId] ? labels.unavailable : '…'}</span>
              </button>
            )}
            <figcaption className="mt-1.5 flex items-center gap-1.5 px-1 text-body-sm text-stone">
              {item.type === 'table'
                ? <FileSpreadsheet size={12} className="shrink-0 text-success" />
                : <FileImage size={12} className="shrink-0 text-info" />}
              <span className="min-w-0 truncate">{item.label}</span>
            </figcaption>
          </figure>
        ))}
      </div>
      {(hiddenImages > 0 || hiddenTables > 0) && (
        <p className="mt-2 text-body-sm text-stone">
          {hiddenImages > 0 ? labels.moreImages.replaceAll('{{count}}', String(hiddenImages)) : ''}
          {hiddenImages > 0 && hiddenTables > 0 ? ' ' : ''}
          {hiddenTables > 0 ? labels.moreTables.replaceAll('{{count}}', String(hiddenTables)) : ''}
        </p>
      )}
    </section>
  )
}
