import React, { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowDownRight, ArrowUpRight, Check, Copy, Minus, RefreshCw, ShieldAlert } from 'lucide-react'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Skeleton } from '../ui/Skeleton'
import { useLanguage } from '../../i18n/LanguageProvider'
import { apiErrorStatus, userMessage } from '../../lib/error-handler'
import { formatChange, linePoints, levelTone, pathFromPoints, trend, type Tone } from '../../lib/investigate'
import type { Level } from '../../api/investigate'
import type { PanelState } from '../../hooks/usePanelData'

const TONE_TEXT: Record<Tone, string> = {
  good: 'text-success-text',
  bad: 'text-destructive-text',
  neutral: 'text-muted-foreground',
}

// ── layout ────────────────────────────────────────────────────────────────────────────────

export function Section({
  id,
  eyebrow,
  title,
  description,
  actions,
  children,
}: {
  id: string
  eyebrow?: string
  title: string
  description?: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="space-y-4" aria-labelledby={`${id}-heading`}>
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-border pb-2">
        <div className="min-w-0">
          {eyebrow && <p className="text-caption font-semibold uppercase tracking-[0.2em] text-primary-text">{eyebrow}</p>}
          <h2 id={`${id}-heading`} className="mt-1 text-lg font-bold text-foreground">{title}</h2>
          {description && <p className="mt-1 max-w-3xl text-body-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {children}
    </section>
  )
}

export function Card({ className = '', children }: { className?: string; children: React.ReactNode }) {
  return <div className={`glass-panel rounded-2xl border border-border p-4 ${className}`}>{children}</div>
}

// ── async state ───────────────────────────────────────────────────────────────────────────

/**
 * Render one panel's data, or say plainly why there is none.
 *
 * The three failure states are different facts and read differently: a 404 means this server does not
 * have the endpoint yet (an older API behind a newer dashboard), a 403 means the reader may not see it,
 * and anything else is worth a retry. A refresh that fails after a success keeps the last good data
 * on screen under a notice, so a flaky network never blanks an incident view.
 */
export function AsyncBoundary<T>({
  state,
  onRetry,
  skeleton,
  children,
}: {
  state: PanelState<T>
  onRetry: () => void
  skeleton?: React.ReactNode
  children: (data: T) => React.ReactNode
}) {
  const { t } = useLanguage()
  if (state.data === null && state.loading) {
    return <>{skeleton ?? <Skeleton count={4} className="py-2" />}</>
  }
  if (state.data === null) {
    const status = apiErrorStatus(state.error)
    const message = status === 404 ? t('health.unavailable') : userMessage(state.error, t)
    return (
      <div role="alert" className="flex flex-col items-start gap-3 rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-body-sm text-destructive-text sm:flex-row sm:items-center sm:justify-between">
        <span className="flex items-start gap-2.5 font-medium">
          <ShieldAlert size={18} className="mt-px shrink-0" />
          {message}
        </span>
        {status !== 404 && status !== 403 && (
          <Button variant="danger" size="sm" onClick={onRetry} icon={<RefreshCw size={14} />}>{t('common.retry')}</Button>
        )}
      </div>
    )
  }
  return (
    <div className="space-y-3">
      {state.error !== null && (
        <div role="status" className="flex items-center justify-between gap-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-caption text-warning-text">
          <span className="flex items-center gap-2"><AlertTriangle size={14} />{t('health.staleNotice')}</span>
          <button type="button" onClick={onRetry} className="font-semibold underline underline-offset-2">{t('common.retry')}</button>
        </div>
      )}
      {children(state.data)}
    </div>
  )
}

// ── small controls ────────────────────────────────────────────────────────────────────────

export function Segmented<T extends string | number>({
  value,
  options,
  onChange,
  ariaLabel,
}: {
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
  ariaLabel: string
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="inline-flex rounded-lg border border-border bg-surface p-0.5">
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={String(option.value)}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`min-h-8 rounded-md px-3 text-body-sm font-semibold transition-colors duration-fast ${
              selected ? 'bg-primary text-primary-foreground shadow-raised' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function CopyButton({ value, label, className = '' }: { value: string; label: string; className?: string }) {
  const { t } = useLanguage()
  const [copied, setCopied] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // Clipboard access can be refused (insecure context, permissions). Nothing to recover: the
      // text is on screen and selectable, which is the fallback.
    }
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      aria-label={copied ? t('health.copied') : label}
      title={copied ? t('health.copied') : label}
      className={`inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-surface-soft hover:text-foreground ${className}`}
    >
      {copied ? <Check size={13} className="text-success-text" /> : <Copy size={13} />}
    </button>
  )
}

export function LevelBadge({ level, children }: { level: Level | undefined; children: React.ReactNode }) {
  return <Badge variant={levelTone(level)} dot size="md">{children}</Badge>
}

// ── figures ───────────────────────────────────────────────────────────────────────────────

/** A change against the previous window, coloured by whether that direction is bad for the figure. */
export function Delta({
  change,
  unit,
  worseWhen,
  noneLabel,
}: {
  change: number | null | undefined
  unit: '%' | 'pp'
  worseWhen: 'up' | 'down' | 'none'
  noneLabel: string
}) {
  const { direction, tone } = trend(change, worseWhen, unit === 'pp' ? 0.1 : 0.5)
  if (direction === 'none') return <span className="text-caption text-muted-foreground">{noneLabel}</span>
  const Icon = direction === 'up' ? ArrowUpRight : direction === 'down' ? ArrowDownRight : Minus
  return (
    <span className={`inline-flex items-center gap-0.5 text-caption font-semibold ${TONE_TEXT[tone]}`}>
      <Icon size={13} aria-hidden="true" />
      {formatChange(change, unit)}
    </span>
  )
}

export function Sparkline({ values, className }: { values: Array<number | null>; className: string }) {
  const max = Math.max(1, ...values.map((value) => value ?? 0))
  const path = pathFromPoints(linePoints(values, 100, 24, max))
  if (!path) return null
  return (
    <svg viewBox="0 0 100 24" preserveAspectRatio="none" className="h-6 w-full" aria-hidden="true">
      <path d={path} className={`${className} fill-none`} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export function StatCard({
  label,
  value,
  detail,
  icon,
  valueClassName = 'text-foreground',
  delta,
  spark,
}: {
  label: string
  value: React.ReactNode
  detail?: React.ReactNode
  icon?: React.ReactNode
  valueClassName?: string
  delta?: React.ReactNode
  spark?: React.ReactNode
}) {
  return (
    <Card className="space-y-2">
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
        {icon}
      </div>
      <div className="flex items-baseline justify-between gap-2">
        <div className={`text-2xl font-extrabold ${valueClassName}`}>{value}</div>
        {delta}
      </div>
      {spark}
      {detail && <div className="text-caption text-muted-foreground">{detail}</div>}
    </Card>
  )
}

export function EmptyNote({ children }: { children: React.ReactNode }) {
  return <div className="rounded-xl border border-dashed border-border p-6 text-center text-body-sm text-muted-foreground">{children}</div>
}
