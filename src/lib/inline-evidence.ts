/**
 * Choosing which cited figures and tables an answer shows inline.
 *
 * The chat already carried every artifact it needed — `evidence_id`, `evidence_kind`,
 * `evidence_label` and, for tables, the whole `evidence_table` — but only revealed them
 * after the reader clicked a citation and opened the side panel. A document that is
 * mostly screenshots therefore answered with prose about pictures nobody saw.
 *
 * Two rules do most of the work here:
 *
 *   dedupe   one figure is commonly cited by several retrieved chunks, and the same
 *            picture repeated four times under one answer reads as a bug.
 *   cap      images cost an authenticated request each, so the number fetched per
 *            message is bounded rather than "however many the retriever returned".
 *
 * Tables are capped too, for a different reason: their rows are already in memory, so
 * the cost is layout rather than network — twenty tables under one answer buries it.
 */
import type { Citation, EvidenceTable } from '../types/ai'

/** Authenticated image fetches allowed per message. */
export const INLINE_IMAGE_CAP = 4

/** Tables rendered per message. Their data is already loaded; this bounds the layout. */
export const INLINE_TABLE_CAP = 3

export interface InlineEvidenceImage {
  type: 'image'
  evidenceId: string
  articleId: string
  label: string
  citation: Citation
}

export interface InlineEvidenceTable {
  type: 'table'
  evidenceId: string
  articleId: string
  label: string
  table: EvidenceTable
  citation: Citation
}

export type InlineEvidenceItem = InlineEvidenceImage | InlineEvidenceTable

export interface InlineEvidenceSelection {
  items: InlineEvidenceItem[]
  /** Items of each kind dropped by the cap, so the UI can say so rather than hide them. */
  hiddenImages: number
  hiddenTables: number
}

function hasRenderableTable(table?: EvidenceTable): table is EvidenceTable {
  return Boolean(table && table.columns?.length && table.rows?.length)
}

/**
 * The evidence one message should render inline, in citation order.
 *
 * Citation order rather than kind order: the answer's own numbering is what the reader
 * follows, so reordering the artifacts would break the correspondence between "[2]" and
 * the picture under it.
 *
 * A citation with no `evidence_id` is ordinary retrieved text and contributes nothing
 * here. A table citation whose `evidence_table` has no columns or no rows is skipped as
 * well: there is nothing to draw, and `EvidenceTable` would render null anyway.
 */
export function selectInlineEvidence(
  citations: Citation[] | undefined,
  options: { imageCap?: number; tableCap?: number } = {},
): InlineEvidenceSelection {
  const imageCap = options.imageCap ?? INLINE_IMAGE_CAP
  const tableCap = options.tableCap ?? INLINE_TABLE_CAP

  const items: InlineEvidenceItem[] = []
  const seen = new Set<string>()
  let images = 0
  let tables = 0
  let hiddenImages = 0
  let hiddenTables = 0

  for (const citation of citations || []) {
    const evidenceId = citation.evidence_id
    if (!evidenceId || !citation.evidence_kind || !citation.article_id) continue
    if (seen.has(evidenceId)) continue
    seen.add(evidenceId)

    const label = citation.evidence_label || citation.title
    if (citation.evidence_kind === 'table') {
      if (!hasRenderableTable(citation.evidence_table)) continue
      if (tables >= tableCap) {
        hiddenTables += 1
        continue
      }
      tables += 1
      items.push({
        type: 'table',
        evidenceId,
        articleId: citation.article_id,
        label,
        table: citation.evidence_table,
        citation,
      })
      continue
    }

    if (images >= imageCap) {
      hiddenImages += 1
      continue
    }
    images += 1
    items.push({
      type: 'image',
      evidenceId,
      articleId: citation.article_id,
      label,
      citation,
    })
  }

  return { items, hiddenImages, hiddenTables }
}
