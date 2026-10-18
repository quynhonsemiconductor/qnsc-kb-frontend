import { beforeEach, describe, expect, it, vi } from 'vitest'

const { get } = vi.hoisted(() => ({ get: vi.fn() }))

vi.mock('../../src/api/client', () => ({ default: { get } }))
vi.mock('../../src/hooks/useAsyncResource', () => ({ invalidateAsyncResource: vi.fn() }))

import { getPendingDraftsPage } from '../../src/api/governance'

describe('getPendingDraftsPage', () => {
  beforeEach(() => get.mockReset())

  it('returns the rows and the real total the server reports', async () => {
    const rows = [{ id: 'a' }, { id: 'b' }]
    get.mockResolvedValue({ data: rows, headers: { 'x-total-count': '534' } })

    const page = await getPendingDraftsPage({ status: 'pending', limit: 500 })

    expect(page).toEqual({ items: rows, total: 534 })
  })

  it('sends the paging and search arguments to the queue endpoint', async () => {
    get.mockResolvedValue({ data: [], headers: { 'x-total-count': '0' } })

    await getPendingDraftsPage({ status: 'pending', limit: 500, offset: 500, search: 'quy trinh' })

    expect(get).toHaveBeenCalledWith('/governance/pending-drafts', {
      params: { status: 'pending', limit: 500, offset: 500, search: 'quy trinh' },
    })
  })

  it('reports an unknown total when the server sends no header', async () => {
    // An API that predates paging: it ignores limit/offset/search and sends up to 500 rows.
    // `null` is what lets the page fall back to filtering them itself and show no pager.
    get.mockResolvedValue({ data: [{ id: 'a' }], headers: {} })

    const page = await getPendingDraftsPage({ status: 'pending' })

    expect(page.total).toBeNull()
    expect(page.items).toHaveLength(1)
  })

  it('does not trust a malformed header', async () => {
    get.mockResolvedValue({ data: [], headers: { 'x-total-count': 'lots' } })

    expect((await getPendingDraftsPage({})).total).toBeNull()
  })

  it('tolerates a response with no headers object at all', async () => {
    get.mockResolvedValue({ data: [] })

    expect((await getPendingDraftsPage({})).total).toBeNull()
  })
})
