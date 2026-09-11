import { describe, expect, it } from 'vitest'
import { buildTagTree } from '../../src/utils/tagTree'

type Tag = { id: string; parent_id?: string | null; normalized_tag: string }

const tag = (id: string, normalized_tag: string, parent_id?: string | null): Tag => ({ id, normalized_tag, parent_id })

describe('buildTagTree', () => {
  it('returns root tags alphabetically when there is no hierarchy', () => {
    const items = [tag('1', 'safety'), tag('2', 'evacuation')]
    expect(buildTagTree(items).map(({ item, depth }) => [item.id, depth])).toEqual([
      ['2', 0],
      ['1', 0],
    ])
  })

  it('nests a child directly under its parent, deeper than the parent', () => {
    const parent = tag('p', 'safety')
    const child = tag('c', 'evacuation', 'p')
    const result = buildTagTree([parent, child])
    expect(result.map(({ item, depth }) => [item.id, depth])).toEqual([
      ['p', 0],
      ['c', 1],
    ])
  })

  it('keeps every child immediately after its own parent, not grouped by depth', () => {
    const a = tag('a', 'safety')
    const aChild = tag('a1', 'evacuation', 'a')
    const b = tag('b', 'security')
    const result = buildTagTree([b, aChild, a])
    expect(result.map(({ item }) => item.id)).toEqual(['a', 'a1', 'b'])
  })

  it('supports more than two levels', () => {
    const root = tag('r', 'safety')
    const mid = tag('m', 'fire', 'r')
    const leaf = tag('l', 'evacuation-route', 'm')
    const result = buildTagTree([leaf, root, mid])
    expect(result.map(({ item, depth }) => [item.id, depth])).toEqual([
      ['r', 0],
      ['m', 1],
      ['l', 2],
    ])
  })

  it('treats a tag whose parent is missing from the list as a root', () => {
    const orphan = tag('o', 'evacuation', 'does-not-exist')
    expect(buildTagTree([orphan]).map(({ item, depth }) => [item.id, depth])).toEqual([['o', 0]])
  })

  it('a cycle with no real root is silently unreachable, not an infinite loop', () => {
    // Every id in items appears under exactly one parent, so a and b pointing at each
    // other simply have no node with a falsy parent_id to start traversal from — the
    // safe outcome for disconnected, cyclic garbage data is that it never appears.
    const a = tag('a', 'a-tag', 'b')
    const b = tag('b', 'b-tag', 'a')
    expect(buildTagTree([a, b])).toEqual([])
  })

  it('returns nothing for an empty catalog', () => {
    expect(buildTagTree([])).toEqual([])
  })
})
