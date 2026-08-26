export const formatDate = (d: string) => d;

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
