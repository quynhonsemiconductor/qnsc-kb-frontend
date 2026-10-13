/**
 * Which rendered block a cited figure attaches to.
 *
 * The rule is containment plus depth, and depth is the part that bites: a marker inside a
 * loose list item sits within the `<li>` AND its inner `<p>`; a marker in a quote sits
 * within the `<blockquote>` AND its `<p>`. Marking both would render the same figure
 * twice, which is the defect these tests exist to prevent.
 *
 * The tree is built with the exact plugin set `AnswerText` renders with, so what is
 * asserted here is what ships rather than a simplified stand-in.
 */
import { describe, expect, it } from 'vitest'
import { unified } from 'unified'
import remarkParse from 'remark-parse'
import remarkGfm from 'remark-gfm'
import remarkRehype from 'remark-rehype'
import rehypeHighlight from 'rehype-highlight'
import {
  ANCHOR_PROPERTY,
  anchorOffsetsFromProp,
  markEvidenceAnchors,
} from '../../src/lib/evidence-anchor-plugin'

interface Node {
  type?: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: Node[]
}

/** Every block the plugin marked, as `tag -> offsets`, in document order. */
function marked(markdown: string, offsets: number[]): Array<[string, number[]]> {
  const processor = unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeHighlight)
  const tree = processor.runSync(processor.parse(markdown)) as Node
  markEvidenceAnchors(offsets)(tree)

  const found: Array<[string, number[]]> = []
  const walk = (node: Node) => {
    if (node.type !== 'element') return
    const value = node.properties?.[ANCHOR_PROPERTY]
    if (value) found.push([node.tagName as string, anchorOffsetsFromProp(value)])
    for (const child of node.children || []) walk(child)
  }
  for (const child of tree.children || []) walk(child)
  return found
}

/** The offset of a marker in the source, which is what an anchor is keyed by. */
const at = (markdown: string, marker: string) => markdown.indexOf(marker)

describe('choosing the block that owns an anchored figure', () => {
  it('marks the paragraph containing the marker', () => {
    const markdown = 'First claim [C1].\n\nSecond claim [C2].\n'

    expect(marked(markdown, [at(markdown, '[C2]')])).toEqual([
      ['p', [at(markdown, '[C2]')]],
    ])
  })

  it('marks the list item, not the whole list', () => {
    const markdown = '- first [C1]\n- second [C2]\n'

    // Attaching to the `<ul>` would put the figure after every item instead of after
    // the one that cited it.
    expect(marked(markdown, [at(markdown, '[C2]')])).toEqual([
      ['li', [at(markdown, '[C2]')]],
    ])
  })

  it('marks one block only for a marker nested in a loose list item', () => {
    const markdown = '1. outer\n\n   inner para [C1]\n'

    const result = marked(markdown, [at(markdown, '[C1]')])

    expect(result).toHaveLength(1)
    expect(result[0][0]).toBe('p')
  })

  it('marks one block only for a marker inside a quote', () => {
    const markdown = '> quoted claim [C1]\n'

    const result = marked(markdown, [at(markdown, '[C1]')])

    expect(result).toHaveLength(1)
    expect(result[0][0]).toBe('p')
  })

  it('marks the table rather than the cell', () => {
    const markdown = '| a | b |\n| - | - |\n| x [C1] | y |\n'

    // A figure dropped inside a `<td>` wrecks the table layout, so a cell citation
    // anchors after the whole table.
    expect(marked(markdown, [at(markdown, '[C1]')])).toEqual([
      ['table', [at(markdown, '[C1]')]],
    ])
  })

  it('marks the pre rather than the highlighted code inside it', () => {
    const markdown = '```js\nconst a = 1 // [C1]\n```\n'

    expect(marked(markdown, [at(markdown, '[C1]')])).toEqual([
      ['pre', [at(markdown, '[C1]')]],
    ])
  })

  it('marks a heading that cites a figure', () => {
    const markdown = '## Section [C1]\n\nBody.\n'

    expect(marked(markdown, [at(markdown, '[C1]')])).toEqual([
      ['h2', [at(markdown, '[C1]')]],
    ])
  })

  it('carries several anchors on one block when it cites several figures', () => {
    const markdown = 'Both here [C1] and [C2].\n'
    const offsets = [at(markdown, '[C1]'), at(markdown, '[C2]')]

    expect(marked(markdown, offsets)).toEqual([['p', offsets]])
  })

  it('marks each citing block separately', () => {
    const markdown = 'First [C1].\n\nSecond [C2].\n'
    const first = at(markdown, '[C1]')
    const second = at(markdown, '[C2]')

    expect(marked(markdown, [first, second])).toEqual([
      ['p', [first]],
      ['p', [second]],
    ])
  })

  it('marks nothing when there are no anchors', () => {
    expect(marked('Plain answer [C1].\n', [])).toEqual([])
  })

  it('marks nothing for an offset outside every block', () => {
    expect(marked('Short.\n', [9999])).toEqual([])
  })
})

describe('reading anchor offsets back off a block', () => {
  it('parses the comma-separated attribute the plugin writes', () => {
    expect(anchorOffsetsFromProp('12')).toEqual([12])
    expect(anchorOffsetsFromProp('12,40')).toEqual([12, 40])
  })

  it.each([
    ['absent', undefined],
    ['empty', ''],
    ['a non-string', 42],
    ['unparseable', 'abc'],
  ])('yields nothing for %s input', (_label, value) => {
    expect(anchorOffsetsFromProp(value)).toEqual([])
  })
})
