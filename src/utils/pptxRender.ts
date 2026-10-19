import JSZip from 'jszip'
import { escapeHtml, previewDocument, toBase64 } from './officePreview'

/**
 * A PowerPoint file drawn as HTML, for the review pane.
 *
 * Written here rather than taken from a library because the one browser renderer available
 * is closed-source, a year unmaintained and pulls in a charting library, and this renders
 * untrusted uploads. Everything it emits is built from escaped text and from numbers that
 * were parsed and checked, never from a string in the file, and the result is only ever shown
 * in a sandboxed `<iframe>`.
 *
 * WHAT IT DRAWS. Each slide at its own aspect ratio, scaled to the width of the pane with no
 * script: positions are percentages of the slide and every size is in `cqw`, a percentage of
 * the slide's width. Text boxes, with the sizes, weights, colours, alignment and bullets that
 * PowerPoint resolves through slide → layout → master → theme; rectangles, rounded
 * rectangles, ellipses, triangles, diamonds and lines; pictures with their crop, rotation and
 * flip; tables; groups; slide backgrounds; and the speaker notes under each slide.
 *
 * WHAT IT DOES NOT. Charts, SmartArt, embedded objects and video are not drawn: each is
 * replaced by a labelled box so the reviewer knows something is there. Gradients become their
 * first colour, custom geometry becomes a rectangle, animations and transitions are ignored.
 * It is a reading view of the content, not PowerPoint.
 */

export interface PptxLabels {
  /** Heading of the speaker-notes block under a slide. */
  notes: string
  slide(number: number, total: number): string
  /** Box standing in for something that is not drawn. */
  placeholder(kind: 'chart' | 'diagram' | 'object' | 'picture'): string
  truncatedSlides(shown: number, total: number): string
}

const ELEMENT_NODE = 1
const EMU_PER_PT = 12700
const MAX_SLIDES = 200
const MAX_SHAPES_PER_SLIDE = 3000
/** A single package part larger than this is skipped: a zip can claim far more than it holds. */
const MAX_PART_BYTES = 30 * 1024 * 1024
/** All embedded pictures together, so one slide deck cannot build a document the tab cannot hold. */
const MAX_TOTAL_MEDIA_BYTES = 40 * 1024 * 1024

// ── a small DOM toolkit that depends on nothing but the core DOM ──────────────────────────────
// Names are matched by `localName` and never by prefix, because a file may bind the
// presentation namespaces to any prefix it likes.

type El = Element

function kids(node: El | null | undefined, name?: string): El[] {
  const out: El[] = []
  if (!node) return out
  for (let child = node.firstChild; child; child = child.nextSibling) {
    if (child.nodeType === ELEMENT_NODE && (!name || (child as El).localName === name)) out.push(child as El)
  }
  return out
}

const kid = (node: El | null | undefined, name: string): El | null => kids(node, name)[0] ?? null

function walk(node: El | null | undefined, ...names: string[]): El | null {
  let current: El | null = node ?? null
  for (const name of names) current = current ? kid(current, name) : null
  return current
}

function attr(node: El | null | undefined, name: string): string | null {
  if (!node || !node.attributes) return null
  for (let index = 0; index < node.attributes.length; index += 1) {
    const candidate = node.attributes[index]
    if (candidate.localName === name || candidate.name === name) return candidate.value
  }
  return null
}

/** The r:id of an element. A bare `id` is a different thing (sldId carries both). */
function relId(node: El | null | undefined): string | null {
  if (!node || !node.attributes) return null
  for (let index = 0; index < node.attributes.length; index += 1) {
    const candidate = node.attributes[index]
    if (candidate.localName === 'id' && candidate.prefix === 'r') return candidate.value
  }
  return null
}

function num(value: string | null | undefined, fallback = 0): number {
  if (value === null || value === undefined || value === '') return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

function descendants(node: El | null | undefined, name: string, into: El[] = []): El[] {
  for (const child of kids(node)) {
    if (child.localName === name) into.push(child)
    descendants(child, name, into)
  }
  return into
}

// ── the package ────────────────────────────────────────────────────────────────────────────────

function dirname(part: string): string {
  const slash = part.lastIndexOf('/')
  return slash < 0 ? '' : part.slice(0, slash)
}

function basename(part: string): string {
  return part.slice(part.lastIndexOf('/') + 1)
}

/** A relationship target as a path inside the zip, relative to the part that names it. */
export function resolveTarget(fromPart: string, target: string): string {
  if (target.startsWith('/')) return target.slice(1)
  const parts = dirname(fromPart).split('/').filter(Boolean)
  for (const segment of target.split('/')) {
    if (segment === '..') parts.pop()
    else if (segment !== '.' && segment !== '') parts.push(segment)
  }
  return parts.join('/')
}

interface Relationship {
  type: string
  target: string
  external: boolean
}

function parseXml(text: string): El | null {
  const document = new DOMParser().parseFromString(text, 'application/xml')
  if (document.getElementsByTagName('parsererror').length) return null
  return document.documentElement
}

class Package {
  private cache = new Map<string, El | null>()
  private relsCache = new Map<string, Map<string, Relationship>>()
  mediaBytes = 0

  constructor(private zip: JSZip) {}

  private entry(path: string) {
    const file = this.zip.file(path)
    if (!file) return null
    const declared = (file as unknown as { _data?: { uncompressedSize?: number } })._data?.uncompressedSize
    return declared !== undefined && declared > MAX_PART_BYTES ? null : file
  }

  async xml(path: string): Promise<El | null> {
    if (this.cache.has(path)) return this.cache.get(path) ?? null
    const file = this.entry(path)
    const root = file ? parseXml(await file.async('string')) : null
    this.cache.set(path, root)
    return root
  }

  async bytes(path: string): Promise<Uint8Array | null> {
    const file = this.entry(path)
    return file ? file.async('uint8array') : null
  }

  async rels(part: string): Promise<Map<string, Relationship>> {
    const cached = this.relsCache.get(part)
    if (cached) return cached
    const map = new Map<string, Relationship>()
    const root = await this.xml(`${dirname(part)}/_rels/${basename(part)}.rels`.replace(/^\//, ''))
    for (const rel of kids(root, 'Relationship')) {
      const id = attr(rel, 'Id')
      const target = attr(rel, 'Target')
      if (!id || !target) continue
      map.set(id, {
        type: attr(rel, 'Type') ?? '',
        target: attr(rel, 'TargetMode') === 'External' ? target : resolveTarget(part, target),
        external: attr(rel, 'TargetMode') === 'External',
      })
    }
    this.relsCache.set(part, map)
    return map
  }
}

// ── colour ─────────────────────────────────────────────────────────────────────────────────────

const HEX = /^[0-9a-fA-F]{6}$/

const PRESET_COLORS: Record<string, string> = {
  black: '000000', white: 'ffffff', red: 'ff0000', green: '008000', blue: '0000ff', yellow: 'ffff00',
  gray: '808080', grey: '808080', orange: 'ffa500', purple: '800080', cyan: '00ffff', magenta: 'ff00ff',
  darkBlue: '00008b', darkRed: '8b0000', darkGreen: '006400', lightGray: 'd3d3d3', lightGrey: 'd3d3d3',
}

interface ColorContext {
  theme: Record<string, string>
  clrMap: Record<string, string>
}

type Rgb = [number, number, number]

const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value))

function hexToRgb(hex: string): Rgb {
  return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)]
}

