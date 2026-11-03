/**
 * Query parameters for the article LIST.
 *
 * A list draws titles, departments and badges. Without this the server also sends every document's full
 * text: 541 KB for a page of 50 real specifications, 90% of it body text nobody reads on that screen.
 * `include_body: true` can still be passed by a caller that does want it.
 */
export function articleListParams<T extends Record<string, unknown>>(params: T): T & { include_body: boolean } {
  return { include_body: false, ...params }
}
