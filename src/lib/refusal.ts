import type { Citation } from '../types/ai'

/**
 * The assistant's "I could not find this" answer, as the page needs to show it.
 *
 * The server says when an answer is a refusal (`refused`), keeps the refusal sentence apart
 * (`refusalText`) and lists the nearest documents (`related_sources`). Older answers, and
 * answers stored before those fields existed, only have the text, so this also recognises a
 * refusal by its wording in Vietnamese or English.
 */

const LEGACY_REFUSAL =
  /kh[oô]ng t[iì]m th[aấ]y[^.\n]{0,60}(?:c[oơ] s[oở] (?:tri th[uứ]c|ki[eế]n th[uứ]c)|knowledge base)|not found in the knowledge base|could not find[^.\n]{0,60}knowledge base/i

/** Whether a message is a refusal: the server's flag, or (for an old message) its wording. */
export function isRefusal(message: { refused?: boolean; text: string; citations?: unknown[]; failed?: boolean }): boolean {
  if (message.failed) return false
  if (message.citations && message.citations.length > 0) return false
  return Boolean(message.refused) || LEGACY_REFUSAL.test(message.text.trim().slice(0, 400))
}

/**
 * The refusal sentence on its own. The server sends it separately; for an older message the
 * text is the sentence followed by a quoted passage ("A possibly related passage in ..."), and
 * only the first paragraph is the refusal.
 */
export function refusalSentence(message: { refusalText?: string; text: string }): string {
  const given = (message.refusalText || '').trim()
  if (given) return given
  return message.text.trim().split(/\n\s*\n/)[0].trim()
}

/** Related sources from the stream or a stored message, as citations the viewer can open. */
export function parseRelatedSources(raw: unknown): Citation[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>()
  const out: Citation[] = []
  for (const entry of raw) {
    const item = entry as Record<string, unknown> | null
    if (!item || typeof item.article_id !== 'string' || !item.article_id || seen.has(item.article_id)) continue
    seen.add(item.article_id)
    out.push({
      source_id: typeof item.source_id === 'string' ? item.source_id : undefined,
      article_id: item.article_id,
      title: typeof item.title === 'string' && item.title ? item.title : item.article_id,
      section_ref: typeof item.section_ref === 'string' ? item.section_ref : undefined,
      excerpt: typeof item.excerpt === 'string' ? item.excerpt : undefined,
      highlight_text: typeof item.highlight_text === 'string' ? item.highlight_text : undefined,
      page_number: typeof item.page_number === 'number' ? item.page_number : undefined,
      source_url: typeof item.source_url === 'string' ? item.source_url : undefined,
    })
    if (out.length >= 5) break
  }
  return out
}
