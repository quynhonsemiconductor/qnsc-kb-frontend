import { beforeEach, describe, expect, it, vi } from 'vitest'

const { post, invalidateAsyncResource } = vi.hoisted(() => ({
  post: vi.fn(),
  invalidateAsyncResource: vi.fn(),
}))

vi.mock('../../src/api/client', () => ({ default: { post } }))
vi.mock('../../src/hooks/useAsyncResource', () => ({ invalidateAsyncResource }))

import { approveDraft, bulkDecideDrafts } from '../../src/api/governance'

describe('published knowledge cache invalidation', () => {
  beforeEach(() => {
    post.mockReset()
    invalidateAsyncResource.mockReset()
  })

  it('invalidates Home data after a draft is published', async () => {
    post.mockResolvedValue({ data: { id: 'article-1', status: 'published' } })

    await approveDraft('draft-1', 'Operations', ['department-1'])

    expect(invalidateAsyncResource).toHaveBeenCalledOnce()
    expect(invalidateAsyncResource).toHaveBeenCalledWith('home-')
  })

  it('keeps cached Home data when publishing fails', async () => {
    post.mockRejectedValue(new Error('Approval failed'))

    await expect(approveDraft('draft-1', 'Operations')).rejects.toThrow('Approval failed')
    expect(invalidateAsyncResource).not.toHaveBeenCalled()
  })

  it('invalidates only when bulk approval publishes at least one draft', async () => {
    post
      .mockResolvedValueOnce({ data: { decision: 'approve', requested: 1, decided_count: 1, blocked_count: 0, decided: [], blocked: [] } })
      .mockResolvedValueOnce({ data: { decision: 'approve', requested: 1, decided_count: 0, blocked_count: 1, decided: [], blocked: [] } })
      .mockResolvedValueOnce({ data: { decision: 'reject', requested: 1, decided_count: 1, blocked_count: 0, decided: [], blocked: [] } })

    await bulkDecideDrafts({ draft_ids: ['draft-1'], decision: 'approve', dept: 'Operations' })
    await bulkDecideDrafts({ draft_ids: ['draft-2'], decision: 'approve', dept: 'Operations' })
    await bulkDecideDrafts({ draft_ids: ['draft-3'], decision: 'reject' })

    expect(invalidateAsyncResource).toHaveBeenCalledOnce()
    expect(invalidateAsyncResource).toHaveBeenCalledWith('home-')
  })
})