function rgbToHsl([r, g, b]: Rgb): [number, number, number] {
  const red = r / 255, green = g / 255, blue = b / 255
  const max = Math.max(red, green, blue), min = Math.min(red, green, blue)
  const lightness = (max + min) / 2
  if (max === min) return [0, 0, lightness]
  const delta = max - min
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min)
  let hue = max === red ? (green - blue) / delta + (green < blue ? 6 : 0) : max === green ? (blue - red) / delta + 2 : (red - green) / delta + 4
  hue /= 6
  return [hue, saturation, lightness]
}

function hslToRgb([h, s, l]: [number, number, number]): Rgb {
  if (s === 0) return [l * 255, l * 255, l * 255]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = (t: number) => {
    const x = (t + 1) % 1
    if (x < 1 / 6) return p + (q - p) * 6 * x
    if (x < 1 / 2) return q
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6
    return p
  }
  return [channel(h + 1 / 3) * 255, channel(h) * 255, channel(h - 1 / 3) * 255]
}

function baseColor(node: El, context: ColorContext): string | null {
  switch (node.localName) {
    case 'srgbClr': {
      const value = attr(node, 'val') ?? ''
      return HEX.test(value) ? value : null
    }
    case 'sysClr': {
      const last = attr(node, 'lastClr') ?? ''
      if (HEX.test(last)) return last
      return attr(node, 'val') === 'windowText' ? '000000' : attr(node, 'val') === 'window' ? 'ffffff' : null
    }
    case 'schemeClr': {
      const value = attr(node, 'val') ?? ''
      return context.theme[context.clrMap[value] ?? value] ?? null
    }
    case 'prstClr':
      return PRESET_COLORS[attr(node, 'val') ?? ''] ?? null
    default:
      return null
  }
}

/** The CSS colour a colour element describes, with its lumMod / lumOff / tint / shade / alpha applied in order. */
function resolveColorElement(node: El, context: ColorContext): string | null {
  const hex = baseColor(node, context)
  if (!hex) return null
  let rgb: Rgb = hexToRgb(hex)
  let alpha = 1
  for (const modifier of kids(node)) {
    const amount = num(attr(modifier, 'val'), 100000) / 100000
    switch (modifier.localName) {
      case 'lumMod': { const [h, s, l] = rgbToHsl(rgb); rgb = hslToRgb([h, s, clamp(l * amount)]); break }
      case 'lumOff': { const [h, s, l] = rgbToHsl(rgb); rgb = hslToRgb([h, s, clamp(l + amount)]); break }
      case 'satMod': { const [h, s, l] = rgbToHsl(rgb); rgb = hslToRgb([h, clamp(s * amount), l]); break }
      case 'tint': rgb = rgb.map(value => value * amount + 255 * (1 - amount)) as Rgb; break
      case 'shade': rgb = rgb.map(value => value * amount) as Rgb; break
      case 'alpha': alpha = clamp(amount); break
      default: break
    }
  }
  const [r, g, b] = rgb.map(value => Math.round(clamp(value, 0, 255)))
  return alpha < 1 ? `rgba(${r},${g},${b},${alpha.toFixed(3)})` : `#${[r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')}`
}

/** The colour held by a fill-like element (solidFill, a style reference, ...), or null. */
function colorIn(holder: El | null | undefined, context: ColorContext): string | null {
  for (const candidate of kids(holder)) {
    const color = resolveColorElement(candidate, context)
    if (color) return color
  }
  return null
}

// ── geometry ───────────────────────────────────────────────────────────────────────────────────

interface Frame {
  x: number
  y: number
  cx: number
  cy: number
  rot: number
  flipH: boolean
  flipV: boolean
}

/** Maps a shape's own coordinates to slide coordinates: the identity at the top level, and a translate + scale inside a group. */
interface GroupMap {
  originX: number
  originY: number
  childOriginX: number
  childOriginY: number
  scaleX: number
  scaleY: number
}

const IDENTITY: GroupMap = { originX: 0, originY: 0, childOriginX: 0, childOriginY: 0, scaleX: 1, scaleY: 1 }

function readFrame(xfrm: El | null | undefined): Frame | null {
  const off = kid(xfrm, 'off')
  const ext = kid(xfrm, 'ext')
  if (!xfrm || !off || !ext) return null
  return {
    x: num(attr(off, 'x')),
    y: num(attr(off, 'y')),
    cx: num(attr(ext, 'cx')),
    cy: num(attr(ext, 'cy')),
    rot: num(attr(xfrm, 'rot')) / 60000,
    flipH: attr(xfrm, 'flipH') === '1' || attr(xfrm, 'flipH') === 'true',
    flipV: attr(xfrm, 'flipV') === '1' || attr(xfrm, 'flipV') === 'true',
  }
}

