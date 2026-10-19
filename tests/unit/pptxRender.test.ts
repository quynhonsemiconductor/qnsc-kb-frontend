import { DOMParser as XmlDomParser } from '@xmldom/xmldom'
import JSZip from 'jszip'
import { beforeAll, describe, expect, it } from 'vitest'
import { renderPptxHtml, resolveTarget, type PptxLabels } from '../../src/utils/pptxRender'

const labels: PptxLabels = {
  notes: 'Notes',
  slide: (number, total) => `Slide ${number} / ${total}`,
  placeholder: kind => `[${kind}]`,
  truncatedSlides: (shown, total) => `Showing ${shown} of ${total}`,
}

const NS =
  'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
  'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
  'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"'
const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships'
const RELS_NS = 'http://schemas.openxmlformats.org/package/2006/relationships'

type Rel = [id: string, type: string, target: string]

function rels(entries: Rel[]): string {
  const body = entries.map(([id, type, target]) => `<Relationship Id="${id}" Type="${REL}/${type}" Target="${target}"/>`).join('')
  return `<?xml version="1.0"?><Relationships xmlns="${RELS_NS}">${body}</Relationships>`
}

function textBox(id: number, text: string, runProperties = '<a:rPr lang="en" sz="2400" b="1"/>'): string {
  return (
    `<p:sp><p:nvSpPr><p:cNvPr id="${id}" name="t${id}"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>` +
    '<p:spPr><a:xfrm><a:off x="914400" y="914400"/><a:ext cx="4572000" cy="914400"/></a:xfrm><a:prstGeom prst="rect"/></p:spPr>' +
    `<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r>${runProperties}<a:t>${text}</a:t></a:r></a:p></p:txBody></p:sp>`
  )
}

function slideXml(shapes: string): string {
  return (
    `<?xml version="1.0"?><p:sld ${NS}><p:cSld><p:spTree>` +
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/>' +
    `${shapes}</p:spTree></p:cSld></p:sld>`
  )
}

const THEME =
  `<?xml version="1.0"?><a:theme ${NS} name="t"><a:themeElements><a:clrScheme name="c">` +
  '<a:dk1><a:srgbClr val="000000"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1>' +
  '<a:dk2><a:srgbClr val="1F497D"/></a:dk2><a:lt2><a:srgbClr val="EEECE1"/></a:lt2>' +
  '<a:accent1><a:srgbClr val="4F81BD"/></a:accent1><a:accent2><a:srgbClr val="C0504D"/></a:accent2>' +
  '<a:accent3><a:srgbClr val="9BBB59"/></a:accent3><a:accent4><a:srgbClr val="8064A2"/></a:accent4>' +
  '<a:accent5><a:srgbClr val="4BACC6"/></a:accent5><a:accent6><a:srgbClr val="F79646"/></a:accent6>' +
  '<a:hlink><a:srgbClr val="0000FF"/></a:hlink><a:folHlink><a:srgbClr val="800080"/></a:folHlink></a:clrScheme>' +
  '<a:fontScheme name="f"><a:majorFont><a:latin typeface="Calibri"/></a:majorFont><a:minorFont><a:latin typeface="Calibri"/></a:minorFont></a:fontScheme>' +
  '</a:themeElements></a:theme>'

const MASTER =
  `<?xml version="1.0"?><p:sldMaster ${NS}><p:cSld><p:spTree>` +
  '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld>' +
  '<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" ' +
  'accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/></p:sldMaster>'

