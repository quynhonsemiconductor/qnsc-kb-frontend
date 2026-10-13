import { describe, expect, it } from 'vitest'
import { compareDraftManagementOrder, getDraftManagementStatus, getPreparationCompletion, getPublishBlockers, isPreparationQueueState, type ManageableDraft } from '../../src/utils/draftManagement'

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

  it('treats a rate-limit-deferred AI formatting as still preparing, with its own reason', () => {
    expect(getDraftManagementStatus(draft({ restructure_status: 'deferred' }), context)).toMatchObject({
      state: 'processing', action: 'wait', reason: 'ai_deferred', bulkEligible: false,
    })
  })

  it('reports completion when a deferred draft finishes preparing', () => {
    const before = [draft({ restructure_status: 'deferred' })]
    const after = [draft({ restructure_status: 'llm' })]
    expect(getPreparationCompletion(before, after, context)).not.toBeNull()
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

describe('preparation transitions', () => {
  const processing = (id: string) => draft({ id, restructure_status: 'processing' })

  it('reports the terminal destination for a completed preparation', () => {
    expect(getPreparationCompletion(
      [processing('ready')],
      [draft({ id: 'ready', restructure_status: 'lossless_ready' })],
      context,
    )).toEqual({ count: 1, destination: 'ready' })

    expect(getPreparationCompletion(
      [processing('sections')],
      [draft({ id: 'sections', restructure_status: 'lossless_ready', candidate_count: 2 })],
      context,
    )).toEqual({ count: 1, destination: 'split_review' })
  })

  it('reports mixed destinations for preparations finishing together', () => {
    expect(getPreparationCompletion(
      [processing('ready'), processing('decision')],
      [
        draft({ id: 'ready', restructure_status: 'llm' }),
        draft({ id: 'decision', restructure_status: 'llm', requires_update_confirmation: true }),
      ],
      context,
    )).toEqual({ count: 2, destination: 'mixed' })
  })

  it('does not report interrupted or missing drafts as completed', () => {
    expect(getPreparationCompletion(
      [processing('stalled')],
      [draft({ id: 'stalled', restructure_status: 'stalled' })],
      context,
    )).toBeNull()
    expect(getPreparationCompletion([processing('missing')], [], context)).toBeNull()
    expect(isPreparationQueueState('stalled')).toBe(true)
  })
})

describe('draft management ordering', () => {
  it('orders every state from latest to oldest', () => {
    const items = [
      draft({ id: 'processing', created_at: '2026-01-02T00:00:00Z', restructure_status: 'queued' }),
      draft({ id: 'ready-new', created_at: '2026-01-05T00:00:00Z' }),
      draft({ id: 'decision', created_at: '2026-01-04T00:00:00Z', requires_update_confirmation: true }),
      draft({ id: 'sections', created_at: '2026-01-03T00:00:00Z', candidate_count: 2 }),
      draft({ id: 'ready-old', created_at: '2026-01-01T00:00:00Z' }),
    ]

    expect(items.sort(compareDraftManagementOrder).map(item => item.id)).toEqual([
      'ready-new', 'decision', 'sections', 'processing', 'ready-old',
    ])
  })

  it('uses the id as a deterministic tie-breaker', () => {
    const items = [draft({ id: 'b' }), draft({ id: 'a' })]
    expect(items.sort(compareDraftManagementOrder).map(item => item.id)).toEqual(['a', 'b'])
  })
})
