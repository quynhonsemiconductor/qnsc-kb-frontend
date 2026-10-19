/**
 * Paging rules for the pending-drafts review queue.
 *
 * The API serves the queue in pages and reports the real total in an `X-Total-Count`
 * header. Before that, the endpoint returned at most 500 rows and said nothing about the
 * rest, so the page showed "500" however many drafts were pending and the oldest were in no
 * tab at all. These are pure functions, in the same spirit as `shouldTick` in `usePolling`,
 * so the rules can be tested without rendering the page.
 *
 * Everything here has to cope with an API that does NOT page yet (the backend and this
 * frontend deploy separately): then there is no header, `parseTotalCount` returns null, and
 * the page behaves exactly as it did before.
 */

/** The API's page size, and also its maximum. */
export const QUEUE_PAGE_SIZE = 500

type WithId = { id: string }

/**
 * Read the `X-Total-Count` header.
 *
 * `null` means "the server did not say", which is how an API that predates paging looks.
 * It is deliberately not 0 or the row count: callers use null to fall back to the old
 * behaviour (filter the loaded rows in the browser, show no pager).
 */
export function parseTotalCount(raw: unknown): number | null {
  if (raw === undefined || raw === null) return null
  // Digits only. `parseInt` would read "1.5x" as 1, and a total that is quietly wrong is
  // worse than an unknown one: it would hide or invent a pager.
  const text = String(raw).trim()
  return /^\d+$/.test(text) ? Number.parseInt(text, 10) : null
}

/**
 * Whether there are more rows on the server than are loaded.
 *
 * Unknown (null) total is "no": without a total there is no way to know, and offering a
 * button that may return nothing is worse than not offering one.
 */
export function hasMore(loaded: number, total: number | null): boolean {
  return total !== null && loaded < total
}

/**
 * Add the next page to what is already loaded, skipping rows already present.
 *
 * Paging is by offset, so if drafts are decided between two requests the window shifts and
 * a row can be served twice. De-duplicating on `id` keeps the list honest instead of
 * showing the same document in two places.
 */
export function appendPage<T extends WithId>(current: T[], incoming: T[]): T[] {
  const seen = new Set(current.map(item => item.id))
  return [...current, ...incoming.filter(item => !seen.has(item.id))]
}

/**
 * Fold a freshly polled FIRST page into what is already loaded.
 *
 * Polling re-reads only the first page, because that is where documents still being
 * prepared are (the queue is newest-first). The first page replaces the old head, so status
 * changes show up; rows loaded beyond it are kept rather than thrown away every few
 * seconds, minus any that the new first page now covers.
 */
export function refreshFirstPage<T extends WithId>(
  current: T[],
  firstPage: T[],
  pageSize: number = QUEUE_PAGE_SIZE,
): T[] {
  const inFirstPage = new Set(firstPage.map(item => item.id))
  const loadedBeyond = current.slice(pageSize).filter(item => !inFirstPage.has(item.id))
  return [...firstPage, ...loadedBeyond]
}

/**
 * The number to show on a tab.
 *
 * A tab count is computed from the rows that are loaded. While some rows are not, it is a
 * lower bound, so it is marked as one ("120+") rather than presented as exact.
 */
export function formatQueueCount(count: number, partial: boolean): string {
  return partial ? `${count}+` : String(count)
}
