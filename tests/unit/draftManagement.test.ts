import { describe, expect, it } from 'vitest'
import { compareDraftManagementOrder, getDraftManagementStatus, getPublishBlockers, type ManageableDraft } from '../../src/utils/draftManagement'

const context = { currentUserId: 'reviewer-1', canSelfApprove: false }
const draft = (overrides: Partial<ManageableDraft> = {}): ManageableDraft => ({
  id: 'draft-1',
  created_at: '2026-01-02T00:00:00Z',
  dept: 'Engineering',
  restructure_status: 'llm',
  assigned_approver_id: 'reviewer-1',
  ...overrides,
})

describe('draft management status', () => {
  it('prioritizes processing over split and update decisions', () => {
    expect(getDraftManagementStatus(draft({ restructure_status: 'processing', candidate_count: 3, requires_update_confirmation: true }), context)).toMatchObject({
      state: 'processing', action: 'wait', bulkEligible: false,
    })
  })

  it('turns a stalled preparation into an actionable retry', () => {
    expect(getDraftManagementStatus(draft({ restructure_status: 'stalled' }), context)).toMatchObject({
      state: 'stalled', action: 'retry', bulkEligible: false,
    })
  })

  it('preserves a layout decision from lightweight list metadata', () => {
    expect(getDraftManagementStatus(draft({ has_restructure_candidate: true, restructure_decision: 'pending_review' }), context)).toMatchObject({
      state: 'decision', reason: 'layout_choice', bulkEligible: false,
    })
  })

  it('prioritizes section review over an update decision', () => {
    expect(getDraftManagementStatus(draft({ candidate_count: 2, requires_update_confirmation: true }), context)).toMatchObject({
      state: 'split_review', action: 'review_sections', bulkEligible: false,
    })
  })

  it.each([
    [{ requires_update_confirmation: true }, 'possible_update'],
    [{ restructure_candidate_md: '# Candidate', restructure_decision: 'pending_review' }, 'layout_choice'],
    [{ dept: '', content_metadata: { department_ids: [] } }, 'missing_department'],
    [{ assigned_approver_id: null }, 'needs_approver'],
    [{ assigned_approver_id: 'reviewer-2' }, 'assigned_elsewhere'],
  ] as const)('marks an individual decision for %s', (overrides, reason) => {
    expect(getDraftManagementStatus(draft(overrides), context)).toMatchObject({
      state: 'decision', action: 'review_decision', reason, bulkEligible: false,
    })
  })

  it('allows ordinary drafts assigned to the current reviewer into bulk actions', () => {
    expect(getDraftManagementStatus(draft({ assigned_approver_id: 'reviewer-1' }), context)).toMatchObject({
      state: 'ready', action: 'review', bulkEligible: true,
    })
  })

  it('lets a self-approver manage a draft assigned elsewhere', () => {
    expect(getDraftManagementStatus(draft({ assigned_approver_id: 'reviewer-2' }), { ...context, canSelfApprove: true })).toMatchObject({
      state: 'ready', bulkEligible: true,
    })
  })
})

describe('publish readiness', () => {
  it('lists every unresolved publication requirement in a stable order', () => {
    expect(getPublishBlockers({ canPublish: false, hasDepartment: false, layoutResolved: false, versionResolved: false })).toEqual([
      'reviewer', 'department', 'layout', 'version',
    ])
  })

  it('returns no blockers when the document is ready', () => {
    expect(getPublishBlockers({ canPublish: true, hasDepartment: true, layoutResolved: true, versionResolved: true })).toEqual([])
  })
})

describe('draft management ordering', () => {
  it('orders sections, decisions, ready drafts, then processing and keeps oldest first', () => {
    const items = [
      draft({ id: 'processing', restructure_status: 'queued' }),
      draft({ id: 'ready-new', created_at: '2026-01-03T00:00:00Z' }),
      draft({ id: 'decision', requires_update_confirmation: true }),
      draft({ id: 'sections', candidate_count: 2 }),
      draft({ id: 'ready-old', created_at: '2026-01-01T00:00:00Z' }),
    ]

    expect(items.sort((left, right) => compareDraftManagementOrder(left, right, context)).map(item => item.id)).toEqual([
      'sections', 'decision', 'ready-old', 'ready-new', 'processing',
    ])
  })
})
