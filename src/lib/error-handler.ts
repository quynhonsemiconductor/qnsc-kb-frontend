/**
 * Read an axios failure without reaching through `any`.
 *
 * Every credential screen needs the same two facts from a rejected request: the HTTP
 * status (to tell "expired" from "already used" from "wrong password") and the server's
 * `detail` string. FastAPI sends `detail` as either a string or a validation array, so a
 * non-string detail is reported as absent and the caller falls back to its own message.
 */
type ApiFailure = {
  response?: { status?: number; data?: { detail?: unknown }; headers?: Record<string, unknown> }
}

function asApiFailure(error: unknown): ApiFailure {
  return error && typeof error === 'object' ? (error as ApiFailure) : {}
}

export function apiErrorStatus(error: unknown): number | undefined {
  return asApiFailure(error).response?.status
}

export function apiErrorDetail(error: unknown): string | undefined {
  const detail = asApiFailure(error).response?.data?.detail
  return typeof detail === 'string' ? detail : undefined
}

/**
 * Seconds to wait before retrying a throttled request, from the `Retry-After` header.
 *
 * RFC 9110 allows either a delay in seconds or an HTTP date, and the two are not
 * distinguishable by shape alone — "120" parses as a date in some engines. Digits are
 * therefore tested first. A date in the past, or a header the server did not send, yields
 * undefined so the caller shows the generic wording rather than "try again in NaNs".
 */
export function retryAfterSeconds(error: unknown): number | undefined {
  const raw = asApiFailure(error).response?.headers?.['retry-after']
  if (raw === undefined || raw === null) return undefined
  const value = String(raw).trim()
  if (/^\d+$/.test(value)) return Number(value)
  const until = Date.parse(value)
  if (Number.isNaN(until)) return undefined
  return Math.max(0, Math.ceil((until - Date.now()) / 1000))
}

/**
 * The single place a failed request becomes text a user may read.
 *
 * Screens used to interpolate `err.response.data.detail` straight into the UI, which leaks
 * server-authored English into a Vietnamese-first interface and, worse, shows raw text from
 * whatever layer produced the failure — a rate limiter's "Too Many Requests", a proxy's
 * HTML error page. Status CLASS is what a user can act on, so it decides the wording:
 *
 *   401  the session is gone. The response interceptor is already navigating to /login, so
 *        this only matters for the rare caller that surfaces the error first.
 *   403  authenticated but not permitted. Never a retry, never a re-login.
 *   429  throttled. `Retry-After` turns "try later" into a concrete number.
 *   5xx  the server broke. Retrying is reasonable; the detail is for logs, not users.
 *   none no response at all — offline, DNS, CORS preflight. Distinguished from a 5xx
 *        because "check your connection" is the actionable half.
 *
 * A 4xx not listed above is the endpoint answering a question (422 validation, 409
 * conflict). Those carry a `detail` the caller asked for, so it is passed through: the
 * caller knows the semantics of its own endpoint and this function does not.
 */
export function userMessage(error: unknown, t: (key: string, variables?: Record<string, string | number>) => string): string {
  const status = apiErrorStatus(error)
  if (status === undefined) return t('error.network')
  if (status === 401) return t('error.sessionExpiredShort')
  if (status === 403) return t('error.forbidden')
  if (status === 429) {
    const seconds = retryAfterSeconds(error)
    return seconds === undefined ? t('error.rateLimited') : t('error.rateLimitedAfter', { seconds })
  }
  if (status >= 500) return t('error.server')
  return apiErrorDetail(error) || t('error.unexpected')
}
