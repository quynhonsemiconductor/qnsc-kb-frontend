import React from 'react'
import { ShieldCheck } from 'lucide-react'
import { BrandMarkGlyph } from '../components/ui/BrandMark'
import { Select } from '../components/ui/Select'
import { useLanguage } from '../i18n/LanguageProvider'

export function AuthShell({ eyebrow, title, subtitle, children }: {
  eyebrow?: string
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  const { language, setLanguage, t } = useLanguage()

  return (
    <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(20rem,.8fr)_minmax(30rem,1.2fr)]">
      <aside className="relative hidden overflow-hidden bg-primary p-12 text-primary-foreground lg:flex lg:flex-col">
        <div className="flex items-center gap-3"><BrandMarkGlyph className="h-10 w-10" title="QNSC" /><div><p className="font-display text-body-lg font-bold">QNSC Knowledge</p><p className="font-mono text-caption uppercase tracking-[.12em] text-white/60">Enterprise knowledge workspace</p></div></div>
        <div className="my-auto max-w-md"><p className="font-mono text-caption uppercase tracking-[.12em] text-white/60">Trusted company knowledge</p><h2 className="mt-4 font-display text-4xl font-bold leading-tight tracking-[-.04em]">Find the right document. Ask grounded AI. Keep knowledge governed.</h2><p className="mt-5 text-body-lg leading-7 text-white/65">One workspace for approved documents, source-aware answers, and controlled publishing.</p></div>
        <p className="text-caption text-white/50">QNSC Semiconductor</p>
      </aside>
      <main className="relative flex items-center justify-center px-5 py-16 sm:px-8">
        <div className="absolute right-5 top-5"><Select value={language} onChange={event => setLanguage(event.target.value as 'en' | 'vi')} className="theme-select" aria-label={t('language.switch')}><option value="en">English</option><option value="vi">Tiếng Việt</option></Select></div>
        <div className="w-full max-w-lg rounded-panel border border-border bg-surface-elevated p-6 shadow-popover sm:p-8">
          <div className="mb-7 lg:hidden"><div className="mb-5 flex items-center gap-3"><BrandMarkGlyph className="h-10 w-10" title="QNSC" /><div><p className="font-display text-body font-bold text-foreground">QNSC Knowledge</p><p className="font-mono text-caption uppercase tracking-[.12em] text-muted">Enterprise workspace</p></div></div></div>
          {eyebrow && <span className="mb-4 inline-flex items-center gap-2 text-caption font-bold uppercase tracking-[.1em] text-primary-text"><ShieldCheck size={14} />{eyebrow}</span>}
          <h1 className="font-display text-3xl font-bold tracking-[-.035em] text-foreground">{title}</h1>
          {subtitle && <p className="mt-2 text-body leading-6 text-muted-foreground">{subtitle}</p>}
          <div className="mt-7">{children}</div>
        </div>
      </main>
    </div>
  )
}
