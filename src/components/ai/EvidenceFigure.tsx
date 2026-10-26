import { useState } from 'react'
import { Download, ExternalLink, FileImage, FileSpreadsheet, MessageSquareText, ZoomIn } from 'lucide-react'
import EvidenceTable, { type EvidenceTableLabels } from './EvidenceTable'
import EvidenceDialog from './EvidenceDialog'
import ImageViewer, { type ImageViewerLabels } from './ImageViewer'
import { safeFileName } from '../../lib/evidence-table'
import type { InlineEvidenceItem } from '../../lib/inline-evidence'
import type { Citation } from '../../types/ai'
import type { EvidencePreviews } from './useEvidencePreviews'

/** Save a preview the page already holds as a file, without leaving the answer. */
function saveImage(url: string, fileName: string) {
  const link = document.createElement('a')
  link.href = url
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
}

export interface EvidenceFigureLabels extends EvidenceTableLabels, ImageViewerLabels {
  tableRowSummary: string
  unavailable: string
  open: string
  /** "Open at page {{page}}" */
  openAtPage: string
  zoom: string
  download: string
  /** Question put in the composer: 'Explain "{{label}}" (page {{page}})' */
  askPrompt: string
}

interface EvidenceFigureProps {
  item: InlineEvidenceItem
  previews: EvidencePreviews
  onSelect: (citation: Citation) => void
  labels: EvidenceFigureLabels
  /** Puts a question about this figure or table in the composer. */
  onAsk?: (question: string) => void
}

/**
 * One cited figure or table, as it appears inside the answer.
 *
 * The picture or table is the content; around it sit the things a reader wants to do:
 * enlarge and pan a figure, take it away, open the document at its page, or ask about it.
 *
 * The preview URL is read from the answer's preview owner rather than fetched here,
 * because the same picture can be cited from more than one place and must not be requested
 * twice.
 */
export default function EvidenceFigure({ item, previews, onSelect, labels, onAsk }: EvidenceFigureProps) {
  const url = item.type === 'image' ? previews.urls[item.evidenceId] : undefined
  const [zoomed, setZoomed] = useState(false)
  const page = item.citation.page_number
  const ask = onAsk
    ? () => onAsk(labels.askPrompt.replaceAll('{{label}}', item.label).replaceAll('{{page}}', page ? String(page) : '—'))
    : undefined

  // From inside the large view the dialog closes first, or the document would open behind it.
  const openSource = () => {
    setZoomed(false)
    onSelect(item.citation)
  }

  const action = 'inline-flex h-7 items-center gap-1 rounded-control border border-hairline bg-canvas px-2 text-caption font-semibold text-steel transition hover:border-info/40 hover:text-ink'

  const actions = (
    <>
      {item.type === 'image' && url && (
        <button type="button" onClick={() => saveImage(url, safeFileName(item.label, 'png'))} className={action}><Download size={12} />{labels.download}</button>
      )}
      <button type="button" onClick={openSource} className={action} title={labels.open}>
        <ExternalLink size={12} />{page ? labels.openAtPage.replaceAll('{{page}}', String(page)) : labels.open}
      </button>
    </>
  )

  return (
    <figure className="my-3 first:mt-0 last:mb-0">
      {item.type === 'table' ? (
        <EvidenceTable
          table={item.table}
          label={item.label}
          labels={{ ...labels, rowSummary: labels.tableRowSummary }}
          articleId={item.articleId}
          evidenceId={item.evidenceId}
          onAsk={ask}
        />
      ) : url ? (
        <button
          type="button"
          onClick={() => setZoomed(true)}
          title={labels.zoom}
          className="ask-press group relative block w-full cursor-zoom-in overflow-hidden rounded-xl border border-hairline bg-canvas transition hover:border-info/40 hover:shadow-sm"
        >
          <img
            src={url}
            alt={item.label}
            loading="lazy"
            decoding="async"
            className="max-h-96 w-full object-contain"
          />
          <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-control bg-surface/90 text-steel opacity-0 shadow-sm transition group-hover:opacity-100 group-focus-visible:opacity-100"><ZoomIn size={14} /></span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => onSelect(item.citation)}
          className="ask-press flex w-full items-center gap-2 rounded-xl border border-dashed border-hairline px-3 py-3 text-left text-body-sm text-stone transition hover:border-info/40 hover:text-ink"
        >
          <FileImage size={14} className="shrink-0 text-info" />
          <span className="min-w-0 flex-1 truncate">{item.label}</span>
          <span className="shrink-0 text-caption">
            {previews.failed[item.evidenceId] ? labels.unavailable : '…'}
          </span>
        </button>
      )}
      <figcaption className="mt-1.5 flex flex-wrap items-center gap-1.5 px-1 text-body-sm text-stone">
        {item.type === 'table'
          ? <FileSpreadsheet size={12} className="shrink-0 text-success" />
          : <FileImage size={12} className="shrink-0 text-info" />}
        <span className="min-w-0 flex-1 truncate">{item.label}</span>
        {item.type === 'image' && (
          <>
            <button type="button" onClick={() => setZoomed(true)} disabled={!url} className={`${action} disabled:opacity-50`}><ZoomIn size={12} />{labels.zoom}</button>
            {ask && <button type="button" onClick={ask} className={action}><MessageSquareText size={12} />{labels.ask}</button>}
          </>
        )}
        {actions}
      </figcaption>
      {zoomed && url && (
        <EvidenceDialog title={item.label} closeLabel={labels.close} onClose={() => setZoomed(false)} actions={actions}>
          <ImageViewer src={url} alt={item.label} labels={labels} />
        </EvidenceDialog>
      )}
    </figure>
  )
}
