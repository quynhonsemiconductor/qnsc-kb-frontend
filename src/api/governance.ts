import client from './client'

export async function uploadSource(file: File, tags: string[] = [], dept?: string, departmentIds: string[] = []) {
  // Upload through the authenticated API rather than PUTing directly from the
  // browser to R2. This keeps the R2 bucket private and avoids a browser CORS
  // failure leaving an invisible "uploading" reservation behind.
  const form = new FormData()
  form.append('file', file)
  form.append('tags', JSON.stringify(tags))
  if (dept) form.append('dept', dept)
  if (departmentIds.length) form.append('department_ids', JSON.stringify(departmentIds))
  return (await client.post('/articles/upload-source', form)).data
}

export async function uploadSources(files: File[], tagsByFile: string[][] = [], dept?: string, departmentIds: string[] = []) {
  const results: any[] = []
  for (const [index, file] of files.entries()) {
    try {
      results.push({ filename: file.name, status: 'queued', ...(await uploadSource(file, tagsByFile[index] || [], dept, departmentIds)) })
    } catch (error: any) {
      const detail = error?.response?.data?.detail
      results.push({
        filename: file.name,
        status: detail?.code === 'duplicate_document' ? 'duplicate' : 'failed',
        status_code: error?.response?.status,
        detail: typeof detail === 'object' ? detail : { message: detail || error?.message || 'Upload failed' },
      })
    }
  }
  return {
    results,
    queued_count: results.filter(item => item.status === 'queued').length,
    duplicate_count: results.filter(item => item.status === 'duplicate').length,
    failed_count: results.filter(item => item.status === 'failed').length,
  }
}

export async function getPendingDrafts(status?: string) {
  const response = await client.get('/governance/pending-drafts', { params: { status } })
  return response.data
}

export async function approveDraft(id: string, dept: string, departmentIds: string[] = [], updateArticleId?: string, treatAsNew = false) {
  const response = await client.post(`/governance/pending-drafts/${id}/approve`, {
    dept,
    department_ids: departmentIds,
    update_article_id: updateArticleId || null,
    treat_as_new: treatAsNew,
  })
  return response.data
}

export async function assignDraftApprover(id: string, approverId: string, reason?: string) {
  const response = await client.post(`/governance/pending-drafts/${id}/assign-approver`, { approver_id: approverId, reason: reason || undefined })
  return response.data
}

export async function getEligibleApprovers(id: string) {
  const response = await client.get(`/governance/pending-drafts/${id}/eligible-approvers`)
  return response.data
}

export async function rejectDraft(id: string, reviewNote: string) {
  const response = await client.post(`/governance/pending-drafts/${id}/reject`, { review_note: reviewNote })
  return response.data
}

export type BulkDecideDecided = {
  draft_id: string
  title: string
  article_id?: string
  version?: number
  status?: string
}

export type BulkDecideBlocked = {
  draft_id: string
  status_code: number
  code?: string | null
  reason?: string | null
}

export type BulkDecideResult = {
  decision: 'approve' | 'reject'
  requested: number
  decided_count: number
  blocked_count: number
  decided: BulkDecideDecided[]
  blocked: BulkDecideBlocked[]
}

export async function bulkDecideDrafts(payload: {
  draft_ids: string[]
  decision: 'approve' | 'reject'
  dept?: string
  department_ids?: string[]
  visibility?: 'public' | 'department'
  review_note?: string
}): Promise<BulkDecideResult> {
  const response = await client.post('/governance/pending-drafts/bulk-decide', payload)
  return response.data
}

export async function restructureDraft(id: string) {
  const response = await client.post(`/governance/pending-drafts/${id}/restructure`)
  return response.data
}

export async function decideRestructure(id: string, decision: 'keep_ai' | 'keep_lossless') {
  const response = await client.post(`/governance/pending-drafts/${id}/restructure-decision`, { decision })
  return response.data
}

export async function getDraftComparison(draftId: string, articleId: string) {
  const response = await client.get(`/governance/pending-drafts/${draftId}/comparison`, { params: { article_id: articleId } })
  return response.data
}

export async function getDraftCandidates(draftId: string) {
  const response = await client.get(`/governance/pending-drafts/${draftId}/candidates`)
  return response.data
}

export async function reviewDraftCandidate(draftId: string, payload: { operation: string; candidate_id: string; other_candidate_id?: string; title?: string; split_at?: number; department_ids?: string[]; note?: string }) {
  const response = await client.post(`/governance/pending-drafts/${draftId}/candidates/operation`, payload)
  return response.data
}

