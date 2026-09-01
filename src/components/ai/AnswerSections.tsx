import React from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypeHighlight from 'rehype-highlight'
import { BookOpen, Sparkles } from 'lucide-react'
import AnswerText, { AnswerCitation } from './AnswerText'

interface AnswerSectionsProps {
  grounded: string
  extended?: string
  citations?: AnswerCitation[]
  onCitationClick: (citation: AnswerCitation) => void
}

function AnswerSections({ grounded, extended = '', citations = [], onCitationClick }: AnswerSectionsProps) {
  // An empty `grounded` string used to render the full "Answer from your Knowledge Base"
  // shell — heading, GROUNDED badge, border — wrapped around nothing. On a retrieval
  // product that is the most damaging state possible: the badge asserts provenance for
  // content that does not exist, so a failed or filtered retrieval reads as a verified
  // answer. Say what actually happened instead, and never show the grounded chrome
  // without grounded text inside it.
  const hasGrounded = grounded.trim().length > 0
  return (
    <div className="space-y-4">
      {hasGrounded ? (
        /* The provenance label is the most trust-bearing text in the product — it is what
           tells a reader whether a claim came from their own documents. It was the hue on
           its own tint (2.61:1 measured), so it now uses the on-tint text tokens. */
        <section className="rounded-surface border border-info/25 bg-info/[0.045] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-info/15 pb-3"><p className="flex items-center gap-2 text-caption font-bold uppercase tracking-widest text-info-text"><span className="grid h-6 w-6 place-items-center rounded-control bg-info/10"><BookOpen size={13} /></span> Answer from your Knowledge Base</p><span className="rounded-full border border-info/25 bg-info/10 px-2 py-1 text-caption font-bold uppercase tracking-[.12em] text-info-text">Grounded</span></div>
          <AnswerText content={grounded} citations={citations} onCitationClick={onCitationClick} />
        </section>
      ) : (
        <section role="status" className="rounded-surface border border-warning/25 bg-warning/[0.06] p-4">
          <p className="flex items-center gap-2 text-caption font-bold uppercase tracking-widest text-warning-text"><span className="grid h-6 w-6 place-items-center rounded-control bg-warning/10"><Sparkles size={13} /></span> No grounded answer</p>
          <p className="mt-2 text-body text-muted-foreground">Nothing in your Knowledge Base matched this question closely enough to answer it. Try different wording, or widen the search on the Search page.</p>
        </section>
      )}
      {extended && (
        <section className="rounded-surface border border-warning/25 bg-warning/[0.045] p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-warning/15 pb-3"><p className="flex items-center gap-2 text-caption font-bold uppercase tracking-widest text-warning-text"><span className="grid h-6 w-6 place-items-center rounded-control bg-warning/10"><Sparkles size={13} /></span> Additional context</p><span className="rounded-full border border-warning/25 bg-warning/10 px-2 py-1 text-caption font-bold uppercase tracking-[.12em] text-warning-text">General knowledge</span></div>
          <div className="markdown-surface chat-answer max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>{extended}</ReactMarkdown>
          </div>
        </section>
      )}
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
export default React.memo(AnswerSections)
