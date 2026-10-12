export type DraftQueueState = 'processing' | 'stalled' | 'split_review' | 'decision' | 'ready'
export type DraftPrimaryAction = 'wait' | 'retry' | 'review_sections' | 'review_decision' | 'review'
export type DraftDecisionReason = 'possible_update' | 'layout_choice' | 'missing_department' | 'needs_approver' | 'assigned_elsewhere' | null

export type ManageableDraft = {
  id: string
  created_at: string
  dept?: string | null
  candidate_count?: number
  restructure_status?: string
  restructure_candidate_md?: string | null
  has_restructure_candidate?: boolean
  restructure_decision?: string
  requires_update_confirmation?: boolean
  assigned_approver_id?: string | null
  content_metadata?: { department_ids?: string[] } | null
}

export type DraftManagementContext = {
  currentUserId?: string
  canSelfApprove: boolean
}

export type DraftManagementStatus = {
  state: DraftQueueState
  action: DraftPrimaryAction
  reason: DraftDecisionReason
  bulkEligible: boolean
  priority: number
}

export function getDraftManagementStatus(
  draft: ManageableDraft,
  context: DraftManagementContext,
): DraftManagementStatus {
  if (['queued', 'processing'].includes(draft.restructure_status || '')) {
    return { state: 'processing', action: 'wait', reason: null, bulkEligible: false, priority: 4 }
  }
  if (draft.restructure_status === 'stalled') {
    return { state: 'stalled', action: 'retry', reason: null, bulkEligible: false, priority: 0 }
  }

  if ((draft.candidate_count || 0) > 1) {
    return { state: 'split_review', action: 'review_sections', reason: null, bulkEligible: false, priority: 0 }
  }

  const needsApprover = !draft.assigned_approver_id && !context.canSelfApprove
  const assignedElsewhere = Boolean(
    draft.assigned_approver_id
    && draft.assigned_approver_id !== context.currentUserId
    && !context.canSelfApprove,
  )
  const needsLayoutChoice = Boolean(
    (draft.has_restructure_candidate || draft.restructure_candidate_md)
    && draft.restructure_decision === 'pending_review',
  )
  const hasDepartment = Boolean(
    draft.dept?.trim()
    || draft.content_metadata?.department_ids?.length,
  )

  const reason: DraftDecisionReason = draft.requires_update_confirmation
    ? 'possible_update'
    : needsLayoutChoice
      ? 'layout_choice'
      : !hasDepartment
        ? 'missing_department'
        : needsApprover
          ? 'needs_approver'
          : assignedElsewhere
            ? 'assigned_elsewhere'
            : null

  if (reason) {
    return { state: 'decision', action: 'review_decision', reason, bulkEligible: false, priority: 1 }
  }

  return { state: 'ready', action: 'review', reason: null, bulkEligible: true, priority: 2 }
}

export type PublishBlocker = 'reviewer' | 'department' | 'layout' | 'version'

export function getPublishBlockers({
  canPublish,
  hasDepartment,
  layoutResolved,
  versionResolved,
}: {
  canPublish: boolean
  hasDepartment: boolean
  layoutResolved: boolean
  versionResolved: boolean
}): PublishBlocker[] {
  const blockers: PublishBlocker[] = []
  if (!canPublish) blockers.push('reviewer')
  if (!hasDepartment) blockers.push('department')
  if (!layoutResolved) blockers.push('layout')
  if (!versionResolved) blockers.push('version')
  return blockers
}

export function compareDraftManagementOrder(
  left: ManageableDraft,
  right: ManageableDraft,
  context: DraftManagementContext,
) {
  const priority = getDraftManagementStatus(left, context).priority - getDraftManagementStatus(right, context).priority
  if (priority !== 0) return priority
  return Date.parse(left.created_at) - Date.parse(right.created_at)
}