function mapFrame(frame: Frame, map: GroupMap): Frame {
  return {
    ...frame,
    x: map.originX + (frame.x - map.childOriginX) * map.scaleX,
    y: map.originY + (frame.y - map.childOriginY) * map.scaleY,
    cx: frame.cx * map.scaleX,
    cy: frame.cy * map.scaleY,
  }
}

// ── the part chain behind one slide ────────────────────────────────────────────────────────────

interface SlideScope {
  slideCx: number
  slideCy: number
  color: ColorContext
  /** Presentation-wide default text style, and the master's three text styles. */
  defaultTextStyle: El | null
  titleStyle: El | null
  bodyStyle: El | null
  otherStyle: El | null
  layoutTree: El | null
  masterTree: El | null
  rels: Map<string, Relationship>
  slidePart: string
  pkg: Package
  media: { bytes: number }
  shapeCount: number
}

interface Placeholder {
  type: string
  index: string | null
}

function placeholderOf(shape: El): Placeholder | null {
  const nv = kid(shape, 'nvSpPr') ?? kid(shape, 'nvPicPr') ?? kid(shape, 'nvGraphicFramePr')
  const ph = walk(nv, 'nvPr', 'ph')
  if (!ph) return null
  const index = attr(ph, 'idx')
  const type = attr(ph, 'type') ?? (index !== null ? 'obj' : 'body')
  return { type, index }
}

const TITLE_TYPES = new Set(['title', 'ctrTitle'])

function sameKind(a: string, b: string): boolean {
  if (a === b) return true
  if (TITLE_TYPES.has(a) && TITLE_TYPES.has(b)) return true
  const bodyLike = (value: string) => value === 'body' || value === 'subTitle' || value === 'obj'
  return bodyLike(a) && bodyLike(b)
}

function findPlaceholder(tree: El | null, wanted: Placeholder): El | null {
  const shapes = kids(tree).filter(node => ['sp', 'pic', 'graphicFrame'].includes(node.localName))
  if (wanted.index !== null) {
    const byIndex = shapes.find(shape => placeholderOf(shape)?.index === wanted.index)
    if (byIndex) return byIndex
  }
  return shapes.find(shape => {
    const candidate = placeholderOf(shape)
    return candidate !== null && sameKind(candidate.type, wanted.type)
  }) ?? null
}

function shapeTree(root: El | null): El | null {
  return walk(root, 'cSld', 'spTree')
}

// ── text ───────────────────────────────────────────────────────────────────────────────────────

interface RunStyle {
  size: number | null
  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  color: string | null
}

interface ParagraphStyle {
  align: string | null
  marginLeft: number
  indent: number
  bulletChar: string | null
  bulletNumber: string | null
  bulletNone: boolean
  spaceBefore: number
  spaceAfter: number
  lineSpacing: number | null
}

const bool = (value: string | null): boolean => value === '1' || value === 'true'

const WINGDINGS: Record<string, string> = { '§': '▪', 'Ø': '➢', 'ü': '✓', 'v': '❖', 'q': '❑', 'l': '●', 'n': '■', 'u': '◆', 'w': '◇', '': '•' }

/** Lowest to highest priority: every list-style container that can say something about level `level`. */
function levelNodes(containers: Array<El | null>, level: number): El[] {
  return containers.map(container => kid(container, `lvl${level}pPr`)).filter((node): node is El => node !== null)
}

function mergeParagraphStyle(nodes: El[]): ParagraphStyle {
  const style: ParagraphStyle = {
    align: null, marginLeft: 0, indent: 0, bulletChar: null, bulletNumber: null, bulletNone: false,
    spaceBefore: 0, spaceAfter: 0, lineSpacing: null,
  }
  for (const node of nodes) {
    const align = attr(node, 'algn')
    if (align) style.align = align
    if (attr(node, 'marL') !== null) style.marginLeft = num(attr(node, 'marL'))
    if (attr(node, 'indent') !== null) style.indent = num(attr(node, 'indent'))
    if (kid(node, 'buNone')) { style.bulletNone = true; style.bulletChar = null; style.bulletNumber = null }
    const char = kid(node, 'buChar')
    if (char) {
      const font = attr(kid(node, 'buFont'), 'typeface') ?? ''
      const raw = attr(char, 'char') ?? '•'
      style.bulletChar = /wingdings|symbol/i.test(font) ? (WINGDINGS[raw] ?? '•') : raw
      style.bulletNone = false
      style.bulletNumber = null
    }
    const auto = kid(node, 'buAutoNum')
    if (auto) { style.bulletNumber = attr(auto, 'type') ?? 'arabicPeriod'; style.bulletNone = false; style.bulletChar = null }
    const before = walk(node, 'spcBef', 'spcPts')
    if (before) style.spaceBefore = num(attr(before, 'val')) / 100 * EMU_PER_PT
    const after = walk(node, 'spcAft', 'spcPts')
    if (after) style.spaceAfter = num(attr(after, 'val')) / 100 * EMU_PER_PT
    const line = walk(node, 'lnSpc', 'spcPct')
    if (line) style.lineSpacing = num(attr(line, 'val'), 100000) / 100000
  }
  return style
}

function mergeRunStyle(nodes: Array<El | null>, scope: SlideScope): RunStyle {
  const style: RunStyle = { size: null, bold: false, italic: false, underline: false, strike: false, color: null }
  for (const node of nodes) {
    if (!node) continue
    if (attr(node, 'sz') !== null) style.size = num(attr(node, 'sz')) / 100
    if (attr(node, 'b') !== null) style.bold = bool(attr(node, 'b'))
    if (attr(node, 'i') !== null) style.italic = bool(attr(node, 'i'))
    const underline = attr(node, 'u')
    if (underline !== null) style.underline = underline !== 'none'
    const strike = attr(node, 'strike')
    if (strike !== null) style.strike = strike !== 'noStrike'
    const color = colorIn(kid(node, 'solidFill'), scope.color)
    if (color) style.color = color
  }
  return style
}

