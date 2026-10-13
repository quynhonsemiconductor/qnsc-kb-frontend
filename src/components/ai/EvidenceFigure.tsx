import { FileImage, FileSpreadsheet } from 'lucide-react'
import EvidenceTable from './EvidenceTable'
import type { InlineEvidenceItem } from '../../lib/inline-evidence'
import type { Citation } from '../../types/ai'
import type { EvidencePreviews } from './useEvidencePreviews'

export interface EvidenceFigureLabels {
  tableRowSummary: string
  unavailable: string
  open: string
}

interface EvidenceFigureProps {
  item: InlineEvidenceItem
  previews: EvidencePreviews
  onSelect: (citation: Citation) => void
  labels: EvidenceFigureLabels
}

/**
 * One cited figure or table, as it appears inside the answer.
 *
 * Presentational only: the URL is read from the answer's preview owner rather than
 * fetched here, because the same picture can be cited from more than one place and must
 * not be requested twice.
 */
export default function EvidenceFigure({ item, previews, onSelect, labels }: EvidenceFigureProps) {
  const url = item.type === 'image' ? previews.urls[item.evidenceId] : undefined

  return (
    <figure className="my-3 first:mt-0 last:mb-0">
      {item.type === 'table' ? (
        <EvidenceTable table={item.table} label={item.label} rowSummaryTemplate={labels.tableRowSummary} />
      ) : url ? (
        <button
          type="button"
          onClick={() => onSelect(item.citation)}
          title={labels.open}
          className="ask-press block w-full overflow-hidden rounded-xl border border-hairline bg-canvas transition hover:border-info/40 hover:shadow-sm"
        >
          <img
            src={url}
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
          <span className="shrink-0 text-caption">
            {previews.failed[item.evidenceId] ? labels.unavailable : '…'}
          </span>
        </button>
      )}
      <figcaption className="mt-1.5 flex items-center gap-1.5 px-1 text-body-sm text-stone">
        {item.type === 'table'
          ? <FileSpreadsheet size={12} className="shrink-0 text-success" />
          : <FileImage size={12} className="shrink-0 text-info" />}
        <span className="min-w-0 truncate">{item.label}</span>
      </figcaption>
    </figure>
  )
}
