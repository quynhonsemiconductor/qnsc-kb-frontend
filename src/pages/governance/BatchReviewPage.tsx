import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { ArrowLeft, Building2, Check, CheckCircle2, FileText, GitMerge, Lightbulb, Plus, Scissors, Sparkles, Trash2, Type } from 'lucide-react'
import { commitDraftCandidates, getDraftCandidates, getPendingDraft, reviewDraftCandidate } from '../../api/governance'
import { createDepartment, listDepartments } from '../../api/auth'
import { useDialog } from '../../components/ui/DialogProvider'
import { useLanguage } from '../../i18n/LanguageProvider'
import { usePolling } from '../../hooks/usePolling'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'

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
  const navigate = useNavigate(); const dialog = useDialog(); const { t } = useLanguage()
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [editingCandidateId, setEditingCandidateId] = useState<string | null>(null)
  const [departments, setDepartments] = useState<Department[]>([])
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState('')
  const [formatting, setFormatting] = useState(false)
  const activeDepartments = useMemo(() => departments.filter(item => item.active), [departments])
  const active = candidates.filter(item => item.status === 'candidate')
  const assignedCount = active.filter(item => (item.department_ids?.length ?? 0) > 0).length
  const incompleteCount = active.length - assignedCount
  const allRouted = active.length > 0 && incompleteCount === 0

  const load = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try { const [nextCandidates, nextDepartments, draft] = await Promise.all([getDraftCandidates(id), listDepartments(), getPendingDraft(id, false)]); setCandidates(normalizeCandidates(nextCandidates)); setDepartments(nextDepartments); setFormatting(['queued', 'processing'].includes(draft.restructure_status || '')); setError('') }
    catch { setError(t('sections.loadFailed')) }
    finally { if (showLoading) setLoading(false) }
  }
  useEffect(() => { void load() }, [id])
  usePolling(() => load(false), 4000, formatting)
  const operate = async (payload: Parameters<typeof reviewDraftCandidate>[1]) => {
    setBusy(true)
    try { setCandidates(normalizeCandidates(await reviewDraftCandidate(id, payload))) }
    catch (requestError: any) { await dialog.alert(requestError?.response?.data?.detail || t('sections.operationFailed'), { title: t('sections.operationFailedTitle'), tone: 'danger' }) }
    finally { setBusy(false) }
  }
  const setDepartmentsForCandidate = async (candidate: Candidate, departmentIds: string[]) => {
    await operate({ operation: 'set_departments', candidate_id: candidate.id, department_ids: departmentIds })
  }
  const rename = async (candidate: Candidate) => {
    const title = (await dialog.prompt(t('sections.renamePrompt'), { title: t('sections.renameTitle'), defaultValue: candidate.title, confirmLabel: t('sections.rename') }))?.trim()
    if (title) {
      await operate({ operation: 'rename', candidate_id: candidate.id, title })
      setEditingCandidateId(null)
    }
  }
  const split = async (candidate: Candidate) => {
    const raw = await dialog.prompt(t('sections.splitPrompt', { max: candidate.body_md.length - 1 }), { title: t('sections.splitTitle'), defaultValue: String(Math.floor(candidate.body_md.length / 2)), confirmLabel: t('sections.split'), validate: value => Number.isInteger(Number(value)) && Number(value) > 0 && Number(value) < candidate.body_md.length ? undefined : t('sections.splitInvalid') })
    const splitAt = Number(raw)
    if (Number.isInteger(splitAt) && splitAt > 0) {
      await operate({ operation: 'split', candidate_id: candidate.id, split_at: splitAt })
      setEditingCandidateId(null)
    }
  }
  const merge = async (candidate: Candidate) => {
    const next = active.find(item => item.position > candidate.position)
    if (next) {
      await operate({ operation: 'merge', candidate_id: candidate.id, other_candidate_id: next.id })
      setEditingCandidateId(null)
    }
  }
  const discard = async (candidate: Candidate) => {
    if (await dialog.confirm(t('sections.discardConfirm', { title: candidate.title }), { title: t('sections.discardTitle'), confirmLabel: t('sections.discard'), tone: 'danger' })) {
      await operate({ operation: 'discard', candidate_id: candidate.id })
      setEditingCandidateId(null)
    }
  }
  const createSuggestedDepartment = async (candidate: Candidate) => {
    const proposed = candidate.proposed_department
    if (!proposed) return
    setBusy(true)
    try {
      const created = await createDepartment({ name: proposed.name, description: proposed.description })
      setDepartments(items => [...items, created])
      setCandidates(normalizeCandidates(await reviewDraftCandidate(id, { operation: 'set_departments', candidate_id: candidate.id, department_ids: [created.id] })))
    } catch (requestError: any) { await dialog.alert(requestError?.response?.data?.detail || t('sections.departmentCreateFailed'), { title: t('sections.departmentCreateFailedTitle'), tone: 'danger' }) }
    finally { setBusy(false) }
  }
  const commit = async () => {
    if (!active.length || !allRouted) return
    if (!await dialog.confirm(t('sections.commitConfirm', { count: active.length }), { title: t('sections.commitTitle'), confirmLabel: t('sections.create', { count: active.length }), tone: 'success' })) return
    setBusy(true)
    try { await commitDraftCandidates(id); await dialog.alert(t('sections.commitSuccess'), { title: t('sections.commitSuccessTitle'), tone: 'success' }); navigate('/governance/pending-drafts') }
    catch (requestError: any) { await dialog.alert(requestError?.response?.data?.detail || t('sections.commitFailed'), { title: t('sections.commitFailedTitle'), tone: 'danger' }) }
    finally { setBusy(false) }
  }

  return <div className="page-shell page-stack pb-8 text-ink">
    <header className="border-b border-border pb-5">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} icon={<ArrowLeft size={14} />} className="mb-4">{t('sections.back')}</Button>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div><div className="mb-2 flex items-center gap-2 text-caption font-semibold uppercase tracking-[.16em] text-muted"><FileText size={14} className="text-primary" />{t('sections.eyebrow')}</div><h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{t('sections.title')}</h1><p className="mt-2 max-w-2xl text-body leading-6 text-muted-foreground">{t('sections.description')}</p></div>
        <Button variant="primary" size="md" onClick={() => void commit()} disabled={busy || !active.length || !allRouted} icon={<CheckCircle2 size={15} />}>{t('sections.create', { count: active.length })}</Button>
      </div>
      {!loading && !formatting && active.length > 0 && <div className="mt-4 rounded-xl border border-border bg-surface p-3"><div className="flex items-center justify-between gap-3"><span className="text-body-sm font-semibold text-foreground">{t('sections.progress', { assigned: assignedCount, total: active.length })}</span><span className={`text-body-sm font-semibold ${incompleteCount ? 'text-warning-text' : 'text-success-text'}`}>{incompleteCount ? t('sections.remaining', { count: incompleteCount }) : t('sections.ready')}</span></div><div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-muted"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${active.length ? Math.round(assignedCount / active.length * 100) : 0}%` }} /></div></div>}
    </header>

    {error && <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive-text">{error}</div>}
    {loading ? <div role="status" className="rounded-xl border border-border p-8 text-sm text-muted-foreground">{t('sections.loading')}</div> : formatting ? <div role="status" className="rounded-xl border border-info/25 bg-info/[0.06] p-8 text-center"><Sparkles size={22} className="mx-auto animate-pulse text-info-text" /><h2 className="mt-3 font-semibold text-foreground">{t('sections.preparing')}</h2><p className="mx-auto mt-2 max-w-lg text-body leading-6 text-muted-foreground">{t('sections.preparingHelp')}</p></div> : <section className="space-y-4">{candidates.map(candidate => {
      const kept = candidate.status === 'candidate'
      const assigned = candidate.department_ids.length > 0
      const editing = editingCandidateId === candidate.id
      return <article key={candidate.id} className={`overflow-hidden rounded-xl border ${kept ? assigned ? 'border-border bg-surface-elevated' : 'border-warning/35 bg-warning/[0.03]' : 'border-border bg-surface/50 opacity-65'}`}>
        <header className="flex flex-col gap-3 border-b border-border px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant={kept ? assigned ? 'success' : 'warning' : 'default'} size="sm">{kept ? assigned ? t('sections.kept') : t('drafts.statusDecision') : t('sections.removed')}</Badge><span className="text-caption font-semibold uppercase tracking-wider text-muted">{t('sections.section', { position: candidate.position })}</span>{candidate.heading && <span className="truncate text-caption text-muted-foreground">{candidate.heading}</span>}</div><h2 className="mt-1 truncate text-body font-semibold text-foreground">{candidate.title}</h2></div>
          {kept && <Button variant="ghost" size="sm" onClick={() => setEditingCandidateId(editing ? null : candidate.id)}>{editing ? t('sections.doneEditing') : t('sections.edit')}</Button>}
        </header>

        {kept && editing && <div className="flex flex-wrap gap-2 border-b border-border bg-surface-soft px-4 py-2.5"><Button variant="secondary" size="sm" disabled={busy} onClick={() => void rename(candidate)} icon={<Type size={13} />}>{t('sections.rename')}</Button><Button variant="secondary" size="sm" disabled={busy} onClick={() => void split(candidate)} icon={<Scissors size={13} />}>{t('sections.split')}</Button><Button variant="secondary" size="sm" disabled={busy || !active.some(item => item.position > candidate.position)} onClick={() => void merge(candidate)} icon={<GitMerge size={13} />}>{t('sections.merge')}</Button><Button variant="danger" size="sm" disabled={busy} onClick={() => void discard(candidate)} icon={<Trash2 size={13} />}>{t('sections.discard')}</Button></div>}

        <div className="grid min-w-0 lg:grid-cols-[minmax(0,1fr)_21rem]">
          <div className="markdown-surface min-w-0 px-4 py-5 sm:px-5"><ReactMarkdown remarkPlugins={[remarkGfm]}>{candidate.body_md}</ReactMarkdown></div>
          {kept && <aside className="border-t border-border bg-surface/70 p-4 lg:border-l lg:border-t-0"><div className="flex items-center gap-2"><Building2 size={15} className={assigned ? 'text-success-text' : 'text-warning-text'} /><h3 className="text-sm font-semibold text-foreground">{t('sections.department')}</h3></div><p className="mt-1 text-body-sm leading-5 text-muted-foreground">{t('sections.departmentHelp')}</p><div className="mt-3 space-y-2">{activeDepartments.map(department => { const checked = candidate.department_ids.includes(department.id); const suggested = candidate.department_suggestions.some(item => item.department_id === department.id); return <label key={department.id} className={`flex cursor-pointer gap-2 rounded-lg border p-2.5 text-xs transition ${checked ? 'border-primary/40 bg-primary/10' : 'border-border hover:bg-surface-soft'}`}><input type="checkbox" checked={checked} disabled={busy} onChange={event => { const ids = event.target.checked ? [...candidate.department_ids, department.id] : candidate.department_ids.filter(value => value !== department.id); void setDepartmentsForCandidate(candidate, ids) }} className="mt-0.5 h-4 w-4" /><span className="min-w-0 flex-1"><span className="flex flex-wrap items-center gap-1 font-semibold text-foreground">{department.name}{suggested && <Badge variant="info" size="sm">{t('sections.suggested')}</Badge>}</span><span className="mt-0.5 block leading-4 text-muted-foreground">{department.description || t('sections.noDescription')}</span></span></label> })}</div>{candidate.proposed_department && <div className="mt-3 rounded-xl border border-warning/25 bg-warning/[0.06] p-3"><div className="flex gap-2"><Lightbulb size={15} className="mt-0.5 shrink-0 text-warning-text" /><div><p className="text-xs font-semibold text-warning-text">{t('sections.newDepartment')}</p><p className="mt-1 text-xs font-semibold text-foreground">{candidate.proposed_department.name}</p><p className="mt-1 text-body-sm leading-4 text-muted-foreground">{candidate.proposed_department.description}</p></div></div><Button variant="secondary" size="sm" disabled={busy} onClick={() => void createSuggestedDepartment(candidate)} icon={<Plus size={13} />} className="mt-3">{t('sections.createDepartment')}</Button></div>}</aside>}
        </div>
        {candidate.review_note && <footer className="border-t border-border px-5 py-2 text-xs text-muted-foreground">{candidate.review_note}</footer>}
      </article>
    })}</section>}
  </div>
}
