export type TreeTag = { id: string; parent_id?: string | null; normalized_tag: string }

/**
 * Flattens a parent-linked list into depth-first tree order: each root immediately
 * followed by its own descendants, each one carrying how deep it sits. A flat ordered
 * list renders as a tree with one indent per depth, without needing recursive JSX.
 *
 * Guards against a cycle (a tag whose parent chain loops back to itself) by tracking the
 * ancestors already visited on the current branch — a cycle should never exist given how
 * the catalog is created, but a render that infinite-loops on bad data is a much worse
 * failure than one that silently stops descending into it.
 */
export function buildTagTree<T extends TreeTag>(items: T[]): { item: T; depth: number }[] {
  const knownIds = new Set(items.map(item => item.id))
  const byParent = new Map<string, T[]>()
  for (const item of items) {
    // A parent_id naming a tag that is not in this list is treated as a root rather
    // than dropped: it should not be possible in steady state (deleting a parent tag
    // clears this via ON DELETE SET NULL — see the migration), but a stale reference
    // making its tag silently vanish from the page would be a worse failure than
    // showing it one level shallower than intended.
    const key = item.parent_id && knownIds.has(item.parent_id) ? item.parent_id : ''
    if (!byParent.has(key)) byParent.set(key, [])
    byParent.get(key)!.push(item)
  }
  for (const group of byParent.values()) group.sort((a, b) => a.normalized_tag.localeCompare(b.normalized_tag))

  const ordered: { item: T; depth: number }[] = []
  const visit = (parentKey: string, depth: number, seen: Set<string>) => {
    for (const item of byParent.get(parentKey) || []) {
      if (seen.has(item.id)) continue
      ordered.push({ item, depth })
      visit(item.id, depth + 1, new Set(seen).add(item.id))
    }
  }
  visit('', 0, new Set())
  return ordered
}
