/**
 * Rules for the "correct text in the original" panel, kept out of the component so they can
 * be tested without rendering it. The limits mirror the API (`MAX_REPLACEMENTS`,
 * `MAX_TEXT_LENGTH` in `source_edit.py`), which enforces them regardless.
 */

export const MAX_EDIT_ROWS = 20
export const MAX_EDIT_TEXT = 500

export interface EditRow {
  find: string
  replace: string
}

export interface EditPayload {
  replacements: EditRow[]
}

/**
 * The rows that will actually be sent: a row with nothing to find is an unfilled line, not an
 * edit. The text is sent exactly as typed, because a space or a letter case is part of what
 * is being matched.
 */
export function filledRows(rows: EditRow[]): EditRow[] {
  return rows.filter(row => row.find !== '')
}

/** A reason this set of rows cannot be sent, or null when it can. */
export function rowsProblem(rows: EditRow[]): 'empty' | 'unchanged' | 'tooLong' | 'tooMany' | null {
  const filled = filledRows(rows)
  if (filled.length === 0) return 'empty'
  if (filled.length > MAX_EDIT_ROWS) return 'tooMany'
  if (filled.some(row => row.find.length > MAX_EDIT_TEXT || row.replace.length > MAX_EDIT_TEXT)) return 'tooLong'
  if (filled.some(row => row.find === row.replace)) return 'unchanged'
  return null
}

/**
 * What the check found. `counts` lines up with the rows that were sent, so it is mapped back
 * onto the editable rows (which may include unfilled lines that were not sent).
 */
export function countsByRow(rows: EditRow[], counts: number[]): Array<number | null> {
  let sent = 0
  return rows.map(row => (row.find === '' ? null : (counts[sent++] ?? null)))
}

/** A change can be submitted only once every line was checked and every one of them matched. */
export function canSubmit(rows: EditRow[], counts: number[] | null): boolean {
  if (!counts || rowsProblem(rows) !== null) return false
  const filled = filledRows(rows)
  return counts.length === filled.length && counts.every(count => count > 0)
}

/** The API's 422 body for text that was not found: `{ code: 'text_not_found', missing: [...] }`. */
export function missingTexts(error: unknown): string[] | null {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (detail && typeof detail === 'object' && (detail as { code?: unknown }).code === 'text_not_found') {
    const missing = (detail as { missing?: unknown }).missing
    return Array.isArray(missing) ? missing.map(String) : []
  }
  return null
}

/** A plain message from an API error, whether `detail` is a string or the structured form. */
export function editErrorMessage(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail
  if (typeof detail === 'string' && detail) return detail
  if (detail && typeof detail === 'object') {
    const message = (detail as { message?: unknown }).message
    if (typeof message === 'string' && message) return message
  }
  return fallback
}
