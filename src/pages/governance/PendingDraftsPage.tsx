import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle, AlertTriangle, ArrowLeftRight, Check, CheckCircle2, ChevronDown, Clock3, Edit3, Eye,
  FileCheck2, FileText, Hash, Layers3, RefreshCw, Search, ShieldCheck, Sparkles, X,
  MessageSquare,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useNavigate } from 'react-router-dom'
import {
  approveDraft, assignDraftApprover, decideRestructure, getDraftComparison, getEligibleApprovers, getPendingDrafts, rejectDraft, restructureDraft,
} from '../../api/governance'
import { listDepartments } from '../../api/auth'
import { useAuth } from '../../auth/useAuth'
import { useDialog } from '../../components/ui/DialogProvider'
import { Select } from '../../components/ui/Select'
import { FloatingPanel } from '../../components/ui/FloatingPanel'
import { getArticle } from '../../api/articles'
import { canEditArticleForUser } from '../../utils/articlePermissions'

const similarityStyles: Record<string, string> = {
  very_high: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  partial: 'border-cyan/30 bg-cyan/10 text-cyan',
  exact: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
}

type Draft = {
  id: string
  title: string
  source_ref: string
  dept?: string | null
  summary?: string
  restructured_body_md?: string
  restructure_candidate_md?: string | null
  restructure_decision?: string
  restructure_status?: string
  restructure_model?: string
  restructure_error?: string
  restructure_report?: RestructureReport | null
  restructure_chunk_count?: number
  created_at: string
  similarity_level?: string
  similarity_matches?: { article_id: string; title: string; score: number; lifecycle_status?: string }[]
  requires_update_confirmation?: boolean
  assigned_approver_id?: string | null
  assigned_at?: string | null
  content_metadata?: {
    submission_kind?: string
    suggested_update_article_id?: string
    department_ids?: string[]
  } | null
  candidate_count?: number
}

type RestructureReport = {
  missing_numeric_tokens: string[]
  heading_count: number
  token_coverage: number
  numeric_coverage: number
}

type Approver = { id: string; name: string; email: string; dept?: string | null; role: string }
type ComparedArticle = {
  id: string
  title: string
  body_md: string
  version: number
  status: string
  lifecycle_status: string
}