export async function commitDraftCandidates(draftId: string) {
  const response = await client.post(`/governance/pending-drafts/${draftId}/candidates/commit`)
  return response.data
}

export async function getFeatureFlags() {
  const response = await client.get('/governance/feature-flags')
  return response.data
}

export async function updateFeatureFlag(key: string, enabled: boolean) {
  const response = await client.put(`/governance/feature-flags/${encodeURIComponent(key)}`, {
    enabled,
    rollout_percent: 100,
    role: null,
    department: null,
  })
  return response.data
}

export async function getSearchGaps(status?: string) {
  const response = await client.get('/governance/gaps', { params: { status } })
  return response.data
}

export async function assignSearchGap(id: string, dept: string) {
  const response = await client.post(`/governance/gaps/${id}/assign`, { dept })
  return response.data
}

export async function dismissSearchGap(id: string) {
  const response = await client.post(`/governance/gaps/${id}/dismiss`)
  return response.data
}

// The audit table is append-only and never shrinks, so the page must ask for a window
// rather than whatever the server's default happens to be. The response stays a plain
// array; a full page implies there may be more, which is what drives the pager.
export async function getAuditLogs(filters: { userId?: string; action?: string; startTime?: string; endTime?: string; limit?: number; offset?: number } = {}) {
  const response = await client.get('/governance/audit-log', {
    params: {
      user_id: filters.userId || undefined,
      action: filters.action || undefined,
      start_time: filters.startTime || undefined,
      end_time: filters.endTime || undefined,
      limit: filters.limit,
      offset: filters.offset,
    },
  })
  return response.data
}

export async function getHealthMetrics() {
  const response = await client.get('/governance/health-metrics')
  return response.data
}

export async function getEvalRuns() {
  const response = await client.get('/governance/eval-runs')
  return response.data
}

export async function getEvalReport() {
  const response = await client.get('/governance/eval-report')
  return response.data
}

export async function verifyReviewDeadlines() {
  const response = await client.post('/governance/reviews/verify')
  return response.data
}

// The AI agent that applies a written rule to pending drafts. Scoping (connector, dept,
// file extension, similarity ceiling) is structured and enforced server-side; only the
// free-text `instruction` is ever sent to the model. can_approve/can_reject both default
// to false, so a new rule is a dry run until someone explicitly grants it authority.
export type ApprovalRule = {
  id: string
  name: string
  instruction: string
  active: boolean
  priority: number
  connector_id: string | null
  dept: string | null
  file_extensions: string[] | null
  max_similarity_score: number | null
  can_approve: boolean
  can_reject: boolean
  created_by: string | null
  created_at: string
  updated_at: string
}

export type ApprovalRulePayload = {
  name: string
  instruction: string
  active?: boolean
  priority?: number
  connector_id?: string | null
  dept?: string | null
  file_extensions?: string[] | null
  max_similarity_score?: number | null
  can_approve?: boolean
  can_reject?: boolean
}

export async function listApprovalRules(): Promise<ApprovalRule[]> {
  return (await client.get('/governance/approval-rules')).data
}

export async function createApprovalRule(payload: ApprovalRulePayload): Promise<ApprovalRule> {
  return (await client.post('/governance/approval-rules', payload)).data
}

export async function updateApprovalRule(id: string, payload: ApprovalRulePayload): Promise<ApprovalRule> {
  return (await client.patch(`/governance/approval-rules/${id}`, payload)).data
}

export async function deleteApprovalRule(id: string): Promise<void> {
  await client.delete(`/governance/approval-rules/${id}`)
}

export type ApprovalAgentResult = {
  draft_id: string
  title: string | null
  decision: 'approve' | 'reject' | 'abstain'
  applied: boolean
  rule: string | null
  reason: string
}

export type ApprovalAgentRunResponse = {
  evaluated: number
  approved: number
  rejected: number
  left_for_review: number
  results: ApprovalAgentResult[]
  disabled?: boolean
}

// Defaults to a dry run server-side if `dry_run` is omitted -- deciding hundreds of
// drafts unattended should be something a caller asks for, not what happens by omission.
export async function runApprovalAgent(payload: { dry_run?: boolean; limit?: number } = {}): Promise<ApprovalAgentRunResponse> {
  return (await client.post('/governance/approval-agent/run', payload)).data
}