function autoNumber(kind: string, value: number): string {
  const alpha = (n: number, upper: boolean) => {
    let result = ''
    let rest = n
    while (rest > 0) { rest -= 1; result = String.fromCharCode(97 + (rest % 26)) + result; rest = Math.floor(rest / 26) }
    return upper ? result.toUpperCase() : result
  }
  const roman = (n: number, upper: boolean) => {
    const table: Array<[number, string]> = [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']]
    let result = ''
    let rest = Math.min(n, 3999)
    for (const [amount, symbol] of table) while (rest >= amount) { result += symbol; rest -= amount }
    return upper ? result.toUpperCase() : result
  }
  const suffix = kind.endsWith('ParenBoth') ? ')' : kind.endsWith('ParenR') ? ')' : kind.endsWith('Period') ? '.' : '.'
  const prefix = kind.endsWith('ParenBoth') ? '(' : ''
  if (kind.startsWith('alphaLc')) return `${prefix}${alpha(value, false)}${suffix}`
  if (kind.startsWith('alphaUc')) return `${prefix}${alpha(value, true)}${suffix}`
  if (kind.startsWith('romanLc')) return `${prefix}${roman(value, false)}${suffix}`
  if (kind.startsWith('romanUc')) return `${prefix}${roman(value, true)}${suffix}`
  return `${prefix}${value}${suffix}`
}

interface TextEnvironment {
  /** Which of the master's text styles applies, by placeholder kind. */
  base: El | null
  masterPlaceholder: El | null
  layoutPlaceholder: El | null
  /** `a:fontRef` colour of a shape's style, for text that names no colour of its own. */
  fontColor: string | null
}

function cqw(emu: number, scope: SlideScope): string {
  return `${((emu / scope.slideCx) * 100).toFixed(4)}cqw`
}

function renderParagraphs(
  txBody: El,
  environment: TextEnvironment,
  scope: SlideScope,
  fontScale: number,
): string {
  const shapeList = kid(txBody, 'lstStyle')
  const containers = (): Array<El | null> => [
    scope.defaultTextStyle,
    environment.base,
    kid(environment.masterPlaceholder, 'txBody') ? kid(kid(environment.masterPlaceholder, 'txBody'), 'lstStyle') : null,
    kid(environment.layoutPlaceholder, 'txBody') ? kid(kid(environment.layoutPlaceholder, 'txBody'), 'lstStyle') : null,
    shapeList,
  ]
  const counters = new Map<number, number>()
  const html: string[] = []

  for (const paragraph of kids(txBody, 'p')) {
    const properties = kid(paragraph, 'pPr')
    const level = Math.min(9, Math.max(1, num(attr(properties, 'lvl')) + 1))
    const levels = levelNodes(containers(), level)
    if (properties) levels.push(properties)
    const style = mergeParagraphStyle(levels)

    // A paragraph's bullet counter restarts when a shallower level interrupts it.
    for (const key of [...counters.keys()]) if (key > level) counters.delete(key)
    let marker = ''
    if (!style.bulletNone && style.bulletChar) marker = style.bulletChar
    else if (!style.bulletNone && style.bulletNumber) {
      const next = (counters.get(level) ?? 0) + 1
      counters.set(level, next)
      marker = autoNumber(style.bulletNumber, next)
    } else counters.delete(level)

    const defaults = levelNodes(containers(), level).map(node => kid(node, 'defRPr'))
    const paragraphEnd = kid(paragraph, 'endParaRPr')
    let largest = 0
    const runs: string[] = []

    for (const child of kids(paragraph)) {
      if (child.localName === 'br') { runs.push('<br>'); continue }
      if (child.localName !== 'r' && child.localName !== 'fld') continue
      const textNode = kid(child, 't')
      const text = textNode?.textContent ?? ''
      if (!text) continue
      const run = mergeRunStyle([...defaults, kid(properties, 'defRPr'), kid(child, 'rPr')], scope)
      const points = (run.size ?? 18) * fontScale
      largest = Math.max(largest, points)
      const css: string[] = [`font-size:${cqw(points * EMU_PER_PT, scope)}`]
      if (run.bold) css.push('font-weight:700')
      if (run.italic) css.push('font-style:italic')
      const decorations = [run.underline ? 'underline' : '', run.strike ? 'line-through' : ''].filter(Boolean)
      if (decorations.length) css.push(`text-decoration:${decorations.join(' ')}`)
      // A shape's own style (fontRef) outranks the deck-wide defaults, but not a colour the run names.
      const color = (environment.fontColor ? mergeRunStyle([kid(child, 'rPr')], scope).color : null) ?? environment.fontColor ?? run.color
      if (color) css.push(`color:${color}`)
      runs.push(`<span style="${css.join(';')}">${escapeHtml(text)}</span>`)
    }

    const endSize = mergeRunStyle([...defaults, paragraphEnd], scope).size
    const lineBasis = (largest || (endSize ?? 18) * fontScale)
    const css: string[] = []
    const align = style.align === 'ctr' ? 'center' : style.align === 'r' ? 'right' : style.align === 'just' ? 'justify' : 'left'
    css.push(`text-align:${align}`)
    css.push(`margin-left:${cqw(Math.max(0, style.marginLeft), scope)}`)
    if (style.indent) css.push(`text-indent:${cqw(style.indent, scope)}`)
    if (style.spaceBefore) css.push(`margin-top:${cqw(style.spaceBefore * fontScale, scope)}`)
    if (style.spaceAfter) css.push(`margin-bottom:${cqw(style.spaceAfter * fontScale, scope)}`)
    css.push(`line-height:${((style.lineSpacing ?? 1) * 1.2).toFixed(3)}`)
    // An empty paragraph still takes its line, as in PowerPoint.
    const content = runs.join('') || `<span style="font-size:${cqw(lineBasis * EMU_PER_PT, scope)}">&nbsp;</span>`
    const bullet = marker ? `<span class="bu">${escapeHtml(marker)}&nbsp;</span>` : ''
    html.push(`<p style="${css.join(';')}">${bullet}${content}</p>`)
  }
  return html.join('')
}

// ── shapes ─────────────────────────────────────────────────────────────────────────────────────

const MIME_BY_EXTENSION: Record<string, string> = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml',
}

