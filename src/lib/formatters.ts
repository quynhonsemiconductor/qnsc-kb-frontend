/**
 * Parse a timestamp as the API actually means it.
 *
 * The API stores and returns NAIVE UTC: every datetime column is `DateTime` with no
 * timezone, and the values come from `datetime.utcnow()`, so a response carries
 * `2026-08-29T09:23:23.847907` — no `Z`, no offset.
 *
 * ECMAScript parses a date-TIME string with no offset as LOCAL time. So every timestamp
 * rendered straight from the API was wrong by the reader's own UTC offset: a sync that
 * ran at 12:58 in Vietnam displayed as 05:58, and "Finished" could read as earlier than
 * "Started" across a boundary.
 *
 * Stamping those as UTC is a correction, not a guess — it is what the server means. An
 * offset that IS present is honoured, so this stays right if the API starts sending one.
 *
 * A date-ONLY string is left alone: ECMAScript already reads `2026-08-29` as UTC, and
 * appending `Z` to it produces an invalid date rather than a corrected one.
 */
export function parseApiDate(value?: string | number | Date | null): Date | null {
  if (value === null || value === undefined || value === '') return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value
  if (typeof value === 'number') return new Date(value)

  const text = value.trim()
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(text)
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(text)
  // Some serializers use a space instead of `T`; Safari refuses that form outright.
  const normalized = dateOnly || hasZone ? text : `${text.replace(' ', 'T')}Z`

  const parsed = new Date(normalized)
  return Number.isNaN(parsed.getTime()) ? null : parsed
}

/** Date and time in the reader's own timezone, e.g. "29 Aug 2026, 16:58". */
export function formatDateTime(value?: string | number | Date | null, fallback = '—'): string {
  const parsed = parseApiDate(value)
  return parsed
    ? parsed.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : fallback
}

/** Date alone in the reader's own timezone. Still parsed as UTC first: near midnight the
 * correct local date differs from the one in the raw string. */
export function formatDay(value?: string | number | Date | null, fallback = '—'): string {
  const parsed = parseApiDate(value)
  return parsed ? parsed.toLocaleDateString() : fallback
}

/** The `YYYY-MM-DD` a `<input type="date">` expects, in the reader's timezone. */
export function toDateInputValue(value?: string | number | Date | null): string {
  const parsed = parseApiDate(value)
  if (!parsed) return ''
  // Local parts, not toISOString(): that converts back to UTC and can land on the
  // previous day for anyone east of Greenwich.
  const month = `${parsed.getMonth() + 1}`.padStart(2, '0')
  const day = `${parsed.getDate()}`.padStart(2, '0')
  return `${parsed.getFullYear()}-${month}-${day}`
}


/**
 * Only expose http(s) URLs as clickable external links. Anything else
 * (javascript:, data:, or unparsable values) renders without an href.
 */
export function safeExternalUrl(value: string): string | undefined {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined
  } catch {
    return undefined
  }
}
