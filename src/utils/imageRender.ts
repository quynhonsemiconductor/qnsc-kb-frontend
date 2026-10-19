import { escapeHtml, previewDocument, toBase64 } from './officePreview'

/**
 * BMP and TIFF pictures drawn for the review pane.
 *
 * Browsers show BMP but the API serves it as a download, and none of them show TIFF at all
 * (a scanned multi-page TIFF is exactly what an upload of a paper document tends to be). Both
 * are turned into `data:` images inside the same sandboxed document the Word and Excel
 * previews use, so nothing here can run.
 */

export interface ImageLabels {
  page(number: number, total: number): string
  truncatedPages(shown: number, total: number): string
  unreadablePage(number: number): string
}

/** Pages drawn from one TIFF. A scan of a long document can have hundreds. */
export const MAX_TIFF_PAGES = 50
/** Decoded size cap per page (RGBA, four bytes a pixel): about 144 MB at the limit. */
const MAX_PIXELS = 36_000_000
/** Pages are drawn no wider than this; a scan at print resolution is far wider than any pane. */
const MAX_DISPLAY_WIDTH = 1800

export interface ImageEntry {
  /** A `data:` URL, or null for a page that could not be decoded. */
  src: string | null
  caption: string
}

const IMAGE_CSS = `
body{background:#e5e7eb;padding:12px}
figure{margin:0 auto 16px;max-width:1100px;background:#fff;box-shadow:0 1px 5px rgba(0,0,0,.3)}
figcaption{padding:4px 10px;font:12px system-ui,sans-serif;color:#6b7280;border-bottom:1px solid #e5e7eb}
img{display:block;max-width:100%;height:auto;margin:0 auto}
.bad{padding:18px;font:13px system-ui,sans-serif;color:#92400e;background:#fffbeb}
.cap{margin:0 auto 14px;max-width:1100px;padding:6px 12px;background:#fffbeb;border:1px solid #fde68a;font:12px system-ui,sans-serif;color:#92400e}
`

/** The preview document for a list of pictures. Captions are escaped; sources are only ever our own `data:` URLs. */
export function imagesDocument(images: ImageEntry[], note = ''): string {
  const figures = images
    .map(({ src, caption }) => {
      const label = caption ? `<figcaption>${escapeHtml(caption)}</figcaption>` : ''
      const picture = src && /^data:image\/(png|jpeg|bmp);base64,[A-Za-z0-9+/=]+$/.test(src)
        ? `<img src="${src}" alt="">`
        : `<p class="bad">${escapeHtml(caption)}</p>`
      return `<figure>${label}${picture}</figure>`
    })
    .join('')
  return previewDocument(figures + (note ? `<p class="cap">${escapeHtml(note)}</p>` : ''), IMAGE_CSS)
}

type TiffLibrary = {
  decode(buffer: ArrayBuffer): Array<{ width: number; height: number }>
  decodeImage(buffer: ArrayBuffer, ifd: unknown): void
  toRGBA8(ifd: unknown): Uint8Array
}

async function tiffPage(library: TiffLibrary, buffer: ArrayBuffer, ifd: { width: number; height: number }): Promise<string | null> {
  try {
    library.decodeImage(buffer, ifd)
    const { width, height } = ifd
    if (!width || !height || width * height > MAX_PIXELS) return null
    const rgba = library.toRGBA8(ifd)
    const full = document.createElement('canvas')
    full.width = width
    full.height = height
    const context = full.getContext('2d')
    if (!context) return null
    // utif2 allocates a plain ArrayBuffer; the cast only tells the compiler so, and avoids copying a page that may be 144 MB.
    const pixels = new Uint8ClampedArray(rgba.buffer as ArrayBuffer, rgba.byteOffset, width * height * 4)
    context.putImageData(new ImageData(pixels, width, height), 0, 0)
    const scale = Math.min(1, MAX_DISPLAY_WIDTH / width)
    const out = document.createElement('canvas')
    out.width = Math.max(1, Math.round(width * scale))
    out.height = Math.max(1, Math.round(height * scale))
    const target = out.getContext('2d')
    if (!target) return null
    // JPEG has no transparency, so the page goes onto white, which is what a scan is.
    target.fillStyle = '#ffffff'
    target.fillRect(0, 0, out.width, out.height)
    target.drawImage(full, 0, 0, out.width, out.height)
    return out.toDataURL('image/jpeg', 0.88)
  } catch {
    return null
  }
}

/** A BMP or TIFF as a preview document. Throws for a file that is not a readable picture, so the pane can offer the download. */
export async function renderBitmapHtml(blob: Blob, kind: 'bmp' | 'tiff', labels: ImageLabels): Promise<string> {
  const buffer = await blob.arrayBuffer()
  if (kind === 'bmp') {
    return imagesDocument([{ src: `data:image/bmp;base64,${toBase64(new Uint8Array(buffer))}`, caption: '' }])
  }

  const module = await import('utif2')
  const library = ((module as unknown as { default?: TiffLibrary }).default ?? (module as unknown as TiffLibrary))
  const pages = library.decode(buffer)
  if (pages.length === 0) throw new Error('no pages')
  const shown = pages.slice(0, MAX_TIFF_PAGES)
  const entries: ImageEntry[] = []
  for (let index = 0; index < shown.length; index += 1) {
    const src = await tiffPage(library, buffer, shown[index])
    const caption = src ? (pages.length > 1 ? labels.page(index + 1, pages.length) : '') : labels.unreadablePage(index + 1)
    entries.push({ src, caption })
  }
  if (entries.every(entry => entry.src === null)) throw new Error('unreadable')
  return imagesDocument(entries, pages.length > shown.length ? labels.truncatedPages(shown.length, pages.length) : '')
}