async function pictureData(scope: SlideScope, relationshipId: string | null): Promise<string | null> {
  const rel = relationshipId ? scope.rels.get(relationshipId) : undefined
  if (!rel || rel.external) return null
  const mime = MIME_BY_EXTENSION[rel.target.slice(rel.target.lastIndexOf('.') + 1).toLowerCase()]
  if (!mime) return null
  const bytes = await scope.pkg.bytes(rel.target)
  if (!bytes || scope.media.bytes + bytes.length > MAX_TOTAL_MEDIA_BYTES) return null
  scope.media.bytes += bytes.length
  return `data:${mime};base64,${toBase64(bytes)}`
}

function framePosition(frame: Frame, scope: SlideScope): string {
  const pct = (value: number, total: number) => `${((value / total) * 100).toFixed(4)}%`
  const css = [
    `left:${pct(frame.x, scope.slideCx)}`,
    `top:${pct(frame.y, scope.slideCy)}`,
    `width:${pct(frame.cx, scope.slideCx)}`,
    `height:${pct(frame.cy, scope.slideCy)}`,
  ]
  const transforms: string[] = []
  if (frame.rot) transforms.push(`rotate(${frame.rot.toFixed(3)}deg)`)
  if (frame.flipH || frame.flipV) transforms.push(`scale(${frame.flipH ? -1 : 1},${frame.flipV ? -1 : 1})`)
  if (transforms.length) css.push(`transform:${transforms.join(' ')}`)
  return css.join(';')
}

interface ShapeStyleResult {
  fill: string | null
  line: string | null
  lineWidth: number
  dash: string | null
  fontColor: string | null
}

function resolveShapeStyle(shape: El, scope: SlideScope): ShapeStyleResult {
  const properties = kid(shape, 'spPr')
  const style = kid(shape, 'style')
  let fill: string | null = null
  if (kid(properties, 'noFill')) fill = null
  else if (kid(properties, 'solidFill')) fill = colorIn(kid(properties, 'solidFill'), scope.color)
  else if (kid(properties, 'gradFill')) fill = colorIn(walk(properties, 'gradFill', 'gsLst', 'gs'), scope.color)
  else if (kid(properties, 'pattFill')) fill = colorIn(walk(properties, 'pattFill', 'fgClr'), scope.color)
  else if (style && attr(kid(style, 'fillRef'), 'idx') !== '0') fill = colorIn(kid(style, 'fillRef'), scope.color)

  const outline = kid(properties, 'ln')
  let line: string | null = null
  let lineWidth = 12700
  if (outline && kid(outline, 'noFill')) line = null
  else if (outline && kid(outline, 'solidFill')) line = colorIn(kid(outline, 'solidFill'), scope.color)
  else if (style && attr(kid(style, 'lnRef'), 'idx') !== '0') line = colorIn(kid(style, 'lnRef'), scope.color)
  if (outline && attr(outline, 'w') !== null) lineWidth = num(attr(outline, 'w'), 12700)
  const dashName = attr(kid(outline, 'prstDash'), 'val')
  const dash = dashName === 'dot' || dashName === 'sysDot' ? 'dotted' : dashName && dashName !== 'solid' ? 'dashed' : null
  const fontColor = style ? colorIn(kid(style, 'fontRef'), scope.color) : null
  return { fill, line, lineWidth, dash, fontColor }
}

const CLIP_PATHS: Record<string, string> = {
  triangle: 'polygon(50% 0,100% 100%,0 100%)',
  rtTriangle: 'polygon(0 0,100% 100%,0 100%)',
  diamond: 'polygon(50% 0,100% 50%,50% 100%,0 50%)',
  parallelogram: 'polygon(20% 0,100% 0,80% 100%,0 100%)',
  trapezoid: 'polygon(20% 0,80% 0,100% 100%,0 100%)',
  hexagon: 'polygon(25% 0,75% 0,100% 50%,75% 100%,25% 100%,0 50%)',
  pentagon: 'polygon(50% 0,100% 38%,82% 100%,18% 100%,0 38%)',
  rightArrow: 'polygon(0 25%,60% 25%,60% 0,100% 50%,60% 100%,60% 75%,0 75%)',
  leftArrow: 'polygon(100% 25%,40% 25%,40% 0,0 50%,40% 100%,40% 75%,100% 75%)',
  upArrow: 'polygon(25% 100%,25% 40%,0 40%,50% 0,100% 40%,75% 40%,75% 100%)',
  downArrow: 'polygon(25% 0,75% 0,75% 60%,100% 60%,50% 100%,0 60%,25% 60%)',
  chevron: 'polygon(0 0,70% 0,100% 50%,70% 100%,0 100%,30% 50%)',
  homePlate: 'polygon(0 0,75% 0,100% 50%,75% 100%,0 100%)',
}

const LINE_GEOMETRIES = new Set(['line', 'straightConnector1', 'bentConnector2', 'bentConnector3', 'curvedConnector2', 'curvedConnector3'])

function placeholderBox(label: string, frame: Frame, scope: SlideScope): string {
  return `<div class="sh missing" style="${framePosition(frame, scope)}"><span style="font-size:${cqw(14 * EMU_PER_PT, scope)}">${escapeHtml(label)}</span></div>`
}

