/**
 * Marking which rendered block owns each anchored figure.
 *
 * This runs inside ReactMarkdown's own rehype pass rather than parsing the answer a
 * second time. The answer is re-rendered on every keystroke in the composer — the reason
 * `AnswerText` is memoised at all — so a second parse per render was not worth paying
 * for when the tree is already being built here.
 *
 * Each element carries the span of source text it came from, and each anchor is the
 * offset of the marker that claimed it, so ownership is containment. The subtlety is
 * DEPTH: a marker inside a loose list item sits within both the `<li>` and its inner
 * `<p>`, and a marker in a quote sits within both the `<blockquote>` and its `<p>`.
 * Attaching to each would render the same figure twice, so only the innermost
 * anchorable block keeps it.
 */

/**
 * The blocks a figure may be anchored to.
 *
 * Table internals are excluded deliberately: a figure dropped inside a `<td>` wrecks the
 * table's layout, so evidence cited from a cell anchors after the whole table. `pre`
 * rather than `code` for the same reason — after the code block, never inside its
 * highlighted markup. `ul`/`ol` are absent because the owning item is the `<li>`.
 */
export const ANCHORABLE_TAGS = new Set([
  'p', 'li', 'blockquote', 'table', 'pre', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
])

/** The property the plugin writes and the renderer reads. */
export const ANCHOR_PROPERTY = 'dataEvidenceAnchor'

interface HastNode {
  type?: string
  tagName?: string
  properties?: Record<string, unknown>
  children?: HastNode[]
  position?: { start?: { offset?: number }; end?: { offset?: number } }
}

/**
 * Annotate each block with the anchor offsets it owns, as a comma-separated list.
 *
 * A string rather than an array because it becomes a DOM attribute: React would warn
 * about an array value, and the renderer only needs to get the numbers back out.
 */
export function markEvidenceAnchors(offsets: number[]) {
  return (tree: HastNode) => {
    if (!offsets.length) return

    // Every anchorable block, with its span, deepest first. Collected in one walk so
    // each offset can be resolved against all of them rather than re-walking per offset.
    const blocks: Array<{ node: HastNode; start: number; end: number; depth: number }> = []
    const visit = (node: HastNode, depth: number) => {
      if (node.type === 'element' && node.tagName && ANCHORABLE_TAGS.has(node.tagName)) {
        const start = node.position?.start?.offset
        const end = node.position?.end?.offset
        if (start != null && end != null) blocks.push({ node, start, end, depth })
      }
      for (const child of node.children || []) visit(child, depth + 1)
    }
    for (const child of tree.children || []) visit(child, 0)

    for (const offset of offsets) {
      let owner: (typeof blocks)[number] | undefined
      for (const block of blocks) {
        if (offset < block.start || offset > block.end) continue
        // Deeper wins; on equal depth the narrower span does, which keeps the choice
        // deterministic for trees where depth alone cannot separate two candidates.
        if (
          !owner
          || block.depth > owner.depth
          || (block.depth === owner.depth && block.end - block.start < owner.end - owner.start)
        ) {
          owner = block
        }
      }
      if (!owner) continue
      const properties = owner.node.properties || (owner.node.properties = {})
      const existing = properties[ANCHOR_PROPERTY]
      properties[ANCHOR_PROPERTY] = existing ? `${existing},${offset}` : String(offset)
    }
  }
}

/** Read back the offsets the plugin wrote onto one block. */
export function anchorOffsetsFromProp(value: unknown): number[] {
  if (typeof value !== 'string' || !value) return []
  return value
    .split(',')
    .map(part => Number(part))
    .filter(part => Number.isFinite(part))
}
