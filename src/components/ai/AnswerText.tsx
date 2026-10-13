import React from 'react'
import ReactMarkdown from 'react-markdown'
import type { PluggableList } from 'unified'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import type { Citation } from '../../types/ai'
import {
  anchorInlineEvidence,
  CITATION_MARKER_PATTERN,
  findCitationByMarker,
  type InlineEvidenceItem,
} from '../../lib/inline-evidence'
import {
  ANCHOR_PROPERTY,
  anchorOffsetsFromProp,
  markEvidenceAnchors,
} from '../../lib/evidence-anchor-plugin'
import EvidenceFigure, { type EvidenceFigureLabels } from './EvidenceFigure'
import { useEvidencePreviews } from './useEvidencePreviews'

export type AnswerCitation = Citation

export interface AnswerEvidenceLabels extends EvidenceFigureLabels {
  /** "{{count}} more figure(s)…" — what the image cap withheld. */
  moreImages: string
  /** "{{count}} more table(s)…" — what the table cap withheld. */
  moreTables: string
}

interface AnswerTextProps {
  content: string
  citations?: AnswerCitation[]
  onCitationClick: (citation: AnswerCitation) => void
  /**
   * Render cited figures and tables beside the claims that cite them. Omitted while an
   * answer is still streaming, and for the action/error variants that carry no citations.
   */
  evidence?: { labels: AnswerEvidenceLabels }
}