async function renderShape(
  shape: El,
  scope: SlideScope,
  map: GroupMap,
  labels: PptxLabels,
): Promise<string> {
  scope.shapeCount += 1
  if (scope.shapeCount > MAX_SHAPES_PER_SLIDE) return ''
  const placeholder = placeholderOf(shape)
  const layoutShape = placeholder ? findPlaceholder(scope.layoutTree, placeholder) : null
  const masterShape = placeholder ? findPlaceholder(scope.masterTree, placeholder) : null

  const local = readFrame(walk(shape, 'spPr', 'xfrm')) ??
    readFrame(kid(shape, 'xfrm')) ??
    readFrame(walk(layoutShape, 'spPr', 'xfrm')) ??
    readFrame(walk(masterShape, 'spPr', 'xfrm'))
  if (!local) return ''
  const frame = mapFrame(local, map)
  const position = framePosition(frame, scope)

  // A picture.
  if (shape.localName === 'pic') {
    const blip = walk(shape, 'blipFill', 'blip')
    const data = await pictureData(scope, attr(blip, 'embed'))
    if (!data) return placeholderBox(labels.placeholder('picture'), frame, scope)
    const crop = walk(shape, 'blipFill', 'srcRect')
    const left = num(attr(crop, 'l')) / 100000, top = num(attr(crop, 't')) / 100000
    const right = num(attr(crop, 'r')) / 100000, bottom = num(attr(crop, 'b')) / 100000
    const visibleX = Math.max(0.01, 1 - left - right), visibleY = Math.max(0.01, 1 - top - bottom)
    const imageCss = crop
      ? `position:absolute;width:${(100 / visibleX).toFixed(3)}%;height:${(100 / visibleY).toFixed(3)}%;left:${((-left / visibleX) * 100).toFixed(3)}%;top:${((-top / visibleY) * 100).toFixed(3)}%`
      : 'width:100%;height:100%'
    const description = attr(walk(shape, 'nvPicPr', 'cNvPr'), 'descr') ?? ''
    return `<div class="sh pic" style="${position}"><img src="${data}" alt="${escapeHtml(description)}" style="${imageCss}"></div>`
  }

  // A graphic frame: a table, or something that is not drawn.
  if (shape.localName === 'graphicFrame') {
    const uri = attr(walk(shape, 'graphic', 'graphicData'), 'uri') ?? ''
    const table = walk(shape, 'graphic', 'graphicData', 'tbl')
    if (table) return renderTable(table, frame, scope)
    if (uri.endsWith('/chart') || uri.includes('chart')) return placeholderBox(labels.placeholder('chart'), frame, scope)
    if (uri.includes('diagram')) return placeholderBox(labels.placeholder('diagram'), frame, scope)
    return placeholderBox(labels.placeholder('object'), frame, scope)
  }

  // A shape or connector.
  const style = resolveShapeStyle(shape, scope)
  const geometry = attr(walk(shape, 'spPr', 'prstGeom'), 'prst') ?? 'rect'
  const classes = ['sh']

  if (LINE_GEOMETRIES.has(geometry) || shape.localName === 'cxnSp') {
    const color = style.line ?? '#000000'
    const stroke = Math.max(1, Math.min(6, (style.lineWidth / 9525) * 0.6))
    const x1 = frame.flipH ? 100 : 0, x2 = frame.flipH ? 0 : 100
    const y1 = frame.flipV ? 100 : 0, y2 = frame.flipV ? 0 : 100
    const flipless = { ...frame, flipH: false, flipV: false }
    return `<svg class="sh" style="${framePosition(flipless, scope)};overflow:visible" viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="${stroke}" vector-effect="non-scaling-stroke"${style.dash ? ` stroke-dasharray="${style.dash === 'dotted' ? '1 4' : '6 4'}"` : ''}/></svg>`
  }

  const css: string[] = [position]
  if (style.fill) css.push(`background:${style.fill}`)
  if (style.line) css.push(`border:${cqw(Math.max(6350, style.lineWidth), scope)} ${style.dash ?? 'solid'} ${style.line}`)
  if (geometry === 'ellipse') css.push('border-radius:50%')
  else if (geometry === 'roundRect') css.push('border-radius:16.667%/16.667%')
  else if (CLIP_PATHS[geometry]) css.push(`clip-path:${CLIP_PATHS[geometry]}`)

  const txBody = kid(shape, 'txBody')
  const text = txBody ? descendants(txBody, 't').map(node => node.textContent ?? '').join('') : ''
  if (!txBody || !text.trim()) return `<div class="${classes.join(' ')}" style="${css.join(';')}"></div>`

  // Text. Body properties inherit like everything else: slide, then layout, then master.
  const bodyProperties = [kid(txBody, 'bodyPr'), walk(layoutShape, 'txBody', 'bodyPr'), walk(masterShape, 'txBody', 'bodyPr')]
  const bodyAttribute = (name: string) => bodyProperties.map(node => attr(node, name)).find(value => value !== null) ?? null
  const inset = (name: string, fallback: number) => num(bodyAttribute(name), fallback)
  const anchor = bodyAttribute('anchor')
  const justify = anchor === 'ctr' ? 'center' : anchor === 'b' ? 'flex-end' : 'flex-start'
  const autofit = bodyProperties.map(node => walk(node, 'normAutofit')).find(node => node !== null) ?? null
  const fontScale = autofit ? num(attr(autofit, 'fontScale'), 100000) / 100000 : 1
  css.push(`padding:${cqw(inset('tIns', 45720), scope)} ${cqw(inset('rIns', 91440), scope)} ${cqw(inset('bIns', 45720), scope)} ${cqw(inset('lIns', 91440), scope)}`)
  css.push(`justify-content:${justify}`)
  classes.push('tx')

  const kind = placeholder ? (TITLE_TYPES.has(placeholder.type) ? scope.titleStyle : placeholder.type === 'dt' || placeholder.type === 'ftr' || placeholder.type === 'sldNum' ? scope.otherStyle : scope.bodyStyle) : scope.otherStyle
  const environment: TextEnvironment = {
    base: kind,
    masterPlaceholder: masterShape,
    layoutPlaceholder: layoutShape,
    fontColor: style.fontColor,
  }
  return `<div class="${classes.join(' ')}" style="${css.join(';')}">${renderParagraphs(txBody, environment, scope, fontScale)}</div>`
}

