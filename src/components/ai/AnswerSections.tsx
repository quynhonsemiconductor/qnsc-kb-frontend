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
  return (
    <div className="space-y-4">
      <section className="rounded-2xl border border-info/20 bg-info/[0.045] p-4 shadow-[0_10px_28px_rgb(var(--shadow)/.06)]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-info/10 pb-3"><p className="flex items-center gap-2 text-caption font-bold uppercase tracking-widest text-info"><span className="grid h-6 w-6 place-items-center rounded-lg bg-info/10"><BookOpen size={13} /></span> Answer from your Knowledge Base</p><span className="rounded-full border border-info/20 bg-info/10 px-2 py-1 text-caption font-bold uppercase tracking-[.12em] text-info">Grounded</span></div>
        <AnswerText content={grounded} citations={citations} onCitationClick={onCitationClick} />
      </section>
      {extended && (
        <section className="rounded-2xl border border-warning/20 bg-warning/[0.045] p-4 shadow-[0_10px_28px_rgb(var(--shadow)/.06)]">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-warning/10 pb-3"><p className="flex items-center gap-2 text-caption font-bold uppercase tracking-widest text-warning"><span className="grid h-6 w-6 place-items-center rounded-lg bg-warning/10"><Sparkles size={13} /></span> Additional context</p><span className="rounded-full border border-warning/20 bg-warning/10 px-2 py-1 text-caption font-bold uppercase tracking-[.12em] text-warning">General knowledge</span></div>
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