function ReviewQuality({ report, chunkCount, busy }: { report?: RestructureReport | null; chunkCount?: number; busy: boolean }) {
  const percent = (value?: number) => value == null ? '—' : `${Math.round(value * 100)}%`
  const healthy = (value?: number) => value != null && value >= 0.9
  const metrics = [
    { label: 'Content preserved', value: percent(report?.token_coverage), icon: ShieldCheck, tone: healthy(report?.token_coverage) ? 'text-emerald-300' : 'text-amber-300' },
    { label: 'Numeric safety', value: percent(report?.numeric_coverage), icon: Hash, tone: healthy(report?.numeric_coverage) ? 'text-emerald-300' : 'text-amber-300' },
    { label: 'Headings', value: report ? String(report.heading_count) : '—', icon: Layers3, tone: 'text-cyan' },
    { label: 'RAG sections', value: report ? String(chunkCount || 0) : '—', icon: FileText, tone: 'text-violet-300' },
  ]

  return <section className="border-b border-hairline bg-gradient-to-br from-cyan/[0.07] via-surface to-surface-soft px-4 py-3 sm:px-6">
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${busy ? 'bg-cyan/10 text-cyan' : report ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-300'}`}>
          {busy ? <RefreshCw size={17} className="animate-spin" /> : report ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
        </div>
        <div>
          <div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold text-ink">Review confidence</p><span className="rounded-full border border-border bg-canvas/60 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-stone">Lossless checks</span></div>
          <p className="mt-1 text-[11px] leading-5 text-steel">{busy ? 'AI is still preparing the reading view. The original remains the source of truth.' : report ? 'Quick signals to verify the AI layout before publishing.' : 'Quality signals will appear when a reading view is available.'}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[510px]">
        {metrics.map(metric => { const Icon = metric.icon; return <div key={metric.label} className="rounded-xl border border-border bg-canvas/45 px-3 py-2"><div className="flex items-center justify-between gap-2"><span className="truncate text-[10px] font-semibold uppercase tracking-wider text-stone">{metric.label}</span><Icon size={13} className={metric.tone} /></div><p className={`mt-1 font-display text-lg font-extrabold ${metric.tone}`}>{metric.value}</p></div> })}
      </div>
    </div>
    {report?.missing_numeric_tokens?.length ? <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-amber-300/20 bg-amber-400/[0.07] px-3 py-2 text-[11px] text-amber-100"><AlertTriangle size={13} className="shrink-0 text-amber-300" /><span className="font-semibold">Numbers to verify:</span>{report.missing_numeric_tokens.slice(0, 8).map(token => <code key={token} className="rounded-md border border-amber-300/20 bg-black/10 px-1.5 py-0.5 text-[10px]">{token}</code>)}{report.missing_numeric_tokens.length > 8 && <span className="text-amber-200/70">+{report.missing_numeric_tokens.length - 8} more</span>}</div> : null}
  </section>
}

export default function PendingDraftsPage() {
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [actingDraftId, setActingDraftId] = useState<string | null>(null)
  const [restructuringDraftId, setRestructuringDraftId] = useState<string | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null)
  const [comparedArticle, setComparedArticle] = useState<ComparedArticle | null>(null)
  const [editableTargetArticle, setEditableTargetArticle] = useState<any | null>(null)
  const [compareArticleId, setCompareArticleId] = useState('')
  const [compareLoading, setCompareLoading] = useState(false)
  const [reviewTab, setReviewTab] = useState<'structured' | 'candidate' | 'original'>('structured')
  const [showComparison, setShowComparison] = useState(false)
  const [showQuality, setShowQuality] = useState(false)
  const [showPublishOptions, setShowPublishOptions] = useState(false)
  const [docDept, setDocDept] = useState('')
  const [docDepartmentIds, setDocDepartmentIds] = useState<string[]>([])
  const [departmentMenuOpen, setDepartmentMenuOpen] = useState(false)
  const departmentMenuAnchor = useRef<HTMLButtonElement>(null)
  const [updateArticleId, setUpdateArticleId] = useState('')
  const [treatAsNew, setTreatAsNew] = useState(false)
  const [approvers, setApprovers] = useState<Approver[]>([])
  const [selectedApproverId, setSelectedApproverId] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [departments, setDepartments] = useState<{ id: string; name: string; company_domain: string; active: boolean }[]>([])
  const dialog = useDialog()
  const navigate = useNavigate()
  const { user } = useAuth()
  const visibleDepartments = departments.filter(item => item.active && item.company_domain === user?.company_domain)

  const fetchDrafts = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const nextDrafts: Draft[] = await getPendingDrafts('pending')
      setDrafts(nextDrafts)
      setSelectedDraft(current => current ? nextDrafts.find(item => item.id === current.id) || current : current)
      setError('')
    } catch { setError('Could not load the review queue.') } finally {
      if (showLoading) setLoading(false)
    }
  }

  useEffect(() => {
    void fetchDrafts()
    void listDepartments().then(setDepartments).catch(() => setDepartments([]))
  }, [])

  useEffect(() => {
    if (!drafts.some(draft => ['queued', 'processing'].includes(draft.restructure_status || ''))) return
    const timer = window.setInterval(() => void fetchDrafts(false), 4000)
    return () => window.clearInterval(timer)
  }, [drafts])

  useEffect(() => {
    if (reviewOpen && selectedDraft && !docDepartmentIds.length && visibleDepartments.length) {
      const metadataIds = (selectedDraft.content_metadata?.department_ids || []).map(String).filter(id => visibleDepartments.some(item => item.id === id))
      const fallback = selectedDraft.dept && visibleDepartments.find(item => item.name === selectedDraft.dept)?.id
      const initialIds = metadataIds.length ? metadataIds : fallback ? [fallback] : []
      setDocDepartmentIds(initialIds)
      setDocDept(visibleDepartments.find(item => item.id === initialIds[0])?.name || '')
    }
  }, [docDepartmentIds.length, reviewOpen, selectedDraft, visibleDepartments])

  const filteredDrafts = useMemo(() => drafts.filter((draft) => {
    const haystack = `${draft.title} ${draft.source_ref} ${draft.summary || ''}`.toLowerCase()
    return !query.trim() || haystack.includes(query.toLowerCase())
  }), [drafts, query])
  const updateCount = drafts.filter(draft => draft.requires_update_confirmation).length
  const relatedCount = drafts.filter(draft => draft.similarity_level === 'partial').length
  const matches = selectedDraft?.similarity_matches || []
  const canSelfApprove = user?.role === 'Admin' || user?.role === 'CEO' || user?.roles?.some((role: { name?: string }) => role.name === 'Admin' || role.name === 'CEO')
  const canReviewWithoutAssignment = canSelfApprove
  const assignedToCurrentUser = Boolean(selectedDraft?.assigned_approver_id && selectedDraft.assigned_approver_id === user?.id)
  const canPublishThisDraft = assignedToCurrentUser || canSelfApprove
  const restructureDecisionReady = !selectedDraft?.restructure_candidate_md || selectedDraft.restructure_decision !== 'pending_review'
  const decisionReady = Boolean(canPublishThisDraft && docDepartmentIds.length && restructureDecisionReady) && (!selectedDraft?.requires_update_confirmation || Boolean(updateArticleId || treatAsNew))
  const selectedDepartments = visibleDepartments.filter(item => docDepartmentIds.includes(item.id))
  const primaryDepartmentId = visibleDepartments.find(item => item.name === docDept)?.id
  const hasReadingView = (draft: Draft | null | undefined) => Boolean(draft?.restructured_body_md)
  const isAiBusy = (draft: Draft | null | undefined) => ['queued', 'processing'].includes(draft?.restructure_status || '')
  const aiStatusLabel = (draft: Draft | null | undefined) => {
    if (draft?.restructure_status === 'queued') return 'AI rewrite queued'
    if (draft?.restructure_status === 'processing') return 'AI rewriting…'
    if (draft?.restructure_status === 'llm') return 'AI reading view ready'
    if (draft?.restructure_status === 'disabled') return 'AI rewrite disabled'
    return hasReadingView(draft) ? 'Lossless reading view ready' : 'Original text retained'
  }
  const isManualUpdate = selectedDraft?.content_metadata?.submission_kind === 'manual_update'
  const canEditTargetArticle = canEditArticleForUser(user, editableTargetArticle)
  const requestDraftPrompt = selectedDraft ? `I am reviewing the pending document "${selectedDraft.title}" in department "${selectedDraft.dept || 'unknown'}". I need help identifying who is allowed to change the source article or draft before publication. Explain which role or person owns this responsibility and help me prepare a concise request. Draft ID: ${selectedDraft.id}.` : ''

  const toggleDepartment = (departmentId: string) => {
    const isSelected = docDepartmentIds.includes(departmentId)
    if (isSelected && departmentId === primaryDepartmentId) return
    const nextIds = isSelected
      ? docDepartmentIds.filter(id => id !== departmentId)
      : [...docDepartmentIds, departmentId]
    setDocDepartmentIds(nextIds)
    if (!docDept && nextIds[0]) setDocDept(visibleDepartments.find(item => item.id === nextIds[0])?.name || '')
  }

  const loadComparison = async (draftId: string, articleId: string) => {
    setCompareArticleId(articleId)
    setCompareLoading(true)
    try {
      setComparedArticle(await getDraftComparison(draftId, articleId))
    } catch {
      setComparedArticle(null)
      setError('The similar article could not be loaded for comparison.')
    } finally { setCompareLoading(false) }
  }

  const openReview = (draft: Draft) => {
    setSelectedDraft(draft)
    setReviewOpen(true)
    setDepartmentMenuOpen(false)
    setReviewTab('structured')
    setShowComparison(false)
    setShowQuality(false)
    setShowPublishOptions(false)
    setUpdateArticleId(draft.content_metadata?.suggested_update_article_id || '')
    setTreatAsNew(false)
    setSelectedApproverId(draft.assigned_approver_id || '')
    setEditableTargetArticle(null)
    const metadataIds = (draft.content_metadata?.department_ids || []).map(String).filter(id => visibleDepartments.some(item => item.id === id))
    const fallbackId = draft.dept && visibleDepartments.find(item => item.name === draft.dept)?.id
    const initialIds = metadataIds.length ? metadataIds : fallbackId ? [fallbackId] : []
    setDocDepartmentIds(initialIds)
    setDocDept(visibleDepartments.find(item => item.id === initialIds[0])?.name || '')
    setComparedArticle(null)
    const targetArticleId = draft.content_metadata?.suggested_update_article_id
    if (targetArticleId) {
      void getArticle(targetArticleId).then(setEditableTargetArticle).catch(() => setEditableTargetArticle(null))
    }
    void getEligibleApprovers(draft.id).then((eligible) => {
      setApprovers(eligible)
    }).catch(() => {
      setApprovers([])
    })
    const firstMatch = draft.similarity_matches?.[0]
    if (firstMatch) void loadComparison(draft.id, firstMatch.article_id)
  }

  const closeReview = () => {
    if (actingDraftId) return
    setReviewOpen(false)
    setDepartmentMenuOpen(false)
    setSelectedDraft(null)
    setComparedArticle(null)
    setEditableTargetArticle(null)
  }

  const handleConfirmApprove = async () => {
    if (!selectedDraft || !decisionReady) return
    setActingDraftId(selectedDraft.id)
    try {
      await approveDraft(selectedDraft.id, docDept, docDepartmentIds, updateArticleId || undefined, treatAsNew)
      setDrafts(current => current.filter(draft => draft.id !== selectedDraft.id))
      setMessage(`Published ${selectedDraft.title}.`)
      closeReview()
    } catch (requestError: any) {
      const detail = requestError?.response?.data?.detail
      const message = typeof detail === 'string'
        ? detail
        : detail?.message || 'The draft could not be approved. Check the update decision and try again.'
      await dialog.alert(message, { title: 'Approval failed' })
    } finally { setActingDraftId(null) }
  }

  const handleAssignApprover = async () => {
    if (!selectedDraft || !selectedApproverId) return
    const previousApproverId = selectedDraft.assigned_approver_id
    if (previousApproverId === selectedApproverId) {
      await dialog.alert('Choose a different eligible reviewer before changing the assignment.', { title: 'No change to apply' })
      return
    }
    const reason = previousApproverId
      ? (await dialog.prompt('Explain why the approver is changing:', { title: 'Change approver', confirmLabel: 'Change approver', multiline: true, placeholder: 'Reason for reassignment…', validate: value => value.trim() ? undefined : 'A reassignment reason is required.' }))?.trim()
      : undefined
    if (previousApproverId && !reason) return
    setActingDraftId(selectedDraft.id)
    try {
      const assignment = await assignDraftApprover(selectedDraft.id, selectedApproverId, reason)
      setDrafts(current => current.map(item => item.id === selectedDraft.id ? { ...item, ...assignment } : item))
      setSelectedDraft(current => current?.id === selectedDraft.id ? { ...current, ...assignment } : current)
      setMessage(previousApproverId ? 'Approver changed and the reassignment was recorded.' : 'Approver assigned. Only that reviewer can publish or reject this draft.')
    } catch {
      await dialog.alert('The approver could not be assigned. Choose an eligible reviewer and try again.', { title: 'Assignment failed' })
    } finally { setActingDraftId(null) }
  }

  const handleReject = async (draftId: string) => {
    if (!(await dialog.confirm('This removes the draft from the active review queue. The original upload remains stored.', { title: 'Reject draft', confirmLabel: 'Reject draft', tone: 'danger' }))) return
    const reviewNote = (await dialog.prompt('Provide the reason for rejection:', { title: 'Reject draft', confirmLabel: 'Reject draft', tone: 'danger', multiline: true, placeholder: 'Explain what needs to be corrected…', validate: value => value ? undefined : 'A rejection reason is required.' }))?.trim()
    if (!reviewNote) {
      await dialog.alert('A rejection reason is required so the author can correct and resubmit the document.', { title: 'Reason required' })
      return
    }
    setActingDraftId(draftId)
    try {
      await rejectDraft(draftId, reviewNote)
      setDrafts(current => current.filter(draft => draft.id !== draftId))
      setMessage('Draft rejected. The original source remains stored.')
      closeReview()
    } catch { await dialog.alert('The draft could not be rejected.', { title: 'Rejection failed' }) } finally { setActingDraftId(null) }
  }

  const handleRestructure = async (draft: Draft) => {
    setRestructuringDraftId(draft.id)
    try {
      const updated = await restructureDraft(draft.id)
      setDrafts(current => current.map(item => item.id === draft.id ? { ...item, ...updated } : item))
      setSelectedDraft(current => current && current.id === draft.id ? { ...current, ...updated } : current)
    } catch (requestError: any) {
      const detail = requestError?.response?.data?.detail
      const message = typeof detail === 'string'
        ? detail
        : detail?.message || 'The reading view could not be generated. The original source is still available and unchanged.'
      await dialog.alert(message, { title: 'Restructuring failed' })
    } finally { setRestructuringDraftId(null) }
  }

  const handleRestructureDecision = async (decision: 'keep_ai' | 'keep_lossless') => {
    if (!selectedDraft) return
    setActingDraftId(selectedDraft.id)
    try {
      const updated = await decideRestructure(selectedDraft.id, decision)
      setDrafts(current => current.map(item => item.id === selectedDraft.id ? { ...item, ...updated } : item))
      setSelectedDraft(current => current && current.id === selectedDraft.id ? { ...current, ...updated } : current)
      setReviewTab('structured')
      setMessage(decision === 'keep_ai' ? 'AI layout kept for publication.' : 'Lossless reading view selected for publication.')
    } catch (requestError: any) {
      const detail = requestError?.response?.data?.detail
      await dialog.alert(typeof detail === 'string' ? detail : 'The reading-view decision could not be saved.', { title: 'Decision failed' })
    } finally { setActingDraftId(null) }
  }

  const toggleComparison = () => {
    const next = !showComparison
    setShowComparison(next)
    if (next && selectedDraft && !comparedArticle && matches[0]) void loadComparison(selectedDraft.id, matches[0].article_id)
  }

  const renderMarkdown = (content: string) => (
    <div className="markdown-surface max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
    </div>
  )

  return (
    <main className="page-shell page-stack text-ink">
      <header className="page-hero glass-panel soft-grid signal-line relative overflow-hidden rounded-panel border border-border px-4 py-5 sm:px-6 sm:py-6">
        <div className="pointer-events-none absolute -right-12 -top-16 hidden h-52 w-52 opacity-65 xl:block"><div className="hero-orb h-full w-full"><div className="orbit-ring" /><div className="orb-core text-xl">Q</div></div></div>
        <div className="relative flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-stone"><FileCheck2 size={14} className="text-cyan" /> Content operations</div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">Pending drafts</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-steel">Open a focused review workspace to read the full upload, compare it with similar active articles, and make the version decision with confidence.</p>
        </div>
         <button onClick={() => void fetchDrafts()} className="mm-secondary relative inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold"><RefreshCw size={14} /> Refresh queue</button>
        </div>
      </header>

      {(message || error) && <div className={`rounded-lg border px-4 py-3 text-sm ${error ? 'border-rose-400/25 bg-rose-500/10 text-rose-200' : 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200'}`}>{error || message}</div>}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="metric-spark interactive-lift rounded-2xl border border-border p-4"><div className="flex items-center justify-between text-muted"><span className="text-xs font-bold uppercase tracking-[.12em]">Awaiting review</span><Clock3 size={16} className="text-info" /></div><p className="mt-2 font-display text-3xl font-extrabold text-foreground">{drafts.length}</p><p className="mt-1 text-[11px] text-muted">New source submissions</p></div>
        <div className="interactive-lift rounded-2xl border border-warning/20 bg-warning/[0.06] p-4"><div className="flex items-center justify-between text-warning"><span className="text-xs font-bold uppercase tracking-[.12em]">Update decisions</span><AlertTriangle size={16} /></div><p className="mt-2 font-display text-3xl font-extrabold text-foreground">{updateCount}</p><p className="mt-1 text-[11px] text-muted">High similarity documents</p></div>
        <div className="interactive-lift rounded-2xl border border-info/20 bg-info/[0.06] p-4"><div className="flex items-center justify-between text-info"><span className="text-xs font-bold uppercase tracking-[.12em]">Related sources</span><Sparkles size={16} /></div><p className="mt-2 font-display text-3xl font-extrabold text-foreground">{relatedCount}</p><p className="mt-1 text-[11px] text-muted">Partial content overlap</p></div>
      </section>

      <div className="relative"><Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone" /><input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search drafts, filenames, or extracted text…" className="field pl-9" /></div>

      {loading ? <div className="grid min-h-56 place-items-center rounded-xl border border-hairline bg-surface text-sm text-steel"><RefreshCw size={16} className="mr-2 animate-spin" /> Loading review queue…</div> : filteredDrafts.length === 0 ? <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-hairline bg-surface/50 p-8 text-center"><div><div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-emerald-400/10 text-emerald-300"><Check size={24} /></div><h2 className="mt-4 text-base font-semibold">{drafts.length ? 'No drafts match your search' : 'Review queue is clear'}</h2><p className="mt-2 text-sm text-steel">{drafts.length ? 'Try a different title or filename.' : 'New uploads will appear here when they are ready for review.'}</p></div></div> : <div className="space-y-3">{filteredDrafts.map(draft => {
        const similarity = draft.similarity_level && draft.similarity_level !== 'none' ? draft.similarity_level : null
        const firstMatch = draft.similarity_matches?.[0]
        return <article key={draft.id} className="rounded-xl border border-[#344354] bg-[#17212b] p-5 shadow-sm transition hover:border-cyan/40 hover:bg-[#1b2733] hover:shadow-lg hover:shadow-black/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between"><div className="flex min-w-0 items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-soft text-cyan"><FileText size={18} /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><h2 className="truncate text-sm font-semibold text-ink">{draft.title}</h2>{similarity && <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${similarityStyles[similarity] || similarityStyles.partial}`}>{similarity === 'very_high' ? 'Possible update' : 'Related content'}</span>}{(draft.candidate_count || 0) > 1 && <span className="rounded-full border border-violet-300/25 bg-violet-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-200">{draft.candidate_count} split candidates</span>}</div><p className="mt-1 truncate text-xs text-stone">{draft.source_ref} · {new Date(draft.created_at).toLocaleDateString()}</p></div></div><div className="flex flex-wrap justify-end gap-2">{(draft.candidate_count || 0) > 1 && <button onClick={() => navigate(`/governance/pending-drafts/${draft.id}/batch-review`)} className="inline-flex items-center gap-1.5 rounded-lg border border-violet-300/30 px-3 py-2 text-xs font-semibold text-violet-200 transition hover:bg-violet-400/10"><Layers3 size={14} /> Batch review</button>}<button onClick={() => openReview(draft)} className="inline-flex items-center gap-1.5 rounded-lg bg-cyan px-3 py-2 text-xs font-semibold text-[#07131a] transition hover:bg-cyan/80"><Eye size={14} /> Open full review</button>{isAiBusy(draft) ? <span className="inline-flex items-center gap-1.5 rounded-lg border border-cyan/30 bg-cyan/10 px-3 py-2 text-xs font-semibold text-cyan"><RefreshCw size={14} className="animate-spin" /> {draft.restructure_status === 'queued' ? 'AI queued' : 'AI formatting…'}</span> : draft.restructure_status !== 'llm' && <button onClick={() => void handleRestructure(draft)} disabled={restructuringDraftId === draft.id} className="inline-flex items-center gap-1.5 rounded-lg border border-cyan/30 px-3 py-2 text-xs font-semibold text-cyan transition hover:bg-cyan/10 disabled:opacity-50"><Sparkles size={14} />{restructuringDraftId === draft.id ? 'Formatting…' : 'Retry AI format'}</button>}<button onClick={() => void handleReject(draft.id)} disabled={actingDraftId === draft.id} className="rounded-lg border border-hairline px-3 py-2 text-xs font-semibold text-steel transition hover:border-rose-400/40 hover:bg-rose-400/10 hover:text-rose-300 disabled:opacity-50">Reject</button></div></div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-steel">{draft.content_metadata?.submission_kind === 'manual' && <span className="rounded-full border border-cyan/30 bg-cyan/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cyan">Manual submission</span>}{draft.content_metadata?.submission_kind === 'manual_update' && <span className="rounded-full border border-amber-300/30 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-200">Manual update</span>}{firstMatch ? <><ArrowLeftRight size={13} className="text-amber-300" /><span>{Math.round(firstMatch.score * 100)}% similar to <strong className="font-medium text-amber-200">{firstMatch.title}</strong></span></> : <span>No significant overlap detected</span>}<span className="text-stone">·</span><span className={draft.restructure_status === 'llm' ? 'text-emerald-300' : isAiBusy(draft) ? 'text-cyan' : hasReadingView(draft) ? 'text-cyan' : 'text-amber-300'}>{aiStatusLabel(draft)}</span></div>
          {draft.restructure_error && <p className="mt-2 line-clamp-2 text-xs text-amber-200/80">{draft.restructure_error}</p>}
        </article>
      })}</div>}

      {reviewOpen && selectedDraft && <div className="fixed inset-0 z-50 bg-black/75 p-2 backdrop-blur-sm sm:p-4"><section className="mx-auto flex h-[calc(100vh-1rem)] max-w-7xl flex-col overflow-hidden rounded-2xl border border-hairline bg-canvas shadow-2xl sm:h-[calc(100vh-2rem)]">
        <header className="flex shrink-0 items-center justify-between gap-4 border-b border-hairline bg-surface px-4 py-3 sm:px-6"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-cyan/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-cyan">Focused review</span>{selectedDraft.similarity_level === 'very_high' && <span className="rounded-full bg-amber-400/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-amber-300">Possible update</span>}</div><h2 className="mt-1 truncate text-base font-semibold text-ink sm:text-lg">{selectedDraft.title}</h2><p className="mt-1 truncate text-xs text-stone">{selectedDraft.source_ref} · Original source is unchanged</p></div><div className="flex shrink-0 items-center gap-2">{user?.permissions?.includes('ai.ask') && <button onClick={() => navigate(`/ai?${editableTargetArticle ? `articleId=${encodeURIComponent(editableTargetArticle.id)}&articleTitle=${encodeURIComponent(editableTargetArticle.title)}&` : ''}prompt=${encodeURIComponent(requestDraftPrompt)}`)} className="inline-flex items-center gap-1.5 rounded-lg border border-info/30 bg-info/10 px-2.5 py-2 text-[11px] font-semibold text-info hover:bg-info/15"><MessageSquare size={13} /> Ask AI about edit</button>}{canEditTargetArticle && editableTargetArticle && <button onClick={() => navigate(`/articles/${editableTargetArticle.id}/edit`)} className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-300/30 bg-emerald-400/10 px-2.5 py-2 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-400/15"><Edit3 size={13} /> Edit source article</button>}<button onClick={() => setShowQuality(value => !value)} className={`hidden rounded-lg border px-2.5 py-2 text-[11px] font-semibold sm:inline-flex ${showQuality ? 'border-cyan/30 bg-cyan/10 text-cyan' : 'border-hairline text-stone hover:text-ink'}`}>{showQuality ? 'Hide quality' : 'Quality details'}</button>{matches.length > 0 && <button onClick={toggleComparison} className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 text-[11px] font-semibold ${showComparison ? 'border-amber-300/30 bg-amber-400/10 text-amber-200' : 'border-hairline text-stone hover:text-ink'}`}><ArrowLeftRight size={13} />{showComparison ? 'Hide comparison' : 'Compare article'}</button>}<button onClick={closeReview} className="rounded-lg p-2 text-stone hover:bg-surface-soft hover:text-ink" title="Close review"><X size={18} /></button></div></header>
        {showComparison && matches.length > 0 && <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-hairline bg-surface-soft px-4 py-2.5 sm:px-6"><span className="mr-1 text-[10px] font-semibold uppercase tracking-widest text-stone">Related article</span>{matches.map(match => <button key={match.article_id} onClick={() => void loadComparison(selectedDraft.id, match.article_id)} className={`rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${compareArticleId === match.article_id ? 'border-amber-300/40 bg-amber-400/10 text-amber-200' : 'border-hairline bg-canvas text-steel hover:border-amber-300/30 hover:text-ink'}`}><span className="font-semibold">{Math.round(match.score * 100)}%</span> · {match.title}</button>)}</div>}
        {showQuality && <ReviewQuality report={selectedDraft.restructure_report} chunkCount={selectedDraft.restructure_chunk_count} busy={isAiBusy(selectedDraft)} />}
        {selectedDraft.restructure_candidate_md && <section className="flex shrink-0 flex-col gap-3 border-b border-amber-300/20 bg-gradient-to-r from-amber-400/[0.09] via-surface to-cyan/[0.06] px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6"><div className="flex min-w-0 items-start gap-3"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-amber-400/10 text-amber-300"><Sparkles size={17} /></div><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="text-xs font-semibold text-ink">AI layout needs your decision</p><span className="rounded-full border border-amber-300/25 bg-amber-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-amber-200">Candidate retained</span></div><p className="mt-1 text-[11px] leading-5 text-steel">The safety check found content that may have changed. Inspect the candidate, then choose which version will be published.</p></div></div><div className="flex shrink-0 flex-wrap gap-2"><button onClick={() => setReviewTab('candidate')} className="rounded-lg border border-amber-300/30 px-3 py-2 text-[11px] font-semibold text-amber-200 hover:bg-amber-400/10">Review AI candidate</button><button onClick={() => void handleRestructureDecision('keep_lossless')} disabled={Boolean(actingDraftId) || selectedDraft.restructure_decision === 'lossless_kept'} className="rounded-lg border border-hairline px-3 py-2 text-[11px] font-semibold text-steel hover:bg-surface-soft disabled:opacity-50">Use lossless view</button><button onClick={() => void handleRestructureDecision('keep_ai')} disabled={Boolean(actingDraftId) || selectedDraft.restructure_decision === 'ai_kept'} className="inline-flex items-center gap-1.5 rounded-lg bg-amber-300 px-3 py-2 text-[11px] font-semibold text-[#1b1608] hover:bg-amber-200 disabled:opacity-50"><Check size={13} />Keep AI layout</button></div></section>}
        <div className={`grid min-h-0 flex-1 grid-cols-1 ${showComparison ? 'lg:grid-cols-2' : ''}`}>
          <section className="flex min-h-0 flex-col border-b border-hairline lg:border-b-0 lg:border-r"><div className="flex shrink-0 items-center justify-between border-b border-hairline px-4 py-2.5 sm:px-6"><div><p className="text-[10px] font-semibold uppercase tracking-widest text-cyan">Incoming document</p><p className={`mt-1 text-xs ${selectedDraft.restructure_status === 'llm' || selectedDraft.restructure_status === 'llm_reviewed' ? 'text-emerald-300' : isAiBusy(selectedDraft) ? 'text-cyan' : hasReadingView(selectedDraft) ? 'text-cyan' : 'text-amber-300'}`}>{reviewTab === 'candidate' ? 'AI candidate — not yet selected' : reviewTab === 'structured' ? (selectedDraft.restructure_status === 'llm' || selectedDraft.restructure_status === 'llm_reviewed' ? 'AI reading view' : isAiBusy(selectedDraft) ? aiStatusLabel(selectedDraft) : hasReadingView(selectedDraft) ? 'Lossless reading view' : 'Original extracted text') : 'Original extracted text'}</p></div><div className="flex items-center gap-2"><div className="flex rounded-lg border border-hairline bg-surface p-0.5"><button onClick={() => setReviewTab('structured')} className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${reviewTab === 'structured' ? 'bg-cyan/15 text-cyan' : 'text-stone hover:text-ink'}`}>Reading view</button>{selectedDraft.restructure_candidate_md && <button onClick={() => setReviewTab('candidate')} className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${reviewTab === 'candidate' ? 'bg-amber-400/15 text-amber-200' : 'text-stone hover:text-ink'}`}>AI candidate</button>}<button onClick={() => setReviewTab('original')} className={`rounded-md px-2.5 py-1 text-[11px] font-semibold ${reviewTab === 'original' ? 'bg-surface-soft text-ink' : 'text-stone hover:text-ink'}`}>Original</button></div>{isAiBusy(selectedDraft) ? <span className="inline-flex items-center gap-1 rounded-md border border-cyan/30 bg-cyan/10 px-2 py-1 text-[11px] font-semibold text-cyan"><RefreshCw size={12} className="animate-spin" /> {selectedDraft.restructure_status === 'queued' ? 'Queued' : 'Formatting…'}</span> : selectedDraft.restructure_status !== 'llm' && selectedDraft.restructure_status !== 'llm_reviewed' && <button onClick={() => void handleRestructure(selectedDraft)} disabled={restructuringDraftId === selectedDraft.id} className="inline-flex items-center gap-1 rounded-md border border-cyan/30 px-2 py-1 text-[11px] font-semibold text-cyan hover:bg-cyan/10 disabled:opacity-50"><Sparkles size={12} />{restructuringDraftId === selectedDraft.id ? 'Formatting…' : 'Retry AI'}</button>}</div></div>{selectedDraft.restructure_error && <div className="border-b border-amber-400/20 bg-amber-400/[0.06] px-4 py-2 text-[11px] leading-5 text-amber-200 sm:px-6">{selectedDraft.restructure_error}</div>}{isAiBusy(selectedDraft) && <div className="flex items-start gap-2 border-b border-cyan/20 bg-cyan/[0.06] px-4 py-2 text-[11px] leading-5 text-cyan sm:px-6"><RefreshCw size={13} className="mt-0.5 shrink-0 animate-spin" /><span>AI reading view is being prepared in the background. The original extracted text is available now.</span></div>}<div className="ask-scroll min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">{renderMarkdown(reviewTab === 'candidate' ? (selectedDraft.restructure_candidate_md || 'No AI candidate available.') : reviewTab === 'structured' ? (selectedDraft.restructured_body_md || selectedDraft.summary || 'No extracted text available.') : (selectedDraft.summary || 'No extracted text available.'))}</div></section>
          {showComparison && <section className="flex min-h-0 flex-col"><div className="flex shrink-0 items-center gap-3 border-b border-hairline px-4 py-2.5 sm:px-6"><ArrowLeftRight size={15} className="text-amber-300" /><div><p className="text-[10px] font-semibold uppercase tracking-widest text-amber-300">Existing active article</p><p className="mt-1 truncate text-xs text-steel">{comparedArticle?.title || (matches.length ? 'Loading comparison…' : 'No high-similarity article selected')}</p></div></div><div className="ask-scroll min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">{compareLoading ? <div className="flex h-full items-center justify-center text-sm text-steel"><RefreshCw size={16} className="mr-2 animate-spin" /> Loading existing article…</div> : comparedArticle ? <>{renderMarkdown(comparedArticle.body_md)}<div className="mt-6 border-t border-hairline pt-3 text-xs text-stone">Version {comparedArticle.version} · {comparedArticle.lifecycle_status}</div></> : <div className="flex h-full items-center justify-center text-center text-sm text-stone">{matches.length ? 'Select a similar article above to compare its full content.' : 'This draft has no high-similarity active article.'}</div>}</div></section>}
        </div>
        <footer className="flex shrink-0 flex-col gap-3 border-t border-hairline bg-surface px-4 py-3 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-semibold text-ink">Publication decision</p><p className="mt-0.5 text-[11px] text-stone">{selectedDepartments.length ? `${selectedDepartments.length} department${selectedDepartments.length === 1 ? '' : 's'} selected` : 'Department required'}{selectedDraft.assigned_approver_id ? ' · Assigned reviewer only' : ''}</p></div><button onClick={() => setShowPublishOptions(value => !value)} className="inline-flex items-center gap-1.5 rounded-lg border border-hairline px-2.5 py-2 text-[11px] font-semibold text-steel hover:bg-surface-soft hover:text-ink">{showPublishOptions ? 'Hide options' : 'Publishing options'}<ChevronDown size={13} className={`transition ${showPublishOptions ? 'rotate-180' : ''}`} /></button></div>
          {showPublishOptions && <>
          {!selectedDraft.assigned_approver_id ? <div className="flex flex-wrap items-center gap-2"><span className="text-xs font-semibold text-amber-200">Assign approver:</span>{canReviewWithoutAssignment && <span className="text-xs text-emerald-300">You can publish directly.</span>}<Select value={selectedApproverId} onChange={event => setSelectedApproverId(event.target.value)} className="min-w-56 text-xs"><option value="">Select an eligible reviewer</option>{approvers.map(approver => <option key={approver.id} value={approver.id}>{approver.name} · {approver.email}</option>)}</Select><button onClick={() => void handleAssignApprover()} disabled={!selectedApproverId || Boolean(actingDraftId)} className="rounded-lg bg-cyan px-3 py-2 text-xs font-semibold text-[#07131a] disabled:opacity-50">Assign</button></div> : <div className="flex flex-wrap items-center gap-2"><span className="text-xs text-emerald-300">Approver assigned. Only that reviewer can publish or reject this draft.</span><Select aria-label="Change assigned approver" value={selectedApproverId} onChange={event => setSelectedApproverId(event.target.value)} className="min-w-56 text-xs"><option value="">Select a different reviewer</option>{approvers.map(approver => <option key={approver.id} value={approver.id}>{approver.name} · {approver.email}</option>)}</Select><button onClick={() => void handleAssignApprover()} disabled={!selectedApproverId || selectedApproverId === selectedDraft.assigned_approver_id || Boolean(actingDraftId)} className="rounded-lg border border-cyan/30 px-3 py-2 text-xs font-semibold text-cyan hover:bg-cyan/10 disabled:opacity-50">Change approver</button></div>}
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3">{isManualUpdate ? <span className="text-xs font-semibold text-amber-200">This revision will replace its original article after approval.</span> : selectedDraft.requires_update_confirmation ? <><span className="text-xs font-semibold text-amber-200">Version decision:</span><button onClick={() => { setUpdateArticleId(compareArticleId || matches[0]?.article_id || ''); setTreatAsNew(false) }} className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${!treatAsNew && updateArticleId ? 'border-amber-300/40 bg-amber-400/10 text-amber-200' : 'border-hairline text-steel hover:bg-surface-soft'}`}>Update selected article</button><button onClick={() => { setTreatAsNew(true); setUpdateArticleId('') }} className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold ${treatAsNew ? 'border-cyan/30 bg-cyan/10 text-cyan' : 'border-hairline text-steel hover:bg-surface-soft'}`}>Publish as new</button></> : <span className="text-xs text-steel">Ready to publish as a new active document.</span>}<div className="relative min-w-64"><label className="mb-1 block text-[10px] font-semibold uppercase tracking-widest text-stone">Publish to departments</label><button ref={departmentMenuAnchor} type="button" onClick={() => setDepartmentMenuOpen(open => !open)} disabled={!visibleDepartments.length} className="field flex min-h-9 w-full items-center gap-2 py-1.5 text-left text-xs disabled:opacity-50"><span className="flex min-w-0 flex-1 flex-wrap gap-1">{selectedDepartments.length ? selectedDepartments.map(item => <span key={item.id} className="rounded-md border border-cyan/25 bg-cyan/10 px-1.5 py-0.5 text-[11px] text-cyan">{item.name}</span>) : <span className="text-stone">Select departments</span>}</span><ChevronDown size={14} className={`shrink-0 text-stone transition ${departmentMenuOpen ? 'rotate-180' : ''}`} /></button><FloatingPanel anchorRef={departmentMenuAnchor} open={departmentMenuOpen} onClose={() => setDepartmentMenuOpen(false)} className="border-[#3a4c5e] bg-[#17212b] p-1.5 shadow-2xl shadow-black/40"><div className="border-b border-hairline px-2.5 py-2"><p className="text-xs font-semibold text-ink">Choose departments</p><p className="mt-0.5 text-[11px] text-stone">The submitted department remains primary.</p></div><div className="py-1">{visibleDepartments.map(item => { const selected = docDepartmentIds.includes(item.id); const primary = item.id === primaryDepartmentId; return <button type="button" key={item.id} onClick={() => toggleDepartment(item.id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-steel transition hover:bg-surface-soft hover:text-ink"><span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${selected ? 'border-cyan bg-cyan text-[#07131a]' : 'border-[#536476] bg-transparent'}`}>{selected && <Check size={11} strokeWidth={3} />}</span><span className="min-w-0 flex-1 truncate">{item.name}</span>{primary && <span className="rounded-full bg-amber-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-200">Primary</span>}</button> })}</div><button type="button" onClick={() => setDepartmentMenuOpen(false)} className="mt-1 w-full rounded-lg border border-hairline px-2.5 py-1.5 text-[11px] font-semibold text-cyan hover:bg-cyan/10">Done</button></FloatingPanel></div><span className="text-[11px] text-stone">{selectedDepartments.length} selected</span></div>
          </>}
          <div className="flex shrink-0 justify-end gap-2"><button onClick={() => void handleReject(selectedDraft.id)} disabled={!canPublishThisDraft || Boolean(actingDraftId)} className="rounded-lg border border-rose-400/25 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-400/10 disabled:opacity-50">Reject</button><button onClick={() => void handleConfirmApprove()} disabled={!decisionReady || Boolean(actingDraftId)} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-50"><Check size={14} />{actingDraftId ? 'Publishing…' : 'Publish document'}</button></div>
        </footer>
      </section></div>}
    </main>
  )
}
