// What a search result shows of a chunk: the text with its markdown markers taken off, and the words that were
// searched for picked out so the eye lands on them.

/** Words too common to be worth marking, in the two languages the knowledge base is written in. */
const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'was', 'with', 'what', 'how', 'who', 'when', 'where', 'which', 'that', 'this', 'from',
  'của', 'là', 'và', 'cho', 'các', 'một', 'những', 'có', 'được', 'trong', 'khi', 'nào', 'gì', 'thế', 'như', 'với',
])

export type SnippetPart = { text: string; match: boolean }

/** One UTF-16 unit lower-cased and without its accent; `đ` has no decomposition, so it is mapped by hand. */
function foldUnit(unit: string): string {
  const lower = unit.toLowerCase()
  if (lower === 'đ') return 'd'
  const base = lower.normalize('NFD').replace(/\p{M}/gu, '')
  // Anything that does not fold to exactly one unit (a lone combining mark, `İ`) is kept as it is, so the folded
  // text stays as long as the original and a position in one is a position in the other.
  return base.length === 1 ? base : unit
}

/** The text lower-cased and without accents, one unit for each unit of the input (positions line up). */
function fold(text: string): string {
  let out = ''
  for (let i = 0; i < text.length; i += 1) out += foldUnit(text[i])
  return out
}

/** The words of a query worth marking: no stop words, no one- or two-letter words unless they carry a digit (`I2C`). */
export function searchTerms(query: string): string[] {
  const terms = new Set<string>()
  for (const word of query.split(/[\s,;:()[\]{}"'“”‘’?!]+/)) {
    const cleaned = word.replace(/^[^\p{L}\p{N}_]+|[^\p{L}\p{N}_]+$/gu, '')
    if (!cleaned) continue
    const lower = cleaned.toLowerCase()
    if (STOP_WORDS.has(lower)) continue
    if (cleaned.length < 3 && !/\d/.test(cleaned)) continue
    terms.add(fold(cleaned))
  }
  // The longest first, so `GPIO0` wins over `GPIO` where both could match at the same place.
  return [...terms].sort((a, b) => b.length - a.length)
}

/** Cuts `text` into parts, each marked as a hit or not. Accent and case do not matter, as in the search itself. */
export function highlightParts(text: string, terms: string[]): SnippetPart[] {
  if (!text || terms.length === 0) return [{ text, match: false }]
  const haystack = fold(text)
  const hits: Array<[number, number]> = []
  for (const term of terms) {
    let from = 0
    for (;;) {
      const at = haystack.indexOf(term, from)
      if (at < 0) break
      hits.push([at, at + term.length])
      from = at + term.length
    }
  }
  if (hits.length === 0) return [{ text, match: false }]
  hits.sort((a, b) => a[0] - b[0] || b[1] - a[1])
  const merged: Array<[number, number]> = []
  for (const [start, end] of hits) {
    const last = merged[merged.length - 1]
    if (last && start <= last[1]) last[1] = Math.max(last[1], end)
    else merged.push([start, end])
  }
  const parts: SnippetPart[] = []
  let cursor = 0
  for (const [start, end] of merged) {
    if (start > cursor) parts.push({ text: text.slice(cursor, start), match: false })
    parts.push({ text: text.slice(start, end), match: true })
    cursor = end
  }
  if (cursor < text.length) parts.push({ text: text.slice(cursor), match: false })
  return parts
}

/**
 * A chunk as plain text: heading marks (`### Title`), emphasis marks and the blank-line runs that markdown leaves are
 * taken off. Table rows stay as they are, one row to a line, which is how they read best.
 */
export function tidySnippet(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/^[ \t]{0,3}#{1,6}[ \t]+/gm, '')
    .replace(/(\*\*|__)(.+?)\1/g, '$2')
    .replace(/^[ \t]*[-*][ \t]+/gm, '• ')
    .replace(/[ \t]+$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}
