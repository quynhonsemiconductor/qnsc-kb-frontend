type ApiFailure = { response?: { status?: number; data?: { detail?: unknown } } }

export type SaveFailure = {
  message: string
  /** The server's version moved while this one was being edited: publishing again can only fail until it is reloaded. */
  stale: boolean
}

export const STALE_MESSAGE = 'Someone else published a newer version while you were editing. Load the latest version, then re-apply your changes; your text is kept below.'

export function describeSaveFailure(error: unknown): SaveFailure {
  const failure = error as ApiFailure
  if (failure?.response?.status === 409) return { message: STALE_MESSAGE, stale: true }
  const detail = failure?.response?.data?.detail
  return { message: typeof detail === 'string' ? detail : 'It could not be saved.', stale: false }
}
