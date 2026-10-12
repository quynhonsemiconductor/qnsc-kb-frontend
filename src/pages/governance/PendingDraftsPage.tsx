import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import {
  AlertCircle, AlertTriangle, ArrowLeftRight, Check, CheckCircle2, ChevronDown, Edit3, Eye,
  FileCheck2, FileText, Hash, Layers3, RefreshCw, Search, ShieldCheck, X,
  MessageSquare, Minus,
} from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useNavigate } from 'react-router-dom'
import {
  approveDraft, assignDraftApprover, bulkDecideDrafts, decideRestructure, getDraftComparison, getEligibleApprovers, getPendingDraft, getPendingDrafts, rejectDraft, restructureDraft,
  type BulkDecideResult,
} from '../../api/governance'
import { listDepartments } from '../../api/auth'
import { useLanguage } from '../../i18n/LanguageProvider'
import { useAuth } from '../../auth/useAuth'
import { useDialog } from '../../components/ui/DialogProvider'
import { usePolling } from '../../hooks/usePolling'
import { Select } from '../../components/ui/Select'
import { FloatingPanel } from '../../components/ui/FloatingPanel'
import { FocusTrap } from '../../components/ui/FocusTrap'
import { getArticle } from '../../api/articles'
import { canEditArticleForUser } from '../../utils/articlePermissions'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Badge } from '../../components/ui/Badge'
import { formatDay } from '../../lib/formatters'
import { useBodyScrollLock } from '../../hooks/useBodyScrollLock'
import { compareDraftManagementOrder, getDraftManagementStatus, getPreparationCompletion, getPublishBlockers, isPreparationQueueState } from '../../utils/draftManagement'


/** `blocked[].code` → the i18n key naming the one thing the reviewer must still do. */
const blockedActionKeys: Record<string, string> = {
  batch_review_required: 'bulk.blocked.batchReview',
  update_confirmation_required: 'bulk.blocked.updateConfirmation',
  external_acl_mapping_required: 'bulk.blocked.aclMapping',
}

/**
 * Axios error payloads arrive as `unknown`; FastAPI puts either a string or a
 * `{ code, message }` object in `detail`. Narrowed once here so callers branch on `code`.
 */
function extractErrorDetail(error: unknown): { code?: string; message?: string } {
  const response = error && typeof error === 'object' && 'response' in error ? error.response : undefined
  const data = response && typeof response === 'object' && 'data' in response ? response.data : undefined
  const detail = data && typeof data === 'object' && 'detail' in data ? data.detail : undefined
  if (typeof detail === 'string') return { message: detail }
  if (detail && typeof detail === 'object') {
    const code = 'code' in detail && typeof detail.code === 'string' ? detail.code : undefined
    const message = 'message' in detail && typeof detail.message === 'string' ? detail.message : undefined
    return { code, message }
  }
  return {}
}

