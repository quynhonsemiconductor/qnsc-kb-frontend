export const handleError = (e: unknown) => console.error(e);

/**
 * Read an axios failure without reaching through `any`.
 *
 * Every credential screen needs the same two facts from a rejected request: the HTTP
 * status (to tell "expired" from "already used" from "wrong password") and the server's
 * `detail` string. FastAPI sends `detail` as either a string or a validation array, so a
 * non-string detail is reported as absent and the caller falls back to its own message.
 */
type ApiFailure = { response?: { status?: number; data?: { detail?: unknown } } }

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
