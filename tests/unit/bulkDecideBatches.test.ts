import { beforeEach, describe, expect, it, vi } from 'vitest'

const { post } = vi.hoisted(() => ({ post: vi.fn() }))

vi.mock('../../src/api/client', () => ({ default: { post } }))
vi.mock('../../src/hooks/useAsyncResource', () => ({ invalidateAsyncResource: vi.fn() }))

import { BULK_DECIDE_BATCH_LIMIT, bulkDecideDraftsInBatches } from '../../src/api/governance'

const ids = (n: number) => Array.from({ length: n }, (_, i) => `d${i}`)

// Echo back every id as decided, like the real endpoint does for a clean batch.
const decideAll = (...args: unknown[]) => {
  const body = args[1] as { draft_ids: string[]; decision: string }
  return Promise.resolve({
    data: {
      decision: body.decision, requested: body.draft_ids.length, decided_count: body.draft_ids.length, blocked_count: 0,
      decided: body.draft_ids.map(draft_id => ({ draft_id, title: draft_id })), blocked: [],
    },
  })
}

describe('bulkDecideDraftsInBatches', () => {
  beforeEach(() => { post.mockReset() })

  it('splits 369 drafts into requests of at most 100 and merges the results', async () => {
    post.mockImplementation(decideAll)
    const result = await bulkDecideDraftsInBatches({ draft_ids: ids(369), decision: 'approve', dept: 'Ops' })
    expect(post.mock.calls.map(call => call[1].draft_ids.length)).toEqual([100, 100, 100, 69])
    expect(post.mock.calls.every(call => call[1].dept === 'Ops')).toBe(true)
    expect(result).toMatchObject({ requested: 369, decided_count: 369, blocked_count: 0 })
    expect(new Set(result.decided.map(item => item.draft_id)).size).toBe(369)
    expect(BULK_DECIDE_BATCH_LIMIT).toBe(100)
  })

  it('sends a single request when the selection fits', async () => {
    post.mockImplementation(decideAll)
    await bulkDecideDraftsInBatches({ draft_ids: ids(100), decision: 'reject', review_note: 'no' })
    expect(post).toHaveBeenCalledOnce()
  })

  it('carries blocked drafts from every batch', async () => {
    post.mockImplementation((_u: string, body: { draft_ids: string[] }) => Promise.resolve({
      data: {
        decision: 'approve', requested: body.draft_ids.length, decided_count: body.draft_ids.length - 1, blocked_count: 1,
        decided: body.draft_ids.slice(1).map(draft_id => ({ draft_id, title: draft_id })),
        blocked: [{ draft_id: body.draft_ids[0], status_code: 409, code: 'x' }],
      },
    }))
    const result = await bulkDecideDraftsInBatches({ draft_ids: ids(150), decision: 'approve', dept: 'Ops' })
    expect(result.blocked.map(item => item.draft_id)).toEqual(['d0', 'd100'])
    expect(result.decided_count).toBe(148)
  })

  it('reports what a failing later batch left undone instead of losing the earlier work', async () => {
    post.mockImplementationOnce(decideAll).mockRejectedValueOnce({ response: { data: { detail: 'busy' } } })
    const result = await bulkDecideDraftsInBatches({ draft_ids: ids(250), decision: 'approve', dept: 'Ops' })
    expect(post).toHaveBeenCalledTimes(2)
    expect(result.decided_count).toBe(100)
    expect(result.blocked_count).toBe(150)
    expect(result.blocked[0]).toMatchObject({ draft_id: 'd100', code: 'batch_not_processed', reason: 'busy' })
  })

  it('throws when the very first batch fails, since nothing was decided', async () => {
    post.mockRejectedValue(new Error('down'))
    await expect(bulkDecideDraftsInBatches({ draft_ids: ids(5), decision: 'approve', dept: 'Ops' })).rejects.toThrow('down')
  })

  it('ignores duplicate ids', async () => {
    post.mockImplementation(decideAll)
    const result = await bulkDecideDraftsInBatches({ draft_ids: ['a', 'a', 'b'], decision: 'reject', review_note: 'n' })
    expect(result.requested).toBe(2)
  })
})
