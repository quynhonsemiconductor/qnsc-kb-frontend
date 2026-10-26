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

/**
 * Everything a citation can show: its own figure or table, then the ones on its page.
 *
 * Each is returned as a citation of its own (the parent's text and page, the evidence's id,
 * kind, label and table), so the rest of this module and the side panel treat them all
 * alike. Clicking a page figure therefore opens the source at that page.
 */
export function evidenceUnits(citation: Citation): Citation[] {
  const units: Citation[] = []
  if (citation.evidence_id) units.push(citation)
  const { page_evidence: pageEvidence, ...base } = citation
  for (const item of pageEvidence || []) {
    if (!item?.evidence_id || !item.kind) continue
    units.push({
      ...base,
      evidence_id: item.evidence_id,
      evidence_kind: item.kind,
      evidence_label: item.label,
      evidence_preview_url: item.preview_url,
      evidence_table: item.table ?? undefined,
      page_number: item.page_number ?? base.page_number,
    })
  }
  return units
}

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
 * The marker syntax, as a pattern rather than a regex.
 *
 * One source of truth, built fresh at each use site: anchoring finds the offsets and
 * rendering replaces the text, and a shared `g`-flagged instance carries `lastIndex`
 * between those two readers. Backend markers are `[C1]`; older answers wrote `[1]`, and
 * some wrote `[Source ID: C1]`.
 */
export const CITATION_MARKER_PATTERN = '\\[(?:Source ID:\\s*)?(?:C)?(\\d+)\\]'

export interface CitationMarker {
  number: number
  /** Index into the answer text, which is what a rendered block's range is measured in. */
  offset: number
  length: number
}

/** Every citation marker in the answer, in reading order. */
export function citationMarkers(content: string): CitationMarker[] {
  const regex = new RegExp(CITATION_MARKER_PATTERN, 'gi')
  const markers: CitationMarker[] = []
  let match: RegExpExecArray | null
  while ((match = regex.exec(content)) !== null) {
    markers.push({ number: Number(match[1]), offset: match.index, length: match[0].length })
  }
  return markers
}

/**
 * The citation a marker number refers to.
 *
 * Shared with the renderer deliberately. If anchoring resolved `[2]` differently from the
 * button rendered for `[2]`, a figure would appear beside a claim that cites something
 * else — a worse failure than showing no figure at all. The positional fallback applies
 * only when NO citation carries an index, mirroring answers from before `source_index`
 * existed.
 */
export function findCitationByMarker(
  citations: Citation[],
  number: number,
): Citation | undefined {
  return (
    citations.find(citation => citation.source_index === number)
    || (citations.every(citation => citation.source_index == null)
      ? citations[number > 0 ? number - 1 : 0]
      : undefined)
  )
}

export interface InlineEvidenceAnchor {
  /** Offset of the first marker that cited these items. */
  offset: number
  items: InlineEvidenceItem[]
}

export interface AnchoredInlineEvidence {
  /** Anchored groups, in reading order. */
  anchors: InlineEvidenceAnchor[]
  /** Evidence no marker claimed. Shown after the answer so nothing is lost. */
  trailing: InlineEvidenceItem[]
  hiddenImages: number
  hiddenTables: number
}

/**
 * Place each cited figure or table at the point in the answer that cites it.
 *
 * A gallery at the end of a message says "these pictures are related somehow"; a figure
 * directly beneath the sentence that cites it says which claim it supports. The grouping
 * is by marker OFFSET rather than by block, because this layer cannot see the rendered
 * blocks — the renderer owns that and matches offsets against each block's own source
 * range.
 *
 * Selection, dedupe and the caps are `selectInlineEvidence`'s job and are reused as-is,
 * so the two paths cannot disagree about what an answer may show. An item cited several
 * times anchors at its FIRST marker: that is where the reader meets the claim.
 */
export function anchorInlineEvidence(
  content: string,
  citations: Citation[] | undefined,
  options: { imageCap?: number; tableCap?: number } = {},
): AnchoredInlineEvidence {
  const { items, hiddenImages, hiddenTables } = selectInlineEvidence(citations, options)
  if (!items.length) return { anchors: [], trailing: [], hiddenImages, hiddenTables }

  const byEvidenceId = new Map(items.map(item => [item.evidenceId, item]))
  const claimed = new Set<string>()
  const grouped = new Map<number, InlineEvidenceItem[]>()

  for (const marker of citationMarkers(content)) {
    const citation = findCitationByMarker(citations || [], marker.number)
    if (!citation) continue
    for (const unit of evidenceUnits(citation)) {
      const evidenceId = unit.evidence_id
      if (!evidenceId || claimed.has(evidenceId)) continue
      const item = byEvidenceId.get(evidenceId)
      // Absent means the caps withheld it, or it was unrenderable. Either way it is not
      // this answer's to show, and must not become an empty anchor.
      if (!item) continue
      claimed.add(evidenceId)
      const group = grouped.get(marker.offset)
      if (group) group.push(item)
      else grouped.set(marker.offset, [item])
    }
  }

  return {
    anchors: [...grouped.entries()]
      .sort(([left], [right]) => left - right)
      .map(([offset, group]) => ({ offset, items: group })),
    // Markers can be absent entirely (an answer whose citations arrived but whose text
    // carries no markers), or name only some of the evidence.
    trailing: items.filter(item => !claimed.has(item.evidenceId)),
    hiddenImages,
    hiddenTables,
  }
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

  for (const citation of (citations || []).flatMap(evidenceUnits)) {
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
