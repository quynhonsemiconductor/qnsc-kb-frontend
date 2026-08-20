import React, { useMemo } from 'react'
import { Activity, ArrowRight, ArrowUpRight, BookOpen, CheckCircle2, Clock3, FileCheck2, FolderTree, Plus, Search, ShieldCheck, Sparkles, UploadCloud } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getHomeSummary } from '../api/knowledge'
import type { HomeSummary } from '../types/governance'
import { usePermission } from '../hooks/usePermission'
import { useAuth } from '../auth/useAuth'
import { useLanguage } from '../i18n/LanguageProvider'
import { useAsyncResource } from '../hooks/useAsyncResource'

function Metric({ label, value, detail, Icon, tone }: { label: string; value: number | string; detail: string; Icon: React.ElementType; tone: 'primary' | 'warning' | 'info' | 'success' }) {
  const tones = {
    primary: 'bg-primary/10 text-primary ring-primary/20',
    warning: 'bg-warning/10 text-warning ring-warning/20',
    info: 'bg-info/10 text-info ring-info/20',
    success: 'bg-success/10 text-success ring-success/20',
  }
  return <article className="interactive-lift group relative overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-[0_12px_30px_rgb(var(--shadow)/.10)]">
    <div className="pointer-events-none absolute right-0 top-0 h-20 w-20 rounded-full bg-foreground/[.025] blur-2xl" />
    <div className="relative flex items-start justify-between"><div><p className="text-[12px] font-bold uppercase tracking-[.14em] text-muted-foreground">{label}</p><p className="mt-2 text-4xl font-semibold tracking-tight text-foreground">{value}</p></div><span className={`grid h-9 w-9 place-items-center rounded-lg ring-1 ${tones[tone]}`}><Icon size={17} /></span></div>
    <p className="relative mt-3 text-sm text-muted-foreground">{detail}</p>
  </article>
}

