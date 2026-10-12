/**
 * Shared rules for showing an original uploaded file in the browser.
 *
 * The allow-list lives here, not in each viewer, because two surfaces now render the same
 * stored sources: the full-screen `PdfViewer` (article detail, Ask) and the pending-draft
 * review pane. A second copy of the list would eventually disagree with the first, and the
 * disagreement would be a security one.
 *
 * These are the only types the API ever serves inline (`_SAFE_SOURCE_MEDIA_TYPES` in
 * source_storage.py); everything else comes back as `application/octet-stream; attachment`.
 * All of them are inert as documents: an image cannot script, and a PDF is drawn by the
 * browser's own viewer in its own process. The check is repeated client-side because these
 * viewers receive a `blob:` URL, and a blob URL carries no headers to enforce anything with.
 */
export const INLINE_SOURCE_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'text/plain',
]

/**
 * Whether this type may be rendered in the page.
 *
 * An absent type is allowed: it means an older caller passed nothing, and those callers
 * have always been PDF viewers. Treating unknown as unrenderable would break them.
 */
export function canInlineSourceType(mimeType?: string | null): boolean {
  const type = (mimeType || '').toLowerCase()
  return !type || INLINE_SOURCE_TYPES.includes(type)
}

export type SourcePreviewMode = 'loading' | 'unavailable' | 'download' | 'image' | 'embed'

/**
 * Resolve what the review pane should show, as one value instead of nested ternaries.
 *
 * `unavailable` and `download` are both ordinary outcomes rather than errors: a draft may
 * have no stored file at all (nothing to preview), and a stored file may be a format no
 * browser displays safely (offer it instead of refusing).
 */
export function sourcePreviewMode({
  loading,
  unavailable,
  url,
  mimeType,
}: {
  loading?: boolean
  unavailable?: boolean
  url?: string | null
  mimeType?: string | null
}): SourcePreviewMode {
  if (unavailable) return 'unavailable'
  if (loading || !url) return 'loading'
  if (!canInlineSourceType(mimeType)) return 'download'
  return (mimeType || '').toLowerCase().startsWith('image/') ? 'image' : 'embed'
}

/**
 * A display name for the stored file, taken from the draft's `source_ref`.
 *
 * The review payload carries no `original_filename`, so the reference it does carry
 * (`upload://server_access_quick_guide (1).pdf`, `sharepoint://drive-1/file-1`) is the only
 * name available. Query strings and fragments are dropped so a connector reference does not
 * render its plumbing, and an empty result falls back rather than showing nothing.
 */
export function sourceFileNameFromRef(sourceRef?: string | null): string {
  const withoutScheme = String(sourceRef || '').replace(/^[a-zA-Z][\w+.-]*:\/\//, '')
  const withoutQuery = withoutScheme.split(/[?#]/)[0]
  const segments = withoutQuery.split('/').filter(Boolean)
  return decodeURIComponent(segments[segments.length - 1] || '') || 'Original file'
}
