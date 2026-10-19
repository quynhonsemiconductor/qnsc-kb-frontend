import { describe, expect, it } from 'vitest'
import { MAX_TIFF_PAGES, imagesDocument } from '../../src/utils/imageRender'

const PNG = 'data:image/png;base64,iVBORw0KGgo='

describe('imagesDocument', () => {
  it('draws each picture with its caption', () => {
    const html = imagesDocument([{ src: PNG, caption: 'Page 1 / 2' }, { src: PNG, caption: 'Page 2 / 2' }])
    expect(html.match(/<img /g)).toHaveLength(2)
    expect(html).toContain('Page 1 / 2')
  })

  it('accepts only our own data: images as a source', () => {
    const hostile = [
      'javascript:alert(1)',
      'https://evil.example/x.png',
      'data:text/html;base64,PHNjcmlwdD4=',
      'data:image/svg+xml;base64,PHN2Zz4=',
      'data:image/png;base64,AAA" onerror="alert(1)',
    ]
    for (const src of hostile) {
      const html = imagesDocument([{ src, caption: 'p' }])
      expect(html).not.toContain('<img')
      expect(html).not.toContain(src)
    }
  })

  it('shows the caption in place of a page that could not be decoded', () => {
    const html = imagesDocument([{ src: null, caption: 'Page 2 could not be read' }])
    expect(html).not.toContain('<img')
    expect(html).toContain('Page 2 could not be read')
  })

  it('escapes captions and the trailing note', () => {
    const html = imagesDocument([{ src: PNG, caption: '<b>x</b>' }], '<i>cut</i>')
    expect(html).not.toContain('<b>x</b>')
    expect(html).not.toContain('<i>cut</i>')
    expect(html).toContain('&lt;i&gt;cut&lt;/i&gt;')
  })

  it('carries the preview CSP', () => {
    expect(imagesDocument([])).toContain('Content-Security-Policy')
  })

  it('caps TIFF pages at a sane number', () => {
    expect(MAX_TIFF_PAGES).toBeGreaterThan(0)
    expect(MAX_TIFF_PAGES).toBeLessThanOrEqual(200)
  })
})