export default function HomePage() {
  const { data: summary, error: loadError } = useAsyncResource<HomeSummary>('home-summary', getHomeSummary)
  const { has } = usePermission()
  const { user } = useAuth()
  const { t } = useLanguage()
  const ownerCoverage = useMemo(() => summary ? Math.max(0, Math.min(100, summary.with_owner_percent)) : 0, [summary])

  if (!summary) return loadError ? <div className="page-shell-wide page-stack"><div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">Failed to load. Please retry.</div></div> : <div className="grid min-h-[65vh] place-items-center"><div className="flex items-center gap-3 text-base text-muted-foreground"><Activity size={17} className="animate-pulse text-info" />Loading the control room…</div></div>

  return <div className="page-shell-wide page-stack pb-8">
    <header className="page-hero glass-panel soft-grid relative overflow-hidden rounded-panel border border-border px-5 py-6 pb-8 md:px-7 md:py-7">
      <div className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full bg-primary/20 blur-3xl" /><div className="pointer-events-none absolute bottom-[-10rem] right-[28%] h-64 w-64 rounded-full bg-info/10 blur-3xl" /><div className="pointer-events-none absolute right-8 top-8 hidden h-44 w-44 opacity-60 xl:block"><div className="hero-orb h-full w-full"><div className="orbit-ring" /><div className="orb-core text-2xl">Q</div></div></div>
      <div className="relative flex flex-col gap-6 2xl:flex-row 2xl:flex-wrap 2xl:items-end">
        <div className="min-w-0 max-w-2xl 2xl:flex-1"><div className="mb-4 inline-flex items-center gap-2 rounded-full border border-success/25 bg-success/10 px-3 py-1.5 text-[12px] font-bold uppercase tracking-[.15em] text-success"><span className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_10px_rgb(var(--success)/.65)]" /> {t('home.healthy')}</div><p className="mb-2 text-base font-semibold text-info">{t('home.goodMorning', { name: user?.name?.split(' ')[0] || 'bạn' })}</p><h1 className="font-display text-4xl font-extrabold leading-[1.05] tracking-[-.05em] text-foreground sm:text-5xl">{t('home.headline')}</h1><p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">{t('home.subtitle')}</p></div>
        <div className="grid w-full gap-2 sm:grid-cols-2 2xl:w-[380px] 2xl:shrink-0"><div className="rounded-2xl border border-border bg-surface/70 p-4"><div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[.14em] text-stone"><Sparkles size={13} className="text-warning" /> {t('home.todaysFocus')}</div><p className="mt-3 text-xl font-bold text-foreground">{summary.pending_drafts ? t('home.drafts', { count: summary.pending_drafts }) : t('home.libraryClear')}</p><p className="mt-1 text-sm leading-5 text-muted-foreground">{summary.pending_drafts ? t('home.readyReview') : t('home.noApprovals')}</p></div><div className="flex flex-col justify-between rounded-2xl border border-primary/20 bg-primary/10 p-4"><div className="flex items-center justify-between text-[12px] font-bold uppercase tracking-[.14em] text-primary-muted"><span>{t('home.workspacePulse')}</span><ArrowUpRight size={14} /></div><p className="mt-3 text-xl font-bold text-foreground">{t('home.owned', { percent: ownerCoverage })}</p><p className="mt-1 text-sm leading-5 text-muted-foreground">{t('home.clearSteward')}</p></div></div>
        {has('article.create') && <div className="flex flex-wrap gap-2 2xl:basis-full"><Link to="/sources" className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm font-bold text-foreground transition hover:border-info/40 hover:bg-surface-soft"><UploadCloud size={15} className="text-info" /> {t('home.uploadSource')}</Link><Link to="/articles/new" className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-[0_8px_20px_rgb(var(--primary)/.22)] transition hover:-translate-y-0.5 hover:bg-primary/90"><Plus size={15} /> {t('home.newArticle')}</Link></div>}
      </div>
    </header>

    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4 xl:pt-1">
      <Metric label={t('home.knowledgeLibrary')} value={summary.total_articles} detail={t('home.publishedTrusted')} Icon={BookOpen} tone="primary" />
      <Metric label={t('home.approvalInbox')} value={summary.pending_drafts} detail={t('home.waitingDecision')} Icon={FileCheck2} tone="warning" />
      <Metric label={t('home.openGaps')} value={summary.open_gaps} detail={t('home.questionsNoAnswer')} Icon={Search} tone="info" />
      <Metric label={t('home.departments')} value={summary.departments} detail={t('home.teamsKnowledge')} Icon={FolderTree} tone="success" />
    </section>

    <section className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,.8fr)]">
      <article className="overflow-hidden rounded-xl border border-border bg-card shadow-[0_12px_28px_rgb(var(--shadow)/.10)]">
        <div className="flex items-center justify-between border-b border-border px-5 py-4"><div><p className="text-[12px] font-bold uppercase tracking-[.15em] text-muted-foreground">Latest activity</p><h2 className="mt-1 text-lg font-semibold text-foreground">Recently reviewed knowledge</h2></div><Link to="/articles" className="inline-flex items-center gap-1 text-sm font-bold text-primary transition hover:text-info">Open library <ArrowRight size={14} /></Link></div>
        <div className="divide-y divide-border">{summary.recent.length ? summary.recent.map((article, index) => <Link key={article.id} to={`/articles/${article.id}`} className="group flex items-center gap-3 px-5 py-4 transition hover:bg-surface-soft"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><BookOpen size={16} /></div><div className="min-w-0 flex-1"><div className="flex min-w-0 items-center gap-2"><h3 className="truncate text-base font-semibold text-foreground group-hover:text-info">{article.title}</h3>{article.needs_update && <span className="hidden rounded-full border border-warning/20 bg-warning/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-warning sm:inline">Update due</span>}</div><p className="mt-1 truncate text-sm text-muted-foreground">{article.dept || 'Unassigned department'} · {article.owner || 'No owner'}</p></div><div className="hidden text-right sm:block"><p className="text-[12px] font-semibold text-success">Verified</p><p className="mt-1 text-[12px] text-muted">#{String(index + 1).padStart(2, '0')}</p></div><ArrowRight size={15} className="shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-info" /></Link>) : <div className="px-5 py-12 text-center text-base text-muted-foreground">Your recently reviewed documents will appear here.</div>}</div>
      </article>

      <div className="space-y-5">
        <article className="rounded-xl border border-border bg-surface-elevated p-5 shadow-[0_12px_28px_rgb(var(--shadow)/.12)]"><div className="flex items-start justify-between"><div><p className="text-[12px] font-bold uppercase tracking-[.15em] text-muted-foreground">Governance pulse</p><h2 className="mt-1 text-lg font-semibold text-foreground">Knowledge health</h2></div><span className="grid h-9 w-9 place-items-center rounded-lg bg-success/10 text-success"><ShieldCheck size={17} /></span></div><div className="mt-6 flex items-end gap-4"><div className="text-5xl font-semibold tracking-tight text-foreground">{ownerCoverage}<span className="text-xl text-muted-foreground">%</span></div><p className="mb-1 text-sm text-muted-foreground">of articles have a clear owner</p></div><div className="mt-3 h-2 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-gradient-to-r from-info to-success transition-all" style={{ width: `${ownerCoverage}%` }} /></div><div className="mt-5 border-t border-border pt-4"><p className="text-2xl font-semibold text-warning">{summary.needs_review}</p><p className="mt-1 text-[12px] uppercase tracking-wide text-muted">Need review</p></div><Link to="/governance/health" className="mt-5 inline-flex items-center gap-1 text-sm font-bold text-info hover:text-foreground">View health report <ArrowRight size={14} /></Link></article>
        <article className="rounded-xl border border-border bg-card p-5"><div className="flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-lg bg-warning/10 text-warning"><Clock3 size={17} /></span><div><p className="text-[12px] font-bold uppercase tracking-[.15em] text-muted-foreground">Next action</p><h2 className="mt-0.5 text-base font-semibold text-foreground">Keep work moving</h2></div></div><p className="mt-4 text-base leading-7 text-muted-foreground">{summary.pending_drafts ? `${summary.pending_drafts} submitted document${summary.pending_drafts === 1 ? ' is' : 's are'} waiting in the review queue.` : 'The approval queue is clear. New submissions will appear here.'}</p>{has('governance.read') && <Link to="/governance/pending-drafts" className="mt-4 flex items-center justify-between rounded-lg border border-border bg-surface px-3 py-2.5 text-sm font-bold text-foreground transition hover:bg-surface-soft"><span>Open approval inbox</span><ArrowRight size={15} className="text-warning" /></Link>}</article>
      </div>
    </section>

    <footer className="flex flex-wrap items-center gap-x-5 gap-y-2 rounded-xl border border-border bg-surface px-4 py-3 text-sm text-muted"><span className="inline-flex items-center gap-2"><CheckCircle2 size={14} className="text-success" /> Source storage secured</span><span className="inline-flex items-center gap-2"><ShieldCheck size={14} className="text-primary" /> Department-aware access active</span><span className="inline-flex items-center gap-2"><Activity size={14} className="text-info" /> Workflow monitoring enabled</span></footer>
  </div>
}
