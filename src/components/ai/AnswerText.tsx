import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'

export interface AnswerCitation {
  source_index?: number
  article_id: string
  title: string
  source_ref: string
  section_ref?: string
  page_number?: number
}

interface AnswerTextProps {
  content: string
  citations?: AnswerCitation[]
  onCitationClick: (citation: AnswerCitation) => void
}

// Backend citations use stable IDs such as [C1], while older answers used
// numeric markers such as [1]. Render both as clickable source references.
const CITATION_REGEX = /\[(?:Source ID:\s*)?(?:C)?(\d+)\]/gi

/** Render grounded answers like DocNexus while making every citation interactive. */
function AnswerText({ content, citations = [], onCitationClick }: AnswerTextProps) {
  const findCitation = (number: number) => citations.find((citation) => citation.source_index === number)
    || (citations.every((citation) => citation.source_index == null) ? citations[number > 0 ? number - 1 : 0] : undefined)

  const processCitations = (children: React.ReactNode): React.ReactNode => React.Children.map(children, (child) => {
    if (typeof child === 'string') {
      const nodes: React.ReactNode[] = []
      let last = 0
      child.replace(CITATION_REGEX, (match, number: string, offset: number) => {
        if (offset > last) nodes.push(child.slice(last, offset))
        const citation = findCitation(Number(number))
        if (citation) {
          const index = Number(number) > 0 ? Number(number) : 1
          nodes.push(
            <button
              key={`citation-${offset}`}
              type="button"
              className="mx-0.5 inline-flex items-center rounded-md border border-minimaxBlue/40 bg-blue-500/15 px-1.5 py-0.5 align-baseline text-body-sm font-semibold text-blue-300 transition hover:bg-blue-500/25"
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

  const withCitations = (tag: React.ElementType) => ({ children, ...props }: any) =>
    React.createElement(tag, props, processCitations(children))

  return (
    <div className="markdown-surface chat-answer max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          p: withCitations('p'), li: withCitations('li'), td: withCitations('td'), th: withCitations('th'),
          strong: withCitations('strong'), em: withCitations('em'), span: withCitations('span'),
          blockquote: withCitations('blockquote'), h1: withCitations('h1'), h2: withCitations('h2'),
          h3: withCitations('h3'), h4: withCitations('h4'), h5: withCitations('h5'), h6: withCitations('h6'),
          del: withCitations('del'), code: withCitations('code'),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  )
}

/* Memoised because the AI page keeps the composer's text in the SAME component that
   renders the message list. Every keystroke therefore re-rendered every answer on
   screen, and each answer re-runs ReactMarkdown with remark-gfm and rehype-highlight —
   a full parse and syntax-highlight pass per character typed. The props here are
   already stable across those renders (`content` is a string off the message,
   `citations` is the array held in state, and `onCitationClick` is a useState setter,
   which React guarantees is identity-stable), so the default shallow comparison is
   enough to skip the work entirely. */
export default React.memo(AnswerText)
