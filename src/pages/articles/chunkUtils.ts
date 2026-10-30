export type ChunkChild = {
  id: string
  index: number
  text: string
  chars: number
  page_number: number | null
  heading: string | null
  flags: string[]
}

export type ChunkParent = {
  id: string
  heading: string | null
  section_ref: string | null
  page_number: number | null
  chunk_type: string
  chars: number
  text: string
  children: ChunkChild[]
}

export type ChunkView = {
  summary: {
    parents: number
    children: number
    avg_chars: number
    flags: Record<string, number>
    embedding_version: string
    chunking_version: string
  }
  parents: ChunkParent[]
}

// Mirrors the flags in the backend's chunk_quality.py; an unknown flag still renders, as itself.
export const CHUNK_FLAG_LABELS: Record<string, { label: string; short: string; help: string }> = {
  tiny: { label: 'Very short', short: 'very short', help: 'Too little text to be found on its own; often a heading or a fragment left by a split.' },
  huge: { label: 'Very long', short: 'very long', help: 'Long enough that its meaning may be diluted; often a table or a list that was not split.' },
  duplicate: { label: 'Repeated', short: 'repeated', help: 'The same text appears more than once in this article.' },
  stale_embedding: { label: 'Old embedding', short: 'on an old embedding', help: 'Indexed with a different embedding model than search uses now, so it may not be found.' },
  old_chunking: { label: 'Old chunking', short: 'cut by an older version', help: 'Cut by an older version of the chunker; re-indexing the article would redo it.' },
}

/** How many passages carry at least one flag. */
export function flaggedCount(view: ChunkView): number {
  return view.parents.reduce((sum, parent) => sum + parent.children.filter(child => child.flags.length > 0).length, 0)
}
