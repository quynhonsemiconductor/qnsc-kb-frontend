/**
 * Pure rules for correcting text by selecting it in the document.
 *
 * The reader selects some words in the original file, types what they should say, and the page
 * tells the server WHICH occurrence was meant by sending the text just around the selection
 * (and, for a PDF, the page). Everything here is arithmetic on strings and rectangles, so it
 * can be tested without a browser.
 */

/** Characters of surrounding text sent with a selection. Enough to tell occurrences apart. */
export const CONTEXT_CHARS = 60
export const MAX_SELECTION_CHARS = 500
export const MAX_PENDING_EDITS = 20

export interface SelectionInfo {
  /** The selected text, exactly as the document shows it. */
  text: string
  /** Text just before and after the selection in reading order. */
  before: string
  after: string
  /** PDF only: 1-based page the selection starts on. */
  page?: number
  /** Where the selection is, in the coordinates the popover is placed in (viewport pixels). */
  rect: { left: number; top: number; width: number; height: number }
  /** Where to draw the correction over the document once it is queued. */
  overlay?: Overlay
  /** The selection runs over more than one line (a viewer that has no line breaks in its text sets this). */
  multiline?: boolean
}

export interface PendingEdit {
  id: string
  find: string
  replace: string
  before: string
  after: string
  page?: number
  /** Change every match instead of only the selected one. */
  all: boolean
  /** Where to draw the new text over the document (see `Overlay`). */
  overlay?: Overlay
}

/** A box over the document, as fractions of the element it is drawn in (so it survives zooming). */
export interface Overlay {
  left: number
  top: number
  width: number
  height: number
  /** PDF page the box belongs to, if any. */
  page?: number
  /** The numbers are pixels in the frame's own document, not fractions (Word/Excel/PowerPoint). */
  px?: boolean
}

/** The wire shape the API takes for one change (`SourceEditItem`). */
export interface EditPayloadRow {
  find: string
  replace: string
  before?: string
  after?: string
  page?: number
}

/** Selected text with non-breaking spaces made ordinary, because that is how the file stores them. */
export function cleanSelectedText(raw: string): string {
  return raw.replace(/ /g, ' ')
}

/** Why a selection cannot be edited, or null when it can. */
export function selectionProblem(text: string): 'empty' | 'multiline' | 'tooLong' | null {
  if (!text.trim()) return 'empty'
  // The file stores a line, a paragraph or a cell at a time, so a match cannot cross a break.
  if (/[\r\n]/.test(text)) return 'multiline'
  if (text.length > MAX_SELECTION_CHARS) return 'tooLong'
  return null
}

/**
 * A selection without the spaces at either end. A double-click selects "1234 " with its trailing
 * space, and the correction should be about the word; the spaces move into the surrounding text.
 */
export function trimSelection<T extends Pick<SelectionInfo, 'text' | 'before' | 'after'>>(selection: T): T {
  const lead = selection.text.length - selection.text.trimStart().length
  const trail = selection.text.length - selection.text.trimEnd().length
  if (!lead && !trail) return selection
  const text = selection.text.trim()
  return {
    ...selection,
    text,
    before: selection.before + selection.text.slice(0, lead),
    after: selection.text.slice(selection.text.length - trail) + selection.after,
  }
}

/** Whether a set of client rectangles (one per line fragment of a selection) lies on more than one line. */
export function spansLines(rects: Array<{ top: number; height: number }>): boolean {
  const tall = rects.filter(rect => rect.height > 0)
  if (tall.length < 2) return false
  const reference = tall[0]
  return tall.some(rect => Math.abs(rect.top - reference.top) > reference.height * 0.6)
}

/** The text around the `[start, start+length)` slice of `whole`, up to `size` characters each side. */
export function contextAround(whole: string, start: number, length: number, size = CONTEXT_CHARS): { before: string; after: string } {
  const from = Math.max(0, start)
  const end = Math.min(whole.length, from + length)
  return {
    before: whole.slice(Math.max(0, from - size), from),
    after: whole.slice(end, end + size),
  }
}

/** The payload row for a change. `all` drops the context so every match is changed. */
export function toPayloadRow(edit: Pick<PendingEdit, 'find' | 'replace' | 'before' | 'after' | 'page' | 'all'>): EditPayloadRow {
  if (edit.all) return { find: edit.find, replace: edit.replace }
  const row: EditPayloadRow = { find: edit.find, replace: edit.replace }
  if (edit.before) row.before = edit.before
  if (edit.after) row.after = edit.after
  if (edit.page) row.page = edit.page
  return row
}

/** A change the reader can still queue: it must differ, and the queue must have room. */
export function canQueue(pending: PendingEdit[], find: string, replace: string): 'ok' | 'same' | 'full' {
  if (find === replace) return 'same'
  if (pending.length >= MAX_PENDING_EDITS) return 'full'
  return 'ok'
}

/**
 * Where to put a popover of `size` next to a selection, kept inside the viewport.
 * Below the selection when there is room, above it otherwise.
 */
export function placePopover(
  rect: SelectionInfo['rect'],
  viewport: { width: number; height: number },
  size: { width: number; height: number },
  gap = 8,
): { left: number; top: number } {
  const maxLeft = Math.max(gap, viewport.width - size.width - gap)
  const left = Math.min(Math.max(gap, rect.left), maxLeft)
  const below = rect.top + rect.height + gap
  const top = below + size.height <= viewport.height - gap ? below : Math.max(gap, rect.top - size.height - gap)
  return { left, top }
}

/** A rectangle expressed as fractions of a container, so it can be drawn again at any size. */
export function toFractions(
  rect: { left: number; top: number; width: number; height: number },
  container: { left: number; top: number; width: number; height: number },
): Overlay | null {
  if (container.width <= 0 || container.height <= 0) return null
  return {
    left: (rect.left - container.left) / container.width,
    top: (rect.top - container.top) / container.height,
    width: rect.width / container.width,
    height: rect.height / container.height,
  }
}

/** A short label for a queued change. */
export function describeEdit(edit: Pick<PendingEdit, 'find' | 'replace'>, max = 28): string {
  const clip = (value: string) => (value.length > max ? `${value.slice(0, max - 1)}…` : value)
  return `${clip(edit.find)} → ${clip(edit.replace) || '∅'}`
}

/**
 * What a check of the queue found, per change. `selected` is how many matches agree with the
 * selection's surroundings, `everywhere` how many matches the text has at all.
 */
export interface EditCounts {
  selected: number
  everywhere: number
}

/** Whether a queued change is certain to land: a selected occurrence was found, or "all" was chosen and any exists. */
export function willApply(edit: Pick<PendingEdit, 'all'>, counts: EditCounts | undefined): boolean {
  if (!counts) return false
  return edit.all ? counts.everywhere > 0 : counts.selected > 0
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