/** A minimal deck. Each slide is `[shapesXml, notesText?]`; `extraRels` go on the first slide. */
async function deckZip(slides: Array<[string, string?]>, extraRels: Rel[] = []): Promise<JSZip> {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>')
  // sldId carries BOTH a numeric id and the r:id; only the r:id names the slide part.
  const ids = slides.map((_, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`).join('')
  zip.file(
    'ppt/presentation.xml',
    `<?xml version="1.0"?><p:presentation ${NS}><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>` +
      `<p:sldIdLst>${ids}</p:sldIdLst><p:sldSz cx="9144000" cy="5143500"/></p:presentation>`,
  )
  zip.file(
    'ppt/_rels/presentation.xml.rels',
    rels([
      ['rId1', 'slideMaster', 'slideMasters/slideMaster1.xml'],
      ...slides.map((_, index): Rel => [`rId${index + 2}`, 'slide', `slides/slide${index + 1}.xml`]),
    ]),
  )
  zip.file('ppt/slideMasters/slideMaster1.xml', MASTER)
  zip.file('ppt/slideMasters/_rels/slideMaster1.xml.rels', rels([['rId1', 'theme', '../theme/theme1.xml']]))
  zip.file('ppt/theme/theme1.xml', THEME)
  zip.file(
    'ppt/slideLayouts/slideLayout1.xml',
    `<?xml version="1.0"?><p:sldLayout ${NS}><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr/></p:spTree></p:cSld></p:sldLayout>`,
  )
  zip.file('ppt/slideLayouts/_rels/slideLayout1.xml.rels', rels([['rId1', 'slideMaster', '../slideMasters/slideMaster1.xml']]))
  slides.forEach(([shapes, notes], index) => {
    const number = index + 1
    zip.file(`ppt/slides/slide${number}.xml`, slideXml(shapes))
    const slideRels: Rel[] = [['rId1', 'slideLayout', '../slideLayouts/slideLayout1.xml'], ...(index === 0 ? extraRels : [])]
    if (notes !== undefined) {
      slideRels.push(['rId9', 'notesSlide', `../notesSlides/notesSlide${number}.xml`])
      zip.file(
        `ppt/notesSlides/notesSlide${number}.xml`,
        slideXml(
          '<p:sp><p:nvSpPr><p:cNvPr id="2" name="n"/><p:cNvSpPr/><p:nvPr><p:ph type="body" idx="1"/></p:nvPr></p:nvSpPr><p:spPr/>' +
            `<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${notes}</a:t></a:r></a:p></p:txBody></p:sp>`,
        ),
      )
    }
    zip.file(`ppt/slides/_rels/slide${number}.xml.rels`, rels(slideRels))
  })
  return zip
}

const deck = async (slides: Array<[string, string?]>, extraRels: Rel[] = []): Promise<Blob> =>
  (await deckZip(slides, extraRels)).generateAsync({ type: 'blob' })

beforeAll(() => {
  // The renderer uses the browser's parser; these tests run in node.
  ;(globalThis as { DOMParser?: unknown }).DOMParser = XmlDomParser
})

describe('renderPptxHtml', () => {
  it('draws every slide, found through r:id rather than the numeric slide id', async () => {
    const html = await renderPptxHtml(await deck([[textBox(2, 'First')], [textBox(2, 'Second')], [textBox(2, 'Third')]]), labels)
    expect(html).toContain('First')
    expect(html).toContain('Second')
    expect(html).toContain('Third')
    expect(html).toContain('Slide 1 / 3')
    expect(html).toContain('Slide 3 / 3')
  })

  it('keeps Vietnamese text intact', async () => {
    const html = await renderPptxHtml(await deck([[textBox(2, 'Quy trình xin nghỉ phép — Nguyễn Văn Ánh')]]), labels)
    expect(html).toContain('Quy trình xin nghỉ phép — Nguyễn Văn Ánh')
  })

  it('shows speaker notes under their slide', async () => {
    const html = await renderPptxHtml(await deck([[textBox(2, 'Body'), 'Remember the deadline']]), labels)
    expect(html).toContain('Notes')
    expect(html).toContain('Remember the deadline')
  })

  it('escapes text so markup in a slide stays text', async () => {
    const hostile = '&lt;script&gt;alert(1)&lt;/script&gt;&lt;img src=x onerror=alert(2)&gt;'
    const html = await renderPptxHtml(await deck([[textBox(2, hostile)]]), labels)
    expect(html).not.toMatch(/<script>alert/)
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;script&gt;')
  })

  it('never turns a javascript: hyperlink into a link', async () => {
    const link = '<a:rPr><a:hlinkClick r:id="rId7"/></a:rPr>'
    const zip = await deckZip([[textBox(2, 'click', link)]])
    zip.file(
      'ppt/slides/_rels/slide1.xml.rels',
      `<Relationships xmlns="${RELS_NS}"><Relationship Id="rId7" Type="${REL}/hyperlink" Target="javascript:alert(1)" TargetMode="External"/></Relationships>`,
    )
    const html = await renderPptxHtml(await zip.generateAsync({ type: 'blob' }), labels)
    expect(html).not.toMatch(/javascript:/i)
    expect(html).not.toMatch(/<a[\s>]/i)
  })

  it('puts a labelled box where a chart was', async () => {
    const frame =
      '<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="3" name="c"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>' +
      '<p:xfrm><a:off x="0" y="0"/><a:ext cx="3000000" cy="2000000"/></p:xfrm><a:graphic>' +
      '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart">' +
      '<c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" r:id="rId8"/></a:graphicData></a:graphic></p:graphicFrame>'
    const html = await renderPptxHtml(await deck([[frame]]), labels)
    expect(html).toContain('[chart]')
  })

  it('draws a table', async () => {
    const cell = (text: string) =>
      `<a:tc><a:txBody><a:bodyPr/><a:lstStyle/><a:p><a:r><a:t>${text}</a:t></a:r></a:p></a:txBody><a:tcPr/></a:tc>`
    const table =
      '<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="3" name="tb"/><p:cNvGraphicFramePr/><p:nvPr/></p:nvGraphicFramePr>' +
      '<p:xfrm><a:off x="0" y="0"/><a:ext cx="4000000" cy="1000000"/></p:xfrm><a:graphic>' +
      '<a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl>' +
      '<a:tblGrid><a:gridCol w="2000000"/><a:gridCol w="2000000"/></a:tblGrid>' +
      `<a:tr h="500000">${cell('Leave')}${cell('Days')}</a:tr><a:tr h="500000">${cell('Annual')}${cell('12')}</a:tr>` +
      '</a:tbl></a:graphicData></a:graphic></p:graphicFrame>'
    const html = await renderPptxHtml(await deck([[table]]), labels)
    expect(html).toContain('<table')
    for (const text of ['Leave', 'Days', 'Annual', '12']) expect(html).toContain(text)
  })

  it('resolves a theme colour for a shape fill', async () => {
    const shape =
      '<p:sp><p:nvSpPr><p:cNvPr id="4" name="s"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr><p:spPr>' +
      '<a:xfrm><a:off x="0" y="0"/><a:ext cx="1000000" cy="1000000"/></a:xfrm><a:prstGeom prst="rect"/>' +
      '<a:solidFill><a:schemeClr val="accent2"/></a:solidFill></p:spPr></p:sp>'
    const html = await renderPptxHtml(await deck([[shape]]), labels)
    expect(html.toLowerCase()).toContain('#c0504d')
  })

  it('refuses a package with no slides or no presentation part', async () => {
    await expect(renderPptxHtml(await deck([]), labels)).rejects.toThrow()
    const empty = new JSZip()
    empty.file('hello.txt', 'x')
    await expect(renderPptxHtml(await empty.generateAsync({ type: 'blob' }), labels)).rejects.toThrow()
  })
})

describe('resolveTarget', () => {
  it('resolves relative and absolute relationship targets against the part', () => {
    expect(resolveTarget('ppt/slides/slide1.xml', '../media/a.png')).toBe('ppt/media/a.png')
    expect(resolveTarget('ppt/slides/slide1.xml', 'slide2.xml')).toBe('ppt/slides/slide2.xml')
    expect(resolveTarget('ppt/slides/slide1.xml', '/ppt/media/a.png')).toBe('ppt/media/a.png')
  })
})