/** Render grounded answers like DocNexus while making every citation interactive. */
function AnswerText({ content, citations = [], onCitationClick, evidence }: AnswerTextProps) {
  const showEvidence = Boolean(evidence)
  const { anchors, trailing, hiddenImages, hiddenTables } = React.useMemo(
    () => (showEvidence
      ? anchorInlineEvidence(content, citations)
      : { anchors: [], trailing: [], hiddenImages: 0, hiddenTables: 0 }),
    [showEvidence, content, citations],
  )

  // Every item this answer shows, anchored or trailing, so ONE owner fetches each
  // preview exactly once however many places read it.
  const allItems = React.useMemo(
    () => [...anchors.flatMap(anchor => anchor.items), ...trailing],
    [anchors, trailing],
  )
  const previews = useEvidencePreviews(allItems)

  const itemsByOffset = React.useMemo(
    () => new Map(anchors.map(anchor => [anchor.offset, anchor.items])),
    [anchors],
  )

  // The plugin identity must be stable per answer, or ReactMarkdown re-runs its whole
  // pipeline on every render — the cost the memoisation below exists to avoid.
  const rehypePlugins = React.useMemo<PluggableList>(
    () => (anchors.length
      ? [rehypeHighlight, [markEvidenceAnchors, anchors.map(anchor => anchor.offset)]]
      : [rehypeHighlight]),
    [anchors],
  )

  const findCitation = (number: number) => findCitationByMarker(citations, number)

  const processCitations = (children: React.ReactNode): React.ReactNode => React.Children.map(children, (child) => {
    if (typeof child === 'string') {
      const nodes: React.ReactNode[] = []
      let last = 0
      // Built fresh: a shared g-flagged regex carries `lastIndex` between calls, and this
      // runs once per text node.
      child.replace(new RegExp(CITATION_MARKER_PATTERN, 'gi'), (match, number: string, offset: number) => {
        if (offset > last) nodes.push(child.slice(last, offset))
        const citation = findCitation(Number(number))
        if (citation) {
          const index = Number(number) > 0 ? Number(number) : 1
          nodes.push(
            <button
              key={`citation-${offset}`}
              type="button"
              className="mx-0.5 inline-flex items-center rounded-md border border-info/40 bg-info/10 px-1.5 py-0.5 align-baseline text-body-sm font-semibold text-info-text transition-colors duration-fast hover:bg-info/20 focus-visible:ring-2 focus-visible:ring-ring"
              title={`${citation.title}${citation.page_number ? ` — page ${citation.page_number}` : ''}`}
              onClick={() => onCitationClick(citation)}
            >
              [{index}]
            </button>,
          )
        } else {
          nodes.push(match)
        }
        last = offset + match.length
        return match
      })
      if (last < child.length) nodes.push(child.slice(last))
      return nodes.length <= 1 ? (nodes[0] ?? child) : nodes
    }
    // The props shape is stated on isValidElement because React 19 types a bare
    // ReactElement's props as `unknown`, which makes both the guard below and the
    // cloneElement call untypable without it.
    if (React.isValidElement<{ children?: React.ReactNode }>(child) && child.props.children) {
      return React.cloneElement(child, { children: processCitations(child.props.children) })
    }
    return child
  })

  const figuresFor = (items: InlineEvidenceItem[]) => items.map(item => (
    <EvidenceFigure
      key={`${item.type}-${item.evidenceId}`}
      item={item}
      previews={previews}
      onSelect={onCitationClick}
      labels={evidence!.labels}
    />
  ))

  /**
   * Render one block, followed by the evidence the anchor plugin assigned to it.
   *
   * The plugin marked exactly one owning block per anchor — the innermost anchorable one
   * — so reading the marker here cannot duplicate a figure across nested blocks. The
   * `data-*` property is consumed rather than forwarded: it is internal plumbing and has
   * no business in the DOM.
   */
  const withCitations = (tag: React.ElementType) => ({ children, node, ...props }: any) => {
    const offsets = anchorOffsetsFromProp(props[ANCHOR_PROPERTY])
    if (ANCHOR_PROPERTY in props) delete props[ANCHOR_PROPERTY]
    const element = React.createElement(tag, props, processCitations(children))
    if (!offsets.length) return element
    const items = offsets.flatMap(offset => itemsByOffset.get(offset) || [])
    if (!items.length) return element
    return (
      <>
        {element}
        {figuresFor(items)}
      </>
    )
  }

  return (
    <div className="markdown-surface chat-answer max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={rehypePlugins}
        components={{
          p: withCitations('p'), li: withCitations('li'), td: withCitations('td'), th: withCitations('th'),
          strong: withCitations('strong'), em: withCitations('em'), span: withCitations('span'),
          blockquote: withCitations('blockquote'), h1: withCitations('h1'), h2: withCitations('h2'),
          h3: withCitations('h3'), h4: withCitations('h4'), h5: withCitations('h5'), h6: withCitations('h6'),
          del: withCitations('del'), code: withCitations('code'),
          table: withCitations('table'), pre: withCitations('pre'),
        }}
      >
        {content}
      </ReactMarkdown>
      {/* Evidence no marker claimed — markers stripped, or citations that named none of
          it. Shown here so nothing the answer cited is silently dropped. */}
      {trailing.length > 0 && <div className="mt-3">{figuresFor(trailing)}</div>}
      {(hiddenImages > 0 || hiddenTables > 0) && (
        <p className="mt-2 text-body-sm text-stone">
          {hiddenImages > 0 ? evidence!.labels.moreImages.replaceAll('{{count}}', String(hiddenImages)) : ''}
          {hiddenImages > 0 && hiddenTables > 0 ? ' ' : ''}
          {hiddenTables > 0 ? evidence!.labels.moreTables.replaceAll('{{count}}', String(hiddenTables)) : ''}
        </p>
      )}
    </div>
  )
}

/* Memoised because the AI page keeps the composer's text in the SAME component that
   renders the message list. Every keystroke therefore re-rendered every answer on
   screen, and each answer re-runs ReactMarkdown with remark-gfm and rehype-highlight —
   a full parse and syntax-highlight pass per character typed. The props here are
   already stable across those renders (`content` is a string off the message,
   `citations` is the array held in state, `onCitationClick` is a useState setter, which
   React guarantees is identity-stable, and `evidence` is memoised by the caller for the
   same reason), so the default shallow comparison is enough to skip the work entirely. */
export default React.memo(AnswerText)
