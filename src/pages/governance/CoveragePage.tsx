import React, { useEffect, useState } from 'react'
import { AlertTriangle, BarChart3, CheckCircle2, FileQuestion } from 'lucide-react'
import { getConflicts, getCoverage, resolveConflict } from '../../api/knowledge'
import PageHeader from '../../components/ui/PageHeader'
import { useDialog } from '../../components/ui/DialogProvider'

export default function CoveragePage() {
  const [data, setData] = useState<any>(null)
  const [conflicts, setConflicts] = useState<any[]>([])
  const dialog = useDialog()
  const load = async () => { setData(await getCoverage()); setConflicts(await getConflicts()) }
  useEffect(() => { void load().catch(console.error) }, [])
  if (!data) return <div className="page-shell p-8 text-muted-foreground">Loading coverage map…</div>
  return <div className="page-shell page-stack">
    <PageHeader eyebrow="Knowledge operations" title="Coverage map" description="See what teams ask, where the knowledge gaps are, and which documents are never cited." icon={BarChart3} />
    <section className="grid gap-4 md:grid-cols-3">
      <article className="glass-panel rounded-2xl border border-border p-5"><p className="text-xs font-bold uppercase tracking-wider text-muted">Visible articles</p><p className="mt-2 text-3xl font-bold text-foreground">{data.visible_article_count}</p></article>
      <article className="glass-panel rounded-2xl border border-border p-5"><p className="text-xs font-bold uppercase tracking-wider text-muted">Cited articles</p><p className="mt-2 text-3xl font-bold text-success">{data.cited_article_count}</p></article>
      <article className="glass-panel rounded-2xl border border-border p-5"><p className="text-xs font-bold uppercase tracking-wider text-muted">Open conflict records</p><p className="mt-2 text-3xl font-bold text-warning">{conflicts.length}</p></article>
    </section>
    <section className="grid gap-5 lg:grid-cols-2">
      <article className="glass-panel rounded-2xl border border-border p-5"><h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground"><FileQuestion size={18} className="text-info" /> Gaps by department</h2><div className="mt-4 space-y-3">{data.gaps_by_department.length ? data.gaps_by_department.map((item: any) => <div key={item.dept} className="flex items-center justify-between rounded-xl bg-surface px-3 py-2 text-sm"><span>{item.dept}</span><strong>{item.gap_count}</strong></div>) : <p className="text-sm text-muted">No open gaps in your visible scope.</p>}</div></article>
      <article className="glass-panel rounded-2xl border border-border p-5"><h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground"><AlertTriangle size={18} className="text-warning" /> Never-cited documents</h2><div className="mt-4 space-y-2">{data.never_cited.length ? data.never_cited.slice(0, 20).map((item: any) => <div key={item.id} className="rounded-xl bg-surface px-3 py-2"><p className="truncate text-sm font-semibold text-foreground">{item.title}</p><p className="text-xs text-muted">{item.dept}</p></div>) : <p className="text-sm text-muted">Every visible document has appeared in an AI citation.</p>}</div></article>
    </section>
    <section className="glass-panel rounded-2xl border border-border p-5"><h2 className="font-display text-lg font-bold text-foreground">Conflict resolution</h2><div className="mt-4 space-y-3">{conflicts.length ? conflicts.map((item) => <div key={item.id} className="rounded-xl border border-warning/20 bg-warning/5 p-4"><p className="font-semibold text-foreground">{item.fact}</p><p className="mt-1 text-xs text-muted">{item.article_ids.length} conflicting articles</p><button type="button" className="mt-3 inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground" onClick={async () => { const note = await dialog.prompt('How was this conflict resolved?', { title: 'Resolve conflict', confirmLabel: 'Resolve', placeholder: 'Resolution note' }); if (note) { await resolveConflict(item.id, note); await load() } }}><CheckCircle2 size={14} /> Mark resolved</button></div>) : <p className="text-sm text-muted">No unresolved conflicts.</p>}</div></section>
  </div>
}