type Draft = {
  id: string
  title: string
  source_ref: string
  dept?: string | null
  summary?: string
  restructured_body_md?: string
  restructure_candidate_md?: string | null
  has_restructure_candidate?: boolean
  restructure_decision?: string
  restructure_status?: string
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
  tags?: string[]
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
  const { t } = useLanguage()
  const percent = (value?: number) => value == null ? '—' : `${Math.round(value * 100)}%`
  const healthy = (value?: number) => value != null && value >= 0.9
  const metrics = [
    { label: t('technical.contentPreserved'), value: percent(report?.token_coverage), icon: ShieldCheck, tone: healthy(report?.token_coverage) ? 'text-success-text' : 'text-amber-300' },
    { label: t('technical.numericSafety'), value: percent(report?.numeric_coverage), icon: Hash, tone: healthy(report?.numeric_coverage) ? 'text-success-text' : 'text-amber-300' },
    { label: t('technical.headings'), value: report ? String(report.heading_count) : '—', icon: Layers3, tone: 'text-info-text' },
    { label: t('technical.sections'), value: report ? String(chunkCount || 0) : '—', icon: FileText, tone: 'text-info-text' },
  ]

  return <section className="border-b border-hairline bg-gradient-to-br from-cyan/[0.07] via-surface to-surface-soft px-4 py-3 sm:px-6">
    <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-xl ${busy ? 'bg-cyan/10 text-info-text' : report ? 'bg-emerald-400/10 text-success-text' : 'bg-amber-400/10 text-amber-300'}`}>
          {busy ? <RefreshCw size={17} className="animate-spin" /> : report ? <CheckCircle2 size={17} /> : <AlertCircle size={17} />}
        </div>
        <div>
          <p className="text-xs font-semibold text-ink">{t('technical.confidence')}</p>
          <p className="mt-1 text-body-sm leading-5 text-steel">{busy ? t('technical.preparingHelp') : report ? t('technical.confidenceHelp') : t('technical.unavailableHelp')}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:min-w-[31.875rem]">
        {metrics.map(metric => { const Icon = metric.icon; return <div key={metric.label} className="rounded-xl border border-border bg-canvas/45 px-3 py-2"><div className="flex items-center justify-between gap-2"><span className="truncate text-caption font-semibold uppercase tracking-wider text-stone">{metric.label}</span><Icon size={13} className={metric.tone} /></div><p className={`mt-1 font-display text-lg font-extrabold ${metric.tone}`}>{metric.value}</p></div> })}
      </div>
    </div>
    {report?.missing_numeric_tokens?.length ? <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-warning/20 bg-warning/[0.07] px-3 py-2 text-body-sm text-warning-text"><AlertTriangle size={13} className="shrink-0" /><span className="font-semibold">{t('technical.numbersVerify')}</span>{report.missing_numeric_tokens.slice(0, 8).map(token => <code key={token} className="rounded-md border border-warning/20 bg-black/10 px-1.5 py-0.5 text-caption">{token}</code>)}{report.missing_numeric_tokens.length > 8 && <span>{t('technical.more', { count: report.missing_numeric_tokens.length - 8 })}</span>}</div> : null}
  </section>
}

type QueueFilter = 'all' | 'ready' | 'decision' | 'processing'

export default function PendingDraftsPage() {
  const [queueFilter, setQueueFilter] = useState<QueueFilter>('all')
  const [drafts, setDrafts] = useState<Draft[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [actingDraftId, setActingDraftId] = useState<string | null>(null)
  const [restructuringDraftId, setRestructuringDraftId] = useState<string | null>(null)
  const [reviewLoadingId, setReviewLoadingId] = useState<string | null>(null)
  const [reviewOpen, setReviewOpen] = useState(false)
  useBodyScrollLock(reviewOpen)
  const [selectedDraft, setSelectedDraft] = useState<Draft | null>(null)
  const [comparedArticle, setComparedArticle] = useState<ComparedArticle | null>(null)
  const [editableTargetArticle, setEditableTargetArticle] = useState<any | null>(null)
  const [compareArticleId, setCompareArticleId] = useState('')
  const [compareLoading, setCompareLoading] = useState(false)
  const [reviewTab, setReviewTab] = useState<'structured' | 'candidate' | 'original'>('structured')
  const [showComparison, setShowComparison] = useState(false)
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false)
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
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [bulkDept, setBulkDept] = useState('')
  const [bulkRunning, setBulkRunning] = useState(false)
  const [bulkResult, setBulkResult] = useState<(BulkDecideResult & { titles: Record<string, string> }) | null>(null)
  const [focusedDraftId, setFocusedDraftId] = useState<string | null>(null)
  const previousDrafts = useRef<Draft[] | null>(null)
  const { t } = useLanguage()
  const dialog = useDialog()
  const navigate = useNavigate()
  const { user } = useAuth()
  const canSelfApprove = Boolean(user?.role === 'Admin' || user?.role === 'CEO' || user?.roles?.some((role: { name?: string }) => role.name === 'Admin' || role.name === 'CEO'))
  const managementContext = useMemo(() => ({ currentUserId: user?.id, canSelfApprove }), [canSelfApprove, user?.id])
  const visibleDepartments = useMemo(
    () => departments.filter(item => item.active && item.company_domain === user?.company_domain),
    [departments, user?.company_domain],
  )

  const fetchDrafts = async (showLoading = true) => {
    if (showLoading) setLoading(true)
    try {
      const nextDrafts: Draft[] = await getPendingDrafts('pending')
      const completion = previousDrafts.current
        ? getPreparationCompletion(previousDrafts.current, nextDrafts, managementContext)
        : null
      previousDrafts.current = nextDrafts
      setDrafts(nextDrafts)
      if (queueFilter === 'processing' && completion) {
        setQueueFilter('all')
        setMessage(t(`drafts.preparationComplete.${completion.destination}`, { count: completion.count }))
      }
      // Decided drafts leave the queue; keep only ids that still need a decision so the
      // action bar count never promises work that is already published.
      setSelectedIds(current => current.filter(id => nextDrafts.some(item => item.id === id)))
      setSelectedDraft(current => {
        if (!current) return current
        const metadata = nextDrafts.find(item => item.id === current.id)
        return metadata ? { ...current, ...metadata } : current
      })
      setError('')
    } catch { setError('Could not load the review queue.') } finally {
      if (showLoading) setLoading(false)
    }
  }

  useEffect(() => {
    void fetchDrafts()
    void listDepartments().then(setDepartments).catch(() => setDepartments([]))
  }, [])

  const hasRestructureInFlight = useMemo(
    () => drafts.some(draft => ['queued', 'processing'].includes(draft.restructure_status || '')),
    [drafts],
  )

  usePolling(() => fetchDrafts(false), 4000, hasRestructureInFlight)

  useEffect(() => {
    if (reviewOpen && selectedDraft && !docDepartmentIds.length && visibleDepartments.length) {
      const metadataIds = (selectedDraft.content_metadata?.department_ids || []).map(String).filter(id => visibleDepartments.some(item => item.id === id))
      const fallback = selectedDraft.dept && visibleDepartments.find(item => item.name === selectedDraft.dept)?.id
      const initialIds = metadataIds.length ? metadataIds : fallback ? [fallback] : []
      setDocDepartmentIds(initialIds)
      setDocDept(visibleDepartments.find(item => item.id === initialIds[0])?.name || '')
    }
  }, [docDepartmentIds.length, reviewOpen, selectedDraft, visibleDepartments])

  const statusById = useMemo(() => new Map(
    drafts.map(draft => [draft.id, getDraftManagementStatus(draft, managementContext)]),
  ), [drafts, managementContext])
  const queueCounts = useMemo(() => {
    const counts = { all: drafts.length, ready: 0, decision: 0, processing: 0 }
    for (const draft of drafts) {
      const state = statusById.get(draft.id)?.state
      if (state === 'ready') counts.ready += 1
      else if (isPreparationQueueState(state)) counts.processing += 1
      else counts.decision += 1
    }
    return counts
  }, [drafts, statusById])
  const filteredDrafts = useMemo(() => drafts.filter((draft) => {
    const haystack = `${draft.title} ${draft.source_ref} ${draft.dept || ''} ${draft.summary || ''}`.toLowerCase()
    const matchesSearch = !query.trim() || haystack.includes(query.trim().toLowerCase())
    const state = statusById.get(draft.id)?.state
    const matchesFilter = queueFilter === 'all'
      || (queueFilter === 'ready' && state === 'ready')
      || (queueFilter === 'processing' && isPreparationQueueState(state))
      || (queueFilter === 'decision' && state !== 'ready' && !isPreparationQueueState(state))
    return matchesSearch && matchesFilter
  }).sort(compareDraftManagementOrder), [drafts, query, queueFilter, statusById])
  const eligibleVisibleDrafts = useMemo(
    () => filteredDrafts.filter(draft => statusById.get(draft.id)?.bulkEligible),
    [filteredDrafts, statusById],
  )
  useEffect(() => {
    setSelectedIds(current => current.filter(id => statusById.get(id)?.bulkEligible))
  }, [statusById])
  const selectedDrafts = useMemo(() => drafts.filter(draft => selectedIds.includes(draft.id) && statusById.get(draft.id)?.bulkEligible), [drafts, selectedIds, statusById])
  const visibleSelectedCount = eligibleVisibleDrafts.filter(draft => selectedIds.includes(draft.id)).length
  const allVisibleSelected = eligibleVisibleDrafts.length > 0 && visibleSelectedCount === eligibleVisibleDrafts.length
  const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected
  // The reviewer's own pick wins; otherwise the batch inherits a department ONLY when every
  // selected draft already agrees on one. A mixed batch leaves this empty so the bar has to
  // ask instead of silently publishing documents into a department nobody chose.
  const agreedDept = useMemo(() => {
    const names = new Set(selectedDrafts.map(draft => (draft.dept || '').trim()).filter(Boolean))
    if (names.size !== 1) return ''
    const only = [...names][0]
    return visibleDepartments.some(item => item.name === only) ? only : ''
  }, [selectedDrafts, visibleDepartments])
  const effectiveBulkDept = bulkDept || agreedDept
  const bulkDeptAmbiguous = !effectiveBulkDept
  // The single-draft flow sends department_ids alongside dept; the batch mirrors that with
  // the one department the bar resolved, so bulk publishing lands in the same place.
  const bulkDepartmentIds = useMemo(() => {
    const match = visibleDepartments.find(item => item.name === effectiveBulkDept)
    return match ? [match.id] : []
  }, [effectiveBulkDept, visibleDepartments])
  const matches = selectedDraft?.similarity_matches || []
  const assignedToCurrentUser = Boolean(selectedDraft?.assigned_approver_id && selectedDraft.assigned_approver_id === user?.id)
  const canPublishThisDraft = assignedToCurrentUser || canSelfApprove
  const restructureDecisionReady = !selectedDraft?.restructure_candidate_md || selectedDraft.restructure_decision !== 'pending_review'
  const versionDecisionReady = !selectedDraft?.requires_update_confirmation || Boolean(updateArticleId || treatAsNew)
  const publishBlockers = getPublishBlockers({
    canPublish: Boolean(canPublishThisDraft),
    hasDepartment: docDepartmentIds.length > 0,
    layoutResolved: restructureDecisionReady,
    versionResolved: versionDecisionReady,
  })
  const decisionReady = publishBlockers.length === 0
  const selectedDepartments = visibleDepartments.filter(item => docDepartmentIds.includes(item.id))
  const primaryDepartmentId = visibleDepartments.find(item => item.name === docDept)?.id
  const hasReadingView = (draft: Draft | null | undefined) => Boolean(draft?.restructured_body_md)
  const isAiBusy = (draft: Draft | null | undefined) => ['queued', 'processing'].includes(draft?.restructure_status || '')

  // `restructure_status !== 'llm'` used to gate the retry button, which offered a retry
  // on every terminal state — including the `lossless_ready` that `commit_candidates`
  // stamps on each child of a batch review. Retrying a child re-split it by department,
  // which required another batch review, which produced more children: an endless fan-out.
  // A draft that IS a committed split product never needs re-splitting, and a status the
  // AI already settled does not need a second attempt.
  // `already_structured` is terminal for the same reason: the backend skipped the model
  // because the extracted Markdown already had the headings and tables it would have
  // generated. A retry re-runs the same deterministic check, skips again, and returns
  // the same status — but not for free, because the retry path also deletes and
  // recreates the draft's routing candidates on the way to that identical answer.
  const canRetryAiFormat = (draft: Draft | null | undefined) => {
    if (!draft || isAiBusy(draft)) return false
    if (draft.content_metadata?.submission_kind === 'split_candidate') return false
    return !['llm', 'llm_reviewed', 'lossless_ready', 'already_structured', 'disabled'].includes(draft.restructure_status || '')
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

  const openReview = async (draft: Draft) => {
    if ((draft.candidate_count || 0) > 1) {
      navigate(`/governance/pending-drafts/${draft.id}/batch-review`)
      return
    }
    setReviewLoadingId(draft.id)
    setError('')
    try {
      const detail: Draft = await getPendingDraft(draft.id)
      const opensAsUpdate = detail.requires_update_confirmation || detail.similarity_level === 'very_high'
      setSelectedDraft(detail)
      setReviewOpen(true)
      setDepartmentMenuOpen(false)
      setReviewTab('structured')
      setShowComparison(opensAsUpdate)
      setShowTechnicalDetails(false)
      setUpdateArticleId(detail.content_metadata?.suggested_update_article_id || '')
      setTreatAsNew(false)
      setSelectedApproverId(detail.assigned_approver_id || '')
      setEditableTargetArticle(null)
      const metadataIds = (detail.content_metadata?.department_ids || []).map(String).filter(id => visibleDepartments.some(item => item.id === id))
      const fallbackId = detail.dept && visibleDepartments.find(item => item.name === detail.dept)?.id
      const initialIds = metadataIds.length ? metadataIds : fallbackId ? [fallbackId] : []
      setDocDepartmentIds(initialIds)
      setDocDept(visibleDepartments.find(item => item.id === initialIds[0])?.name || '')
      setComparedArticle(null)
      const targetArticleId = detail.content_metadata?.suggested_update_article_id
      if (targetArticleId) {
        void getArticle(targetArticleId).then(setEditableTargetArticle).catch(() => setEditableTargetArticle(null))
      }
      void getEligibleApprovers(detail.id).then(setApprovers).catch(() => setApprovers([]))
      const firstMatch = detail.similarity_matches?.[0]
      if (firstMatch) void loadComparison(detail.id, firstMatch.article_id)
    } catch {
      setError('Could not load this document for review.')
    } finally {
      setReviewLoadingId(null)
    }
  }

  // Referenced by the review overlay's aria-labelledby, so the dialog is announced by
  // the draft title instead of being an unlabelled region.
  const reviewTitleId = useId()

  // Escape closes the review. It is bound on the document because the overlay is a plain
  // container: an onKeyDown on it would only fire while focus sat inside its subtree.
  // Skipped while a decision is in flight, matching closeReview's own guard.
  useEffect(() => {
    if (!reviewOpen) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') closeReview() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [reviewOpen, actingDraftId])

  const closeReview = () => {
    if (actingDraftId) return
    setReviewOpen(false)
    setDepartmentMenuOpen(false)
    setShowTechnicalDetails(false)
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
        : detail?.message || t('drafts.approvalFailed')
      // The ACL guard names the exact principals it is waiting on, and where they are
      // fixed. Showing only its one-line message left the reviewer with an instruction
      // and no way to carry it out: nothing said which principal, or that the answer is
      // behind Review ACL on the source that delivered the document.
      const principals: string[] = Array.isArray(detail?.principals) ? detail.principals : []
      const guidance = principals.length
        ? [
            '',
            'Waiting on:',
            ...principals.slice(0, 10).map(name => `  • ${name}`),
            ...(principals.length > 10 ? [`  …and ${principals.length - 10} more`] : []),
            '',
            'Map these in Sources → the connector that delivered this document → Review ACL.',
          ].join('\n')
        : ''
      await dialog.alert(`${message}${guidance}`, { title: t('drafts.approvalFailedTitle') })
    } finally { setActingDraftId(null) }
  }

  const handleAssignApprover = async () => {
    if (!selectedDraft || !selectedApproverId) return
    const previousApproverId = selectedDraft.assigned_approver_id
    if (previousApproverId === selectedApproverId) {
      await dialog.alert(t('drafts.noAssignmentChange'), { title: t('drafts.noAssignmentChangeTitle') })
      return
    }
    const reason = previousApproverId
      ? (await dialog.prompt(t('drafts.reassignPrompt'), { title: t('drafts.reassignTitle'), confirmLabel: t('drafts.change'), multiline: true, placeholder: t('drafts.reassignPlaceholder'), validate: value => value.trim() ? undefined : t('drafts.reassignRequired') }))?.trim()
      : undefined
    if (previousApproverId && !reason) return
    setActingDraftId(selectedDraft.id)
    try {
      const assignment = await assignDraftApprover(selectedDraft.id, selectedApproverId, reason)
      setDrafts(current => current.map(item => item.id === selectedDraft.id ? { ...item, ...assignment } : item))
      setSelectedDraft(current => current?.id === selectedDraft.id ? { ...current, ...assignment } : current)
      setMessage(previousApproverId ? 'Approver changed and the reassignment was recorded.' : 'Approver assigned. Only that reviewer can publish or reject this draft.')
    } catch {
      await dialog.alert(t('drafts.assignmentFailed'), { title: t('drafts.assignmentFailedTitle') })
    } finally { setActingDraftId(null) }
  }

  const handleReject = async (draftId: string) => {
    if (!(await dialog.confirm(t('drafts.rejectConfirm'), { title: t('drafts.rejectTitle'), confirmLabel: t('drafts.reject'), tone: 'danger' }))) return
    const reviewNote = (await dialog.prompt(t('drafts.rejectReasonPrompt'), { title: t('drafts.rejectTitle'), confirmLabel: t('drafts.reject'), tone: 'danger', multiline: true, placeholder: t('drafts.rejectReasonPlaceholder'), validate: value => value ? undefined : t('drafts.rejectReasonRequired') }))?.trim()
    if (!reviewNote) {
      await dialog.alert(t('drafts.rejectReasonHelp'), { title: t('drafts.reasonRequiredTitle') })
      return
    }
    setActingDraftId(draftId)
    try {
      await rejectDraft(draftId, reviewNote)
      setDrafts(current => current.filter(draft => draft.id !== draftId))
      setMessage('Draft rejected. The original source remains stored.')
      closeReview()
    } catch { await dialog.alert(t('drafts.rejectionFailed'), { title: t('drafts.rejectionFailedTitle') }) } finally { setActingDraftId(null) }
  }

  const toggleDraftSelection = (draftId: string) => {
    if (!statusById.get(draftId)?.bulkEligible) return
    setSelectedIds(current => current.includes(draftId) ? current.filter(id => id !== draftId) : [...current, draftId])
  }

  const toggleAllVisible = () => {
    setSelectedIds(current => allVisibleSelected
      ? current.filter(id => !eligibleVisibleDrafts.some(draft => draft.id === id))
      : [...new Set([...current, ...eligibleVisibleDrafts.map(draft => draft.id)])])
  }

  const clearSelection = () => {
    setSelectedIds([])
    setBulkDept('')
  }

  // Cheap triage keys, matching the Gmail/Stripe convention reviewers already know:
  // `x` toggles the focused card, Escape drops the whole selection. Deliberately not a
  // keyboard-nav system — Tab already moves between cards.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (reviewOpen || event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement | null
      // Never steal keys from the search field or any other text entry.
      if (target && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))) return
      if (event.key === 'Escape' && selectedIds.length) {
        event.preventDefault()
        clearSelection()
        return
      }
      if ((event.key === 'x' || event.key === 'X') && focusedDraftId && statusById.get(focusedDraftId)?.bulkEligible) {
        event.preventDefault()
        toggleDraftSelection(focusedDraftId)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [focusedDraftId, reviewOpen, selectedIds.length, statusById])

  const runBulkDecision = async (decision: 'approve' | 'reject') => {
    const eligibleIds = selectedDrafts.map(draft => draft.id)
    if (!eligibleIds.length || bulkRunning) return
    const count = eligibleIds.length
    // The endpoint caps a batch at 100 ids; refusing here explains the limit instead of
    // letting the reviewer read a 422 they cannot act on.
    if (count > 100) {
      await dialog.alert(t('bulk.tooMany', { count }), { title: t('bulk.tooManyTitle') })
      return
    }

    let reviewNote: string | undefined
    if (decision === 'reject') {
      // Mandatory server-side (422 review_note_required); asked for once here so a whole
      // batch is never spent discovering that.
      const note = (await dialog.prompt(t('bulk.rejectNotePrompt', { count }), {
        title: t('bulk.rejectTitle'), confirmLabel: t('bulk.rejectConfirm'), tone: 'danger', multiline: true,
        placeholder: t('bulk.rejectNotePlaceholder'),
        validate: value => value ? undefined : t('bulk.rejectNoteRequired'),
      }))?.trim()
      if (!note) return
      reviewNote = note
    } else if (bulkDeptAmbiguous) {
      await dialog.alert(t('bulk.deptRequired'), { title: t('bulk.deptRequiredTitle') })
      return
    }

    // Publishing is irreversible, so the count is stated and confirmed before dispatch.
    const confirmed = await dialog.confirm(
      decision === 'approve'
        ? t('bulk.confirmApprove', { count, dept: effectiveBulkDept })
        : t('bulk.confirmReject', { count }),
      {
        title: decision === 'approve' ? t('bulk.confirmApproveTitle', { count }) : t('bulk.confirmRejectTitle', { count }),
        confirmLabel: decision === 'approve' ? t('bulk.confirmApproveLabel', { count }) : t('bulk.confirmRejectLabel', { count }),
        tone: 'danger',
      },
    )
    if (!confirmed) return

    // Titles are captured BEFORE the refresh: `blocked[]` returns ids only, and the drafts
    // list is about to change underneath us, so the results panel would lose the names.
    const titles: Record<string, string> = {}
    selectedDrafts.forEach(draft => { titles[draft.id] = draft.title })

    setBulkRunning(true)
    setBulkResult(null)
    try {
      const result = await bulkDecideDrafts({
        draft_ids: eligibleIds,
        decision,
        ...(decision === 'approve' ? { dept: effectiveBulkDept, department_ids: bulkDepartmentIds } : {}),
        ...(reviewNote ? { review_note: reviewNote } : {}),
      })
      setBulkResult({ ...result, titles })
      // Keep only the blocked ids selected: those are exactly the drafts still needing work.
      setSelectedIds(result.blocked.map(item => item.draft_id))
      setMessage(result.blocked_count
        ? t('bulk.partialMessage', { decided: result.decided_count, blocked: result.blocked_count })
        : t('bulk.successMessage', { decided: result.decided_count }))
      await fetchDrafts(false)
    } catch (requestError: unknown) {
      const { code, message: failureMessage } = extractErrorDetail(requestError)
      await dialog.alert(
        code === 'review_note_required' ? t('bulk.rejectNoteRequired') : failureMessage || t('bulk.requestFailed'),
        { title: t('bulk.requestFailedTitle') },
      )
    } finally { setBulkRunning(false) }
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
        : detail?.message || t('drafts.preparationFailed')
      await dialog.alert(message, { title: t('drafts.preparationFailedTitle') })
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
      setMessage(decision === 'keep_ai' ? t('drafts.layoutSaved') : t('drafts.safeVersionSaved'))
    } catch (requestError: any) {
      const detail = requestError?.response?.data?.detail
      await dialog.alert(typeof detail === 'string' ? detail : t('drafts.layoutDecisionFailed'), { title: t('drafts.layoutDecisionFailedTitle') })
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
    <div className="page-shell page-stack text-ink">
      <header className="border-b border-border pb-5">
        <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="mb-2 flex items-center gap-2 text-caption font-semibold uppercase tracking-[.16em] text-muted"><FileCheck2 size={14} className="text-primary" />{t('drafts.eyebrow')}</div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-foreground sm:text-3xl">{t('drafts.title')}</h1>
            <p className="mt-2 max-w-2xl text-body leading-6 text-muted-foreground">{t('drafts.description')}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => void fetchDrafts()} icon={<RefreshCw size={14} />}>{t('drafts.refresh')}</Button>
        </div>
      </header>

      {(message || error) && <div role={error ? 'alert' : 'status'} className={`rounded-lg border px-4 py-3 text-sm ${error ? 'border-destructive/25 bg-destructive/10 text-destructive-text' : 'border-success/25 bg-success/10 text-success-text'}`}>{error || message}</div>}

      <section className="rounded-xl border border-border bg-surface-elevated p-3 sm:p-4">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex gap-1 overflow-x-auto pb-1" role="tablist" aria-label={t('drafts.filterLabel')}>
            {([
              ['all', 'drafts.filterAll'],
              ['ready', 'drafts.filterReady'],
              ['decision', 'drafts.filterDecision'],
              ['processing', 'drafts.filterProcessing'],
            ] as const).map(([key, label]) => <button key={key} type="button" role="tab" aria-selected={queueFilter === key} onClick={() => { setQueueFilter(key); clearSelection() }} className={`inline-flex min-h-9 shrink-0 items-center gap-2 rounded-lg px-3 text-body-sm font-semibold transition ${queueFilter === key ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'}`}><span>{t(label)}</span><span className={`rounded-md px-1.5 py-0.5 font-mono text-caption ${queueFilter === key ? 'bg-primary-foreground/15' : 'bg-surface-muted'}`}>{queueCounts[key]}</span></button>)}
          </div>
          <div className="min-w-0 flex-1 xl:max-w-md"><Input value={query} onChange={event => { setQuery(event.target.value); clearSelection() }} placeholder={t('drafts.searchPlaceholder')} leftIcon={<Search size={15} />} /></div>
        </div>
      </section>

      {bulkResult && <section className="rounded-xl border border-border bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${bulkResult.blocked_count ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success-text'}`}>{bulkResult.blocked_count ? <AlertTriangle size={17} /> : <CheckCircle2 size={17} />}</div>
            <div><h2 className="text-sm font-semibold text-ink">{bulkResult.decision === 'approve' ? t('bulk.resultsTitleApprove') : t('bulk.resultsTitleReject')}</h2><p className="mt-1 text-body-sm text-steel">{t('bulk.resultsSummary', { decided: bulkResult.decided_count, requested: bulkResult.requested, blocked: bulkResult.blocked_count })}</p></div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => setBulkResult(null)} icon={<X size={14} />}>{t('common.close')}</Button>
        </div>
        {bulkResult.blocked_count > 0 && <div className="mt-4 space-y-2"><p className="text-caption font-semibold uppercase tracking-widest text-warning-text">{t('bulk.stillNeedYou', { count: bulkResult.blocked_count })}</p>{bulkResult.blocked.map(item => {
          const actionKey = item.code ? blockedActionKeys[item.code] : undefined
          return <div key={item.draft_id} className="rounded-lg border border-warning/25 bg-warning/[0.06] px-3 py-2.5"><p className="truncate text-xs font-semibold text-ink">{bulkResult.titles[item.draft_id] || item.draft_id}</p><p className="mt-1 text-body-sm leading-5 text-warning-text">{actionKey ? t(actionKey) : item.reason || t('bulk.blocked.unknown')}</p>{item.code === 'batch_review_required' && <Button variant="secondary" size="sm" className="mt-2" onClick={() => navigate(`/governance/pending-drafts/${item.draft_id}/batch-review`)} icon={<Layers3 size={13} />}>{t('drafts.reviewSections')}</Button>}{item.code === 'update_confirmation_required' && drafts.some(draft => draft.id === item.draft_id) && <Button variant="secondary" size="sm" className="mt-2" onClick={() => { const draft = drafts.find(entry => entry.id === item.draft_id); if (draft) openReview(draft) }} icon={<Eye size={13} />}>{t('drafts.reviewDecision')}</Button>}</div>
        })}</div>}
      </section>}

      <div className="flex flex-wrap items-center justify-between gap-3 px-1">
        <div><h2 className="text-body font-bold text-foreground">{t('drafts.queueHeading', { count: filteredDrafts.length })}</h2><p className="mt-0.5 text-body-sm text-muted-foreground">{t('drafts.queueHelp')}</p></div>
        {eligibleVisibleDrafts.length > 0 && <label className="inline-flex cursor-pointer items-center gap-2 text-body-sm font-semibold text-muted-foreground"><input type="checkbox" className="sr-only" checked={allVisibleSelected} onChange={toggleAllVisible} /><span className={`grid h-4 w-4 place-items-center rounded border ${allVisibleSelected || someVisibleSelected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-input'}`}>{allVisibleSelected ? <Check size={11} strokeWidth={3} /> : someVisibleSelected ? <Minus size={11} strokeWidth={3} /> : null}</span>{t('drafts.selectReady', { count: eligibleVisibleDrafts.length })}</label>}
      </div>

      {selectedIds.length > 0 && <section className="sticky top-2 z-sticky rounded-xl border border-primary/30 bg-surface-elevated/95 p-4 shadow-popover backdrop-blur">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0"><p className="text-sm font-semibold text-ink">{t('bulk.selectedCount', { count: selectedIds.length })}</p><p className="mt-0.5 text-body-sm text-stone">{bulkDeptAmbiguous ? t('bulk.deptMixed') : t('bulk.deptResolved', { dept: effectiveBulkDept })}</p></div>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-end"><Select value={bulkDept} onChange={event => setBulkDept(event.target.value)} className="w-full text-xs sm:w-auto sm:min-w-52" aria-label={t('bulk.deptLabel')}><option value="">{agreedDept ? t('bulk.deptInherited', { dept: agreedDept }) : t('bulk.deptChoose')}</option>{visibleDepartments.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}</Select><Button variant="primary" size="sm" onClick={() => void runBulkDecision('approve')} disabled={bulkRunning || bulkDeptAmbiguous} icon={<Check size={14} />}>{bulkRunning ? t('bulk.working') : t('bulk.approveSelected', { count: selectedIds.length })}</Button><Button variant="danger" size="sm" onClick={() => void runBulkDecision('reject')} disabled={bulkRunning}>{t('bulk.rejectSelected', { count: selectedIds.length })}</Button><Button variant="ghost" size="sm" onClick={clearSelection} disabled={bulkRunning}>{t('bulk.clearSelection')}</Button></div>
        </div>
        {bulkDeptAmbiguous && <p className="mt-2 text-body-sm text-warning-text">{t('bulk.deptRequired')}</p>}
      </section>}

      {loading ? <div role="status" className="grid min-h-56 place-items-center rounded-xl border border-border bg-surface text-sm text-muted-foreground"><RefreshCw size={16} className="mr-2 animate-spin" />{t('drafts.loading')}</div> : filteredDrafts.length === 0 ? <div className="grid min-h-64 place-items-center rounded-xl border border-dashed border-border bg-surface/50 p-8 text-center"><div><div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-success/10 text-success-text"><Check size={24} /></div><h2 className="mt-4 text-base font-semibold">{drafts.length ? t('drafts.noMatch') : t('drafts.empty')}</h2><p className="mt-2 text-sm text-muted-foreground">{drafts.length ? t('drafts.noMatchHelp') : t('drafts.emptyHelp')}</p></div></div> : <div className="overflow-hidden rounded-xl border border-border bg-surface-elevated">{filteredDrafts.map(draft => {
        const status = statusById.get(draft.id)!
        const selected = selectedIds.includes(draft.id)
        const statusLabel = status.state === 'processing' ? t('drafts.statusProcessing') : status.state === 'stalled' ? t('drafts.statusStalled') : status.state === 'split_review' ? t('drafts.statusSections') : status.state === 'ready' ? t('drafts.statusReady') : t('drafts.statusDecision')
        const reason = status.reason === 'possible_update' ? t('drafts.reasonUpdate') : status.reason === 'layout_choice' ? t('drafts.reasonLayout') : status.reason === 'missing_department' ? t('drafts.reasonDepartment') : status.reason === 'needs_approver' ? t('drafts.reasonApprover') : status.reason === 'assigned_elsewhere' ? t('drafts.reasonAssigned') : status.state === 'split_review' ? t('drafts.reasonSections', { count: draft.candidate_count || 0 }) : status.state === 'processing' ? t('drafts.reasonProcessing') : status.state === 'stalled' ? t('drafts.reasonStalled') : t('drafts.reasonReady')
        const tone = status.state === 'ready' ? 'success' : status.state === 'processing' ? 'default' : 'warning'
        const actionLabel = status.action === 'retry' ? t('drafts.retryPreparation') : status.action === 'review_sections' ? t('drafts.reviewSections') : status.action === 'review_decision' ? t('drafts.reviewDecision') : status.action === 'wait' ? t('drafts.preparing') : t('drafts.review')
        return <article key={draft.id} tabIndex={0} onFocus={() => setFocusedDraftId(draft.id)} onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocusedDraftId(current => current === draft.id ? null : current) }} className={`grid gap-4 border-b border-border p-4 outline-none transition last:border-b-0 hover:bg-surface-muted/60 lg:grid-cols-[auto_minmax(0,1.4fr)_minmax(15rem,.8fr)_auto] lg:items-center ${selected ? 'bg-primary/5' : ''} ${focusedDraftId === draft.id ? 'ring-1 ring-inset ring-primary/30' : ''}`}>
          <div className="w-5">{status.bulkEligible && <label className="inline-flex cursor-pointer" title={t('bulk.selectDraft')}><input type="checkbox" className="sr-only" checked={selected} onChange={() => toggleDraftSelection(draft.id)} aria-label={t('bulk.selectDraftNamed', { title: draft.title })} /><span className={`grid h-4 w-4 place-items-center rounded border ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-input'}`}>{selected && <Check size={11} strokeWidth={3} />}</span></label>}</div>
          <div className="min-w-0"><h3 className="truncate text-sm font-semibold text-foreground">{draft.title}</h3><p className="mt-1 truncate text-body-sm text-muted-foreground">{draft.source_ref}</p><div className="mt-2 flex flex-wrap items-center gap-2 text-caption text-muted"><span>{draft.dept || t('drafts.noDepartment')}</span><span aria-hidden="true">·</span><span>{t('drafts.submittedOn', { date: formatDay(draft.created_at) })}</span></div></div>
          <div className="min-w-0"><Badge variant={tone} size="sm">{statusLabel}</Badge><p className="mt-1.5 text-body-sm leading-5 text-muted-foreground">{reason}</p></div>
          <div className="flex flex-wrap items-center gap-2 lg:justify-end"><Button variant="primary" size="sm" onClick={() => status.action === 'retry' ? void handleRestructure(draft) : void openReview(draft)} disabled={status.action === 'wait' || reviewLoadingId === draft.id || restructuringDraftId === draft.id} loading={reviewLoadingId === draft.id || restructuringDraftId === draft.id} icon={status.action === 'retry' ? <RefreshCw size={14} /> : status.action === 'review_sections' ? <Layers3 size={14} /> : status.action === 'wait' ? <RefreshCw size={14} className="animate-spin" /> : <Eye size={14} />}>{actionLabel}</Button>{status.action !== 'wait' && status.action !== 'retry' && <Button variant="ghost" size="sm" onClick={() => void handleReject(draft.id)} disabled={actingDraftId === draft.id}>{t('drafts.reject')}</Button>}{status.action !== 'retry' && canRetryAiFormat(draft) && <Button variant="ghost" size="sm" onClick={() => void handleRestructure(draft)} disabled={restructuringDraftId === draft.id} aria-label={t('drafts.retryPreparation')} icon={<RefreshCw size={13} />} />}</div>
        </article>
      })}</div>}

      {reviewOpen && selectedDraft &&<div className="fixed inset-0 z-modal bg-scrim/30 p-0 backdrop-blur-[2px] sm:p-3" role="dialog" aria-modal="true" aria-labelledby={reviewTitleId}><FocusTrap className="contents"><section className="mx-auto flex h-full max-w-[100rem] flex-col overflow-hidden border border-border bg-canvas shadow-modal sm:rounded-panel">
        <header className="shrink-0 border-b border-border bg-surface px-4 py-3 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant="info" size="sm">{t('drafts.reviewing')}</Badge>{selectedDraft.requires_update_confirmation && <Badge variant="warning" size="sm">{t('drafts.statusDecision')}</Badge>}</div><h2 id={reviewTitleId} className="mt-1 truncate text-base font-semibold text-foreground sm:text-lg">{selectedDraft.title}</h2><p className="mt-1 truncate text-body-sm text-muted-foreground">{selectedDraft.source_ref} · {t('drafts.sourceSafe')}</p></div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">{matches.length > 0 && <Button variant="ghost" size="sm" onClick={toggleComparison} icon={<ArrowLeftRight size={13} />}>{showComparison ? t('drafts.hideComparison') : t('drafts.compare')}</Button>}<Button variant="ghost" size="sm" onClick={() => setShowTechnicalDetails(value => !value)}>{showTechnicalDetails ? t('drafts.hideTechnicalDetails') : t('drafts.technicalDetails')}</Button><button type="button" onClick={closeReview} className="ui-icon-button ui-button-sm text-muted-foreground hover:bg-surface-soft hover:text-foreground" aria-label={t('common.close')}><X size={18} /></button></div>
          </div>
          <ol className="mt-3 grid grid-cols-3 overflow-hidden rounded-lg border border-border bg-background text-center text-caption font-semibold text-muted-foreground"><li className="border-r border-border bg-primary/10 px-2 py-1.5 text-primary-text">{t('drafts.reviewStepRead')}</li><li className="border-r border-border px-2 py-1.5">{t('drafts.reviewStepCheck')}</li><li className="px-2 py-1.5">{t('drafts.reviewStepDecide')}</li></ol>
        </header>
        {showComparison && matches.length > 0 && <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-hairline bg-surface-soft px-4 py-2.5 sm:px-6"><span className="mr-1 text-caption font-semibold uppercase tracking-widest text-stone">{t('drafts.relatedDocument')}</span>{matches.map(match => <button key={match.article_id} onClick={() => void loadComparison(selectedDraft.id, match.article_id)} className={`rounded-lg border px-2.5 py-1.5 text-left text-xs transition ${compareArticleId === match.article_id ? 'border-amber-300/40 bg-amber-400/10 text-warning-text' : 'border-hairline bg-canvas text-steel hover:border-amber-300/30 hover:text-ink'}`}><span className="font-semibold">{Math.round(match.score * 100)}%</span> · {match.title}</button>)}</div>}
        {showTechnicalDetails && <section className="shrink-0 border-b border-border bg-surface-soft">
          <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-6">{user?.permissions?.includes('ai.ask') && <Button variant="ghost" size="sm" onClick={() => navigate(`/ai?${editableTargetArticle ? `articleId=${encodeURIComponent(editableTargetArticle.id)}&articleTitle=${encodeURIComponent(editableTargetArticle.title)}&` : ''}prompt=${encodeURIComponent(requestDraftPrompt)}`)} icon={<MessageSquare size={13} />}>{t('drafts.askAi')}</Button>}{canEditTargetArticle && editableTargetArticle && <Button variant="ghost" size="sm" onClick={() => navigate(`/articles/${editableTargetArticle.id}/edit`)} icon={<Edit3 size={13} />}>{t('drafts.editSource')}</Button>}{canRetryAiFormat(selectedDraft) && <Button variant="ghost" size="sm" onClick={() => void handleRestructure(selectedDraft)} disabled={restructuringDraftId === selectedDraft.id} icon={<RefreshCw size={13} />}>{t('drafts.retryPreparation')}</Button>}<span className="ml-auto font-mono text-caption text-muted">{selectedDraft.restructure_status || 'unknown'}</span></div>
          <ReviewQuality report={selectedDraft.restructure_report} chunkCount={selectedDraft.restructure_chunk_count} busy={isAiBusy(selectedDraft)} />
          {selectedDraft.restructure_error && <p className="border-t border-warning/20 px-4 py-2 text-body-sm text-warning-text sm:px-6">{selectedDraft.restructure_error}</p>}
        </section>}
        <div className={`grid min-h-0 flex-1 grid-cols-1 ${showComparison ? 'lg:grid-cols-2' : ''}`}>
          <section className="flex min-h-0 flex-col border-b border-border lg:border-b-0 lg:border-r">
            <div className="flex shrink-0 flex-col gap-2 border-b border-border px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <p className="text-caption font-semibold uppercase tracking-widest text-primary-text">{t('drafts.incomingDocument')}</p>
              <div className="flex overflow-x-auto rounded-lg border border-border bg-surface p-0.5"><button type="button" onClick={() => setReviewTab('structured')} className={`shrink-0 rounded-md px-2.5 py-1 text-body-sm font-semibold ${reviewTab === 'structured' ? 'bg-primary/10 text-primary-text' : 'text-muted-foreground hover:text-foreground'}`}>{t('drafts.readingView')}</button>{selectedDraft.restructure_candidate_md && <button type="button" onClick={() => setReviewTab('candidate')} className={`shrink-0 rounded-md px-2.5 py-1 text-body-sm font-semibold ${reviewTab === 'candidate' ? 'bg-warning/10 text-warning-text' : 'text-muted-foreground hover:text-foreground'}`}>{t('drafts.preparedVersion')}</button>}<button type="button" onClick={() => setReviewTab('original')} className={`shrink-0 rounded-md px-2.5 py-1 text-body-sm font-semibold ${reviewTab === 'original' ? 'bg-surface-muted text-foreground' : 'text-muted-foreground hover:text-foreground'}`}>{t('drafts.originalVersion')}</button></div>
            </div>
            {isAiBusy(selectedDraft) && <div role="status" className="flex items-start gap-2 border-b border-info/20 bg-info/[0.06] px-4 py-2 text-body-sm leading-5 text-info-text sm:px-6"><RefreshCw size={13} className="mt-0.5 shrink-0 animate-spin" /><span>{t('drafts.preparingReadingView')}</span></div>}
            <div className="ask-scroll min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">{renderMarkdown(reviewTab === 'candidate' ? (selectedDraft.restructure_candidate_md || t('drafts.noExtractedText')) : reviewTab === 'structured' ? (selectedDraft.restructured_body_md || selectedDraft.summary || t('drafts.noExtractedText')) : (selectedDraft.summary || t('drafts.noExtractedText')))}</div>
          </section>
          {showComparison && <section className="flex min-h-0 flex-col"><div className="flex shrink-0 items-center gap-3 border-b border-border px-4 py-2.5 sm:px-6"><ArrowLeftRight size={15} className="text-warning-text" /><div className="min-w-0"><p className="text-caption font-semibold uppercase tracking-widest text-warning-text">{t('drafts.relatedDocument')}</p><p className="mt-1 truncate text-xs text-muted-foreground">{comparedArticle?.title || (matches.length ? t('drafts.loadingComparison') : t('drafts.noComparison'))}</p></div></div><div className="ask-scroll min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-6">{compareLoading ? <div role="status" className="flex h-full items-center justify-center text-sm text-muted-foreground"><RefreshCw size={16} className="mr-2 animate-spin" />{t('drafts.loadingComparison')}</div> : comparedArticle ? <>{renderMarkdown(comparedArticle.body_md)}<div className="mt-6 border-t border-border pt-3 text-xs text-muted-foreground">Version {comparedArticle.version} · {comparedArticle.lifecycle_status}</div></> : <div className="flex h-full items-center justify-center text-center text-sm text-muted-foreground">{matches.length ? t('drafts.chooseComparison') : t('drafts.noComparison')}</div>}</div></section>}
        </div>
        <footer className="shrink-0 border-t border-border bg-surface px-4 py-3 sm:px-6">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
            <section aria-labelledby="publish-check-heading">
              <div className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-md bg-primary/10 text-caption font-bold text-primary-text">2</span><h3 id="publish-check-heading" className="text-sm font-semibold text-foreground">{t('drafts.checkHeading')}</h3></div>
              {publishBlockers.length > 0 ? <ul className="mt-2 grid gap-1 text-body-sm text-warning-text sm:grid-cols-2">{publishBlockers.map(blocker => <li key={blocker} className="flex items-start gap-1.5"><AlertTriangle size={12} className="mt-0.5 shrink-0" /><span>{t(`drafts.blocker${blocker === 'reviewer' ? 'Reviewer' : blocker === 'department' ? 'Department' : blocker === 'layout' ? 'Layout' : 'Version'}`)}</span></li>)}</ul> : <p className="mt-1.5 flex items-center gap-1.5 text-body-sm text-success-text"><CheckCircle2 size={13} />{t('drafts.checkReady')}</p>}
            </section>
            <div className="flex flex-wrap justify-end gap-2"><Button variant="danger" size="sm" onClick={() => void handleReject(selectedDraft.id)} disabled={!canPublishThisDraft || Boolean(actingDraftId)}>{t('drafts.reject')}</Button><Button variant="primary" size="sm" onClick={() => void handleConfirmApprove()} disabled={!decisionReady || Boolean(actingDraftId)} icon={<Check size={14} />}>{actingDraftId ? t('drafts.publishing') : t('drafts.publish')}</Button></div>
          </div>
          <div className="mt-3 space-y-3 border-t border-border pt-3">
            {!selectedDraft.assigned_approver_id && !canSelfApprove && <div className="flex flex-col gap-2 sm:flex-row sm:items-center"><span className="text-body-sm font-semibold text-warning-text">{t('drafts.blockerReviewer')}</span><Select value={selectedApproverId} onChange={event => setSelectedApproverId(event.target.value)} className="w-full text-xs sm:w-64"><option value="">{t('drafts.selectReviewer')}</option>{approvers.map(approver => <option key={approver.id} value={approver.id}>{approver.name} · {approver.email}</option>)}</Select><Button variant="secondary" size="sm" onClick={() => void handleAssignApprover()} disabled={!selectedApproverId || Boolean(actingDraftId)}>{t('drafts.assign')}</Button></div>}
            {selectedDraft.assigned_approver_id && <div className="flex flex-col gap-2 sm:flex-row sm:items-center"><span className="text-body-sm text-muted-foreground">{t('drafts.assignedReviewer')}</span><Select aria-label={t('drafts.assignedReviewer')} value={selectedApproverId} onChange={event => setSelectedApproverId(event.target.value)} className="w-full text-xs sm:w-64"><option value="">{t('drafts.selectAnotherReviewer')}</option>{approvers.map(approver => <option key={approver.id} value={approver.id}>{approver.name} · {approver.email}</option>)}</Select><Button variant="ghost" size="sm" onClick={() => void handleAssignApprover()} disabled={!selectedApproverId || selectedApproverId === selectedDraft.assigned_approver_id || Boolean(actingDraftId)}>{t('drafts.change')}</Button></div>}
            {selectedDraft.requires_update_confirmation && !isManualUpdate && <div className="flex flex-wrap items-center gap-2"><span className="text-body-sm font-semibold text-warning-text">{t('drafts.blockerVersion')}</span><Button variant={!treatAsNew && updateArticleId ? 'secondary' : 'ghost'} size="sm" onClick={() => { const targetId = updateArticleId || compareArticleId || selectedDraft.content_metadata?.suggested_update_article_id || matches[0]?.article_id; if (targetId) { setUpdateArticleId(targetId); setTreatAsNew(false) } }} disabled={!updateArticleId && !compareArticleId && !selectedDraft.content_metadata?.suggested_update_article_id && !matches[0]?.article_id}>{t('drafts.updateExisting')}</Button><Button variant={treatAsNew ? 'secondary' : 'ghost'} size="sm" onClick={() => { setTreatAsNew(true); setUpdateArticleId('') }}>{t('drafts.publishNew')}</Button></div>}
            {selectedDraft.restructure_candidate_md && selectedDraft.restructure_decision === 'pending_review' && <div className="flex flex-wrap items-center gap-2"><span className="text-body-sm font-semibold text-warning-text">{t('drafts.blockerLayout')}</span><Button variant="secondary" size="sm" onClick={() => { setReviewTab('original'); void handleRestructureDecision('keep_lossless') }} disabled={Boolean(actingDraftId)}>{t('drafts.useSafeVersion')}</Button><Button variant="primary" size="sm" onClick={() => { setReviewTab('candidate'); void handleRestructureDecision('keep_ai') }} disabled={Boolean(actingDraftId)}>{t('drafts.usePreparedVersion')}</Button></div>}
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center"><span className="text-body-sm font-semibold text-foreground">{t('drafts.publishingDepartments')}</span><div className="relative min-w-0 flex-1 sm:max-w-sm"><button ref={departmentMenuAnchor} type="button" onClick={() => setDepartmentMenuOpen(open => !open)} disabled={!visibleDepartments.length} className="field flex min-h-9 w-full items-center gap-2 py-1.5 text-left text-xs disabled:opacity-50"><span className="min-w-0 flex-1 truncate">{selectedDepartments.length ? selectedDepartments.map(item => item.name).join(', ') : t('drafts.noDepartment')}</span><ChevronDown size={14} className={`shrink-0 transition ${departmentMenuOpen ? 'rotate-180' : ''}`} /></button><FloatingPanel anchorRef={departmentMenuAnchor} open={departmentMenuOpen} onClose={() => setDepartmentMenuOpen(false)} className="p-1.5"><div className="py-1">{visibleDepartments.map(item => { const selected = docDepartmentIds.includes(item.id); const primary = item.id === primaryDepartmentId; return <button type="button" key={item.id} onClick={() => toggleDepartment(item.id)} className="flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-xs text-muted-foreground hover:bg-surface-soft hover:text-foreground"><span className={`grid h-4 w-4 shrink-0 place-items-center rounded border ${selected ? 'border-primary bg-primary text-primary-foreground' : 'border-border'}`}>{selected && <Check size={11} strokeWidth={3} />}</span><span className="min-w-0 flex-1 truncate">{item.name}</span>{primary && <span className="text-caption font-semibold text-warning-text">{t('drafts.primaryDepartment')}</span>}</button> })}</div><button type="button" onClick={() => setDepartmentMenuOpen(false)} className="w-full rounded-lg border border-border px-2.5 py-1.5 text-body-sm font-semibold text-primary-text hover:bg-primary/10">{t('common.confirm')}</button></FloatingPanel></div></div>
          </div>
        </footer>
      </section></FocusTrap></div>}
    </div>
  )
}