function renderTable(table: El, frame: Frame, scope: SlideScope): string {
  const columns = kids(kid(table, 'tblGrid'), 'gridCol').map(column => num(attr(column, 'w')))
  const total = columns.reduce((sum, width) => sum + width, 0) || 1
  const header = bool(attr(kid(table, 'tblPr'), 'firstRow'))
  const rows = kids(table, 'tr').map((row, rowIndex) => {
    const cells = kids(row, 'tc').map(cell => {
      if (bool(attr(cell, 'hMerge')) || bool(attr(cell, 'vMerge'))) return ''
      const span = num(attr(cell, 'gridSpan'), 1)
      const rowSpan = num(attr(cell, 'rowSpan'), 1)
      const properties = kid(cell, 'tcPr')
      const fill = colorIn(kid(properties, 'solidFill'), scope.color) ?? (header && rowIndex === 0 ? '#e5e7eb' : null)
      const environment: TextEnvironment = { base: scope.otherStyle, masterPlaceholder: null, layoutPlaceholder: null, fontColor: null }
      const body = kid(cell, 'txBody')
      const content = body ? renderParagraphs(body, environment, scope, 1) : ''
      const css = [`padding:${cqw(45720, scope)} ${cqw(91440, scope)}`]
      if (fill) css.push(`background:${fill}`)
      if (header && rowIndex === 0) css.push('font-weight:700')
      return `<td${span > 1 ? ` colspan="${span}"` : ''}${rowSpan > 1 ? ` rowspan="${rowSpan}"` : ''} style="${css.join(';')}">${content}</td>`
    })
    return `<tr style="height:${cqw(num(attr(row, 'h')), scope)}">${cells.join('')}</tr>`
  })
  const widths = columns.map(width => `<col style="width:${((width / total) * 100).toFixed(3)}%">`).join('')
  return `<div class="sh" style="${framePosition(frame, scope)}"><table class="tbl"><colgroup>${widths}</colgroup><tbody>${rows.join('')}</tbody></table></div>`
}

async function renderNode(node: El, scope: SlideScope, map: GroupMap, labels: PptxLabels): Promise<string> {
  if (node.localName === 'grpSp') {
    const xfrm = walk(node, 'grpSpPr', 'xfrm')
    const frame = readFrame(xfrm)
    if (!frame) return ''
    const mapped = mapFrame(frame, map)
    const childOffset = kid(xfrm, 'chOff'), childExtent = kid(xfrm, 'chExt')
    const childCx = num(attr(childExtent, 'cx')) || frame.cx || 1
    const childCy = num(attr(childExtent, 'cy')) || frame.cy || 1
    return renderTree(node, scope, {
      originX: mapped.x,
      originY: mapped.y,
      childOriginX: num(attr(childOffset, 'x')),
      childOriginY: num(attr(childOffset, 'y')),
      scaleX: mapped.cx / childCx,
      scaleY: mapped.cy / childCy,
    }, labels)
  }
  return ['sp', 'pic', 'graphicFrame', 'cxnSp'].includes(node.localName) ? renderShape(node, scope, map, labels) : ''
}

async function renderTree(tree: El | null, scope: SlideScope, map: GroupMap, labels: PptxLabels): Promise<string> {
  const out: string[] = []
  for (const node of kids(tree)) out.push(await renderNode(node, scope, map, labels))
  return out.join('')
}

// ── slides ─────────────────────────────────────────────────────────────────────────────────────

function readColorMap(master: El | null): Record<string, string> {
  const map: Record<string, string> = {}
  const element = kid(master, 'clrMap')
  if (element && element.attributes) {
    for (let index = 0; index < element.attributes.length; index += 1) {
      map[element.attributes[index].localName ?? element.attributes[index].name] = element.attributes[index].value
    }
  }
  return map
}

function readTheme(theme: El | null): Record<string, string> {
  const colors: Record<string, string> = {}
  const scheme = walk(theme, 'themeElements', 'clrScheme')
  for (const entry of kids(scheme)) {
    const value = kids(entry)[0]
    if (!value) continue
    const hex = value.localName === 'sysClr' ? attr(value, 'lastClr') : attr(value, 'val')
    if (hex && HEX.test(hex)) colors[entry.localName] = hex
  }
  return colors
}

function backgroundOf(trees: Array<El | null>, color: ColorContext): string {
  for (const root of trees) {
    const background = walk(root, 'cSld', 'bg')
    if (!background) continue
    const solid = colorIn(walk(background, 'bgPr', 'solidFill') ? walk(background, 'bgPr', 'solidFill') : null, color)
    if (solid) return solid
    const gradient = colorIn(walk(background, 'bgPr', 'gradFill', 'gsLst', 'gs'), color)
    if (gradient) return gradient
    const reference = colorIn(kid(background, 'bgRef'), color)
    if (reference) return reference
  }
  return '#ffffff'
}

function notesText(notes: El | null): string[] {
  const paragraphs: string[] = []
  for (const shape of kids(shapeTree(notes), 'sp')) {
    if (placeholderOf(shape)?.type !== 'body') continue
    for (const paragraph of descendants(kid(shape, 'txBody'), 'p')) {
      const text = descendants(paragraph, 't').map(node => node.textContent ?? '').join('')
      if (text.trim()) paragraphs.push(text)
    }
  }
  return paragraphs
}

