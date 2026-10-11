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
  primary: 'text-primary',
  info: 'text-info-text',
  success: 'text-success-text',
  warning: 'text-warning-text',
}

export default function PageHeader({ eyebrow, title, description, icon: Icon, actions, accent = 'primary' }: PageHeaderProps) {
  return (
    <header className="border-b border-border pb-5">
      <div className="flex flex-col justify-between gap-x-8 gap-y-4 md:flex-row md:items-end">
        <div className="min-w-0 flex-1">
          <div className={`flex items-center gap-2 font-mono text-caption font-medium uppercase tracking-[.1em] ${accentClasses[accent]}`}>
            <Icon size={14} className="shrink-0" />
            <span className="min-w-0 break-words">{eyebrow}</span>
          </div>
          <h1 className="mt-2 break-words font-display text-h1 font-bold tracking-[-.035em] text-foreground">{title}</h1>
          <p className="mt-2 max-w-3xl text-body leading-6 text-muted-foreground">{description}</p>
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2 md:justify-end">{actions}</div>}
      </div>
    </header>
  )
}
