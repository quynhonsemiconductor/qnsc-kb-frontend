import React from 'react'
import { ShieldCheck } from 'lucide-react'
import { BrandMarkGlyph } from '../components/ui/BrandMark'
import { Select } from '../components/ui/Select'
import { useLanguage } from '../i18n/LanguageProvider'

/**
 * The frame the three public credential screens share (accept invite, forgot, reset).
 * LoginPage keeps its own marketing layout; these are single-purpose panels, and one
 * frame keeps them from drifting apart as three near-identical copies.
 */
export function AuthShell({ eyebrow, title, subtitle, children }: {
  eyebrow?: string
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  const { language, setLanguage, t } = useLanguage()

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-5 py-16 sm:px-8">
      <div className="pointer-events-none absolute -left-40 -top-48 h-[560px] w-[560px] rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-56 right-[-8rem] h-[520px] w-[520px] rounded-full bg-info/10 blur-3xl" />
      <div className="absolute right-5 top-5">
        <Select value={language} onChange={event => setLanguage(event.target.value as 'en' | 'vi')} className="theme-select" aria-label={t('language.switch')}>
          <option value="en">English</option>
          <option value="vi">Tiếng Việt</option>
        </Select>
      </div>
      <div className="glass-panel w-full max-w-lg rounded-panel border border-border p-6 shadow-[0_20px_56px_rgb(var(--shadow)/.16)] sm:p-8">
        <div className="mb-7">
          <div className="mb-5 flex items-center gap-3">
            <BrandMarkGlyph className="h-10 w-10" title="QNSC" />
            <div>
              <p className="font-display text-sm font-extrabold tracking-tight text-foreground">QNSC</p>
              <p className="text-caption font-bold uppercase tracking-[.2em] text-stone">Semiconductor</p>
            </div>
          </div>
          {eyebrow && (
            <span className="mb-4 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-caption font-extrabold uppercase tracking-[.14em] text-primary">
              <ShieldCheck size={14} /> {eyebrow}
            </span>
          )}
          <h1 className="font-display text-3xl font-extrabold tracking-[-.04em] text-foreground">{title}</h1>
          {subtitle && <p className="mt-2 text-sm leading-6 text-muted-foreground">{subtitle}</p>}
        </div>
        {children}
      </div>
    </div>
  )
}