const PPTX_CSS = `
body{background:#e5e7eb;padding:12px 12px 24px}
.slide-wrap{max-width:1100px;margin:0 auto 22px}
.slide-label{font:12px system-ui,sans-serif;color:#6b7280;margin:0 0 4px 2px}
.slide{position:relative;container-type:inline-size;width:100%;overflow:hidden;box-shadow:0 1px 5px rgba(0,0,0,.3)}
.slide *{box-sizing:border-box}
.sh{position:absolute}
.tx{display:flex;flex-direction:column;overflow:visible}
.tx p{white-space:pre-wrap;overflow-wrap:break-word;margin-top:0;margin-bottom:0}
.pic{overflow:hidden}
.pic img{display:block}
.missing{display:flex;align-items:center;justify-content:center;border:1px dashed #9ca3af;background:rgba(249,250,251,.85);color:#6b7280;font-family:system-ui,sans-serif;text-align:center}
.tbl{width:100%;height:100%;border-collapse:collapse;table-layout:fixed}
.tbl td{border:1px solid #9ca3af;vertical-align:top}
.tbl p{white-space:pre-wrap;overflow-wrap:break-word}
.notes{margin:6px 2px 0;padding:8px 12px;background:#fffbeb;border:1px solid #fde68a;font:13px/1.5 system-ui,sans-serif;color:#78350f}
.notes b{display:block;margin-bottom:2px;font-size:12px}
.notes p{margin:0 0 4px}
.cap{margin:0 auto 14px;max-width:1100px;padding:6px 12px;background:#fffbeb;border:1px solid #fde68a;font:12px system-ui,sans-serif;color:#92400e}
`

/**
 * The deck as an HTML document for the sandboxed preview frame.
 *
 * A package that cannot be read as a presentation (no slides, a damaged part) throws, and the
 * pane then falls back to offering the download.
 */
export async function renderPptxHtml(blob: Blob, labels: PptxLabels): Promise<string> {
  const zip = await JSZip.loadAsync(await blob.arrayBuffer())
  const pkg = new Package(zip)
  const presentationPart = 'ppt/presentation.xml'
  const presentation = await pkg.xml(presentationPart)
  if (!presentation) throw new Error('not a presentation')

  const size = kid(presentation, 'sldSz')
  const slideCx = num(attr(size, 'cx'), 9144000) || 9144000
  const slideCy = num(attr(size, 'cy'), 6858000) || 6858000
  const presentationRels = await pkg.rels(presentationPart)
  const slideParts = kids(kid(presentation, 'sldIdLst'), 'sldId')
    .map(entry => presentationRels.get(relId(entry) ?? '')?.target)
    .filter((target): target is string => Boolean(target))
  if (slideParts.length === 0) throw new Error('no slides')

  const defaultTextStyle = kid(presentation, 'defaultTextStyle')
  const media = { bytes: 0 }
  const shown = slideParts.slice(0, MAX_SLIDES)
  const sections: string[] = []

  for (let index = 0; index < shown.length; index += 1) {
    const slidePart = shown[index]
    const slideRoot = await pkg.xml(slidePart)
    if (!slideRoot) continue
    const rels = await pkg.rels(slidePart)

    const layoutRel = [...rels.values()].find(rel => rel.type.endsWith('/slideLayout'))
    const layoutRoot = layoutRel ? await pkg.xml(layoutRel.target) : null
    const layoutRels = layoutRel ? await pkg.rels(layoutRel.target) : new Map<string, Relationship>()
    const masterRel = [...layoutRels.values()].find(rel => rel.type.endsWith('/slideMaster'))
    const masterRoot = masterRel ? await pkg.xml(masterRel.target) : null
    const masterRels = masterRel ? await pkg.rels(masterRel.target) : new Map<string, Relationship>()
    const themeRel = [...masterRels.values()].find(rel => rel.type.endsWith('/theme'))
    const themeRoot = themeRel ? await pkg.xml(themeRel.target) : null

    const color: ColorContext = { theme: readTheme(themeRoot), clrMap: readColorMap(masterRoot) }
    const txStyles = kid(masterRoot, 'txStyles')
    const scope: SlideScope = {
      slideCx, slideCy, color, defaultTextStyle,
      titleStyle: kid(txStyles, 'titleStyle'),
      bodyStyle: kid(txStyles, 'bodyStyle'),
      otherStyle: kid(txStyles, 'otherStyle'),
      layoutTree: shapeTree(layoutRoot),
      masterTree: shapeTree(masterRoot),
      rels, slidePart, pkg, media, shapeCount: 0,
    }

    const background = backgroundOf([slideRoot, layoutRoot, masterRoot], color)
    // The master's and layout's own non-placeholder shapes (a logo, a band of colour) sit behind the slide's.
    const decor = async (tree: El | null, ownerPart: string | null): Promise<string> => {
      if (!tree || !ownerPart) return ''
      const decorScope: SlideScope = { ...scope, rels: await pkg.rels(ownerPart), shapeCount: 0 }
      const out: string[] = []
      for (const node of kids(tree)) {
        if (node.localName === 'sp' && placeholderOf(node)) continue
        out.push(await renderNode(node, decorScope, IDENTITY, labels))
      }
      return out.join('')
    }
    const behind = (await decor(scope.masterTree, masterRel?.target ?? null)) + (await decor(scope.layoutTree, layoutRel?.target ?? null))
    const body = await renderTree(shapeTree(slideRoot), scope, IDENTITY, labels)

    const notesRel = [...rels.values()].find(rel => rel.type.endsWith('/notesSlide'))
    const notes = notesRel ? notesText(await pkg.xml(notesRel.target)) : []
    const notesHtml = notes.length
      ? `<div class="notes"><b>${escapeHtml(labels.notes)}</b>${notes.map(line => `<p>${escapeHtml(line)}</p>`).join('')}</div>`
      : ''

    sections.push(
      `<section class="slide-wrap"><p class="slide-label">${escapeHtml(labels.slide(index + 1, slideParts.length))}</p>` +
      `<div class="slide" style="aspect-ratio:${slideCx}/${slideCy};background:${background}">${behind}${body}</div>${notesHtml}</section>`,
    )
  }

  const cap = slideParts.length > shown.length
    ? `<p class="cap">${escapeHtml(labels.truncatedSlides(shown.length, slideParts.length))}</p>`
    : ''
  return previewDocument(sections.join('') + cap, PPTX_CSS)
}
