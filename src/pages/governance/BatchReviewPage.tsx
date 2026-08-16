import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft, Building2, Check, CheckCircle2, FileText, GitMerge, Lightbulb, Plus, Scissors, Sparkles, Trash2, Type } from 'lucide-react'
import { commitDraftCandidates, getDraftCandidates, getPendingDrafts, reviewDraftCandidate } from '../../api/governance'
import { createDepartment, listDepartments } from '../../api/auth'
import { useDialog } from '../../components/ui/DialogProvider'

type Department = { id: string; name: string; description: string; company_domain: string; active: boolean }
type Candidate = {
  id: string; position: number; title: string; body_md: string; source_start: number; source_end: number
  heading?: string | null; status: string; review_note?: string | null; department_ids: string[]
  department_suggestions: { department_id: string; name: string; description: string; score: number }[]
  proposed_department?: { name: string; description: string } | null
}

const normalizeCandidates = (items: Candidate[]): Candidate[] => items.map(item => ({
  ...item,
  department_ids: item.department_ids ?? [],
  department_suggestions: item.department_suggestions ?? [],
  proposed_department: item.proposed_department ?? null,
}))

export default function BatchReviewPage() {
  const { id = '' } = useParams()
  const navigate = useNavigate(); const dialog = useDialog()
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const [formatting, setFormatting] = useState(false)
  const activeDepartments = useMemo(() => departments.filter(item => item.active), [departments])
  const active = candidates.filter(item => item.status === 'candidate')
  const allRouted = active.every(item => (item.department_ids?.length ?? 0) > 0)

  const load = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try { const [nextCandidates, nextDepartments, drafts] = await Promise.all([getDraftCandidates(id), listDepartments(), getPendingDrafts('pending')]); setCandidates(normalizeCandidates(nextCandidates)); setDepartments(nextDepartments); setFormatting(['queued', 'processing'].includes(drafts.find((draft: { id: string; restructure_status?: string }) => draft.id === id)?.restructure_status || '')); setError('') }
    catch { setError('Could not load split candidates.') }
    finally { if (showLoading) setLoading(false) }
  }
  useEffect(() => { void load() }, [id])
  useEffect(() => { if (!formatting) return; const timer = window.setInterval(() => void load(false), 4000); return () => window.clearInterval(timer) }, [formatting, id])
  const operate = async (payload: Parameters<typeof reviewDraftCandidate>[1]) => {
    setBusy(true)
    try { setCandidates(normalizeCandidates(await reviewDraftCandidate(id, payload))) }
    catch (requestError: any) { await dialog.alert(requestError?.response?.data?.detail || 'The candidate operation failed.', { title: 'Batch review failed', tone: 'danger' }) }
    finally { setBusy(false) }
  }
  const setDepartmentsForCandidate = async (candidate: Candidate, departmentIds: string[]) => {
    await operate({ operation: 'set_departments', candidate_id: candidate.id, department_ids: departmentIds })
  }
  const rename = async (candidate: Candidate) => {
    const title = (await dialog.prompt('Candidate title:', { title: 'Rename candidate', defaultValue: candidate.title, confirmLabel: 'Rename' }))?.trim()
    if (title) await operate({ operation: 'rename', candidate_id: candidate.id, title })
  }
  const split = async (candidate: Candidate) => {
    const raw = await dialog.prompt(`Split position in characters (1-${candidate.body_md.length - 1}):`, { title: 'Split candidate', defaultValue: String(Math.floor(candidate.body_md.length / 2)), confirmLabel: 'Split', validate: value => Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) < candidate.body_md.length ? undefined : 'Enter a whole-number position inside the candidate.' })
    const splitAt = Number(raw)
    if (Number.isInteger(splitAt) && splitAt > 0) await operate({ operation: 'split', candidate_id: candidate.id, split_at: splitAt })
  }
  const merge = async (candidate: Candidate) => {
    const next = active.find(item => item.position > candidate.position)
    if (next) await operate({ operation: 'merge', candidate_id: candidate.id, other_candidate_id: next.id })
  }
  const discard = async (candidate: Candidate) => {
    if (await dialog.confirm(`Discard “${candidate.title}”?`, { title: 'Discard candidate', confirmLabel: 'Discard', tone: 'danger' })) await operate({ operation: 'discard', candidate_id: candidate.id })
  }
  const createSuggestedDepartment = async (candidate: Candidate) => {
    const proposed = candidate.proposed_department
    if (!proposed) return
    setBusy(true)
    try {
      const created = await createDepartment({ name: proposed.name, description: proposed.description })
      setDepartments(items => [...items, created])
      setCandidates(normalizeCandidates(await reviewDraftCandidate(id, { operation: 'set_departments', candidate_id: candidate.id, department_ids: [created.id] })))
    } catch (requestError: any) { await dialog.alert(requestError?.response?.data?.detail || 'Could not create the suggested department.', { title: 'Department creation failed', tone: 'danger' }) }
    finally { setBusy(false) }
  }
  const commit = async () => {
    if (!active.length || !allRouted) return
    if (!await dialog.confirm(`Commit ${active.length} formatted candidate${active.length === 1 ? '' : 's'} as independent drafts?`, { title: 'Commit split output', confirmLabel: 'Create drafts', tone: 'success' })) return
    setBusy(true)
    try { await commitDraftCandidates(id); await dialog.alert('The reviewed candidates are now independent drafts in the approval queue.', { title: 'Batch review committed', tone: 'success' }); navigate('/governance/pending-drafts') }
    catch (requestError: any) { await dialog.alert(requestError?.response?.data?.detail || 'The candidates could not be committed.', { title: 'Commit failed', tone: 'danger' }) }
    finally { setBusy(false) }
  }

  return <main className="page-shell page-stack p-3 text-ink sm:p-4 lg:p-0">
    <header className="page-hero glass-panel rounded-panel border border-border p-5 sm:p-6"><button type="button" onClick={() => navigate(-1)} className="mb-5 inline-flex items-center gap-2 text-xs font-semibold text-stone hover:text-ink"><ArrowLeft size={14} /> Back to pending drafts</button><div className="flex flex-wrap items-end justify-between gap-4"><div><div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[.18em] text-cyan"><Sparkles size={14} /> AI-formatted document review</div><h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">Batch review</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-steel">Review the formatted Markdown, confirm the suggested owning department, then create independent knowledge drafts.</p></div><button type="button" onClick={() => void commit()} disabled={busy || !active.length || !allRouted} className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-xs font-bold text-primary-foreground disabled:opacity-50"><CheckCircle2 size={15} /> Commit reviewed drafts</button></div>{active.length > 0 && !allRouted && <p className="mt-4 rounded-lg border border-amber-300/20 bg-amber-400/[0.08] px-3 py-2 text-xs text-amber-100">Choose a department for every kept candidate before committing.</p>}</header>
    {error && <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}
    {loading ? <div className="rounded-xl border border-border p-8 text-sm text-stone">Loading formatted candidates…</div> : formatting ? <div className="rounded-2xl border border-cyan/25 bg-cyan/[0.06] p-8 text-center"><Sparkles size={22} className="mx-auto animate-pulse text-cyan" /><h2 className="mt-3 font-semibold text-foreground">AI is formatting before splitting</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-steel">The raw source is intentionally hidden here. This page will refresh automatically once AI has created its Markdown sections and routing suggestions.</p></div> : <section className="space-y-4">{candidates.map(candidate => <article key={candidate.id} className={`overflow-hidden rounded-2xl border ${candidate.status === 'candidate' ? 'border-border bg-card shadow-[0_10px_28px_rgb(var(--shadow)/.07)]' : 'border-border/50 bg-surface/40 opacity-60'}`}><header className="flex flex-col gap-3 border-b border-border bg-surface px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><div><div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[.14em] text-stone"><span>Candidate {candidate.position}</span><span>Formatted chars {candidate.source_start}–{candidate.source_end}</span>{candidate.heading && <span className="text-cyan">{candidate.heading}</span>}<span className={candidate.status === 'candidate' ? 'text-emerald-300' : 'text-stone'}>{candidate.status}</span></div><h2 className="mt-1 font-semibold text-foreground">{candidate.title}</h2></div>{candidate.status === 'candidate' && <div className="flex shrink-0 flex-wrap gap-2"><button type="button" disabled={busy} onClick={() => void rename(candidate)} className="mm-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold"><Type size={13} /> Rename</button><button type="button" disabled={busy} onClick={() => void split(candidate)} className="mm-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold"><Scissors size={13} /> Split</button><button type="button" disabled={busy || !active.some(item => item.position > candidate.position)} onClick={() => void merge(candidate)} className="mm-secondary inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold"><GitMerge size={13} /> Merge next</button><button type="button" disabled={busy} onClick={() => void discard(candidate)} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-400/25 px-3 py-2 text-xs font-semibold text-rose-300"><Trash2 size={13} /> Discard</button></div>}</header><div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_20rem]"><div className="markdown-surface max-w-none px-5 py-5"><ReactMarkdown remarkPlugins={[remarkGfm]}>{candidate.body_md}</ReactMarkdown></div>{candidate.status === 'candidate' && <aside className="border-t border-border bg-surface/70 p-4 lg:border-l lg:border-t-0"><div className="flex items-center gap-2"><Building2 size={15} className="text-cyan" /><h3 className="text-sm font-semibold">Department routing</h3></div><p className="mt-1 text-xs leading-5 text-stone">Suggested from the department descriptions. You can select more than one.</p><div className="mt-3 space-y-2">{activeDepartments.map(department => { const checked = candidate.department_ids.includes(department.id); const suggested = candidate.department_suggestions.some(item => item.department_id === department.id); return <label key={department.id} className={`flex cursor-pointer gap-2 rounded-lg border p-2 text-xs ${checked ? 'border-cyan/35 bg-cyan/10' : 'border-border hover:bg-surface-soft'}`}><input type="checkbox" checked={checked} disabled={busy} onChange={event => { const ids = event.target.checked ? [...candidate.department_ids, department.id] : candidate.department_ids.filter(value => value !== department.id); void setDepartmentsForCandidate(candidate, ids) }} className="mt-0.5" /><span className="min-w-0"><span className="flex items-center gap-1 font-semibold text-foreground">{department.name}{suggested && <span className="rounded bg-cyan/15 px-1 py-0.5 text-[9px] uppercase text-cyan">Suggested</span>}</span><span className="mt-0.5 block leading-4 text-muted-foreground">{department.description || 'No description yet'}</span></span></label> })}</div>{candidate.proposed_department && <div className="mt-3 rounded-xl border border-amber-300/20 bg-amber-400/[0.07] p-3"><div className="flex gap-2"><Lightbulb size={15} className="mt-0.5 shrink-0 text-amber-300" /><div><p className="text-xs font-semibold text-amber-100">New department suggested</p><p className="mt-1 text-xs font-semibold text-foreground">{candidate.proposed_department.name}</p><p className="mt-1 text-[11px] leading-4 text-stone">{candidate.proposed_department.description}</p></div></div><button type="button" disabled={busy} onClick={() => void createSuggestedDepartment(candidate)} className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-amber-300/30 px-2.5 py-1.5 text-xs font-semibold text-amber-100 disabled:opacity-50"><Plus size={13} /> Create and assign</button></div>}</aside>}</div>{candidate.review_note && <footer className="border-t border-border px-5 py-2 text-xs text-stone">{candidate.review_note}</footer>}</article>)}</section>}
  </main>
}
