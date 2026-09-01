import React from 'react'
import type { LucideIcon } from 'lucide-react'

type PageHeaderProps = {
  eyebrow: string
  title: string
  description: string
  icon: LucideIcon
  actions?: React.ReactNode
  accent?: 'primary' | 'info' | 'success' | 'warning'
}

const accentClasses = {
  primary: 'bg-primary/12 text-primary border-primary/20',
  info: 'bg-info/12 text-info border-info/20',
  success: 'bg-success/12 text-success border-success/20',
  warning: 'bg-warning/12 text-warning border-warning/20',
}

export default function PageHeader({ eyebrow, title, description, icon: Icon, actions, accent = 'primary' }: PageHeaderProps) {
  return (
    /* Was `page-hero glass-panel soft-grid signal-line` plus two absolutely-positioned
       blur blobs. Four decorative layers and an infinite scanning-line animation, on the
       header of all 14 pages that use this component.

       They are gone for three reasons. The animation re-painted a full-width strip forever
       on every route, for no information. `overflow-hidden` — needed only to clip those
       blobs — is what made the wrap handling below load-bearing in the first place, and it
       silently clipped any action row that could not wrap. And a 30px title over a gradient
       wash is the generic-AI-dashboard look: it spends the top of every screen on chrome
       instead of on the documents people came for.

       What remains is a bottom rule. The heading and its actions provide the hierarchy;
       the page below provides the content. */
    <header className="relative border-b border-border pb-4">
      {/* Every row may wrap, the title column may shrink (min-w-0) rather than push the
          actions off the edge, and long unbroken strings break instead of overflowing. */}
      <div className="flex flex-col justify-between gap-x-6 gap-y-4 md:flex-row md:items-start">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-caption font-bold uppercase tracking-[.14em] text-muted">
            <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-control border ${accentClasses[accent]}`}><Icon size={15} /></span>
            <span className="min-w-0 break-words">{eyebrow}</span>
          </div>
          <h1 className="font-display mt-2 break-words text-h2 font-extrabold tracking-tight text-foreground">{title}</h1>
          <p className="mt-1 max-w-2xl text-body leading-6 text-muted-foreground">{description}</p>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 md:justify-end">{actions}</div>}
      </div>
    </header>
  )
}
