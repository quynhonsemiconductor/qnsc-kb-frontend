import { describe, expect, it } from 'vitest'
import { CHUNK_FLAG_LABELS, flaggedCount, type ChunkView } from './chunkUtils'

const child = (id: string, flags: string[] = []) => ({ id, index: 0, text: 'x', chars: 1, page_number: null, heading: null, flags })

const view = (parents: ChunkView['parents']): ChunkView => ({
  summary: { parents: parents.length, children: 0, avg_chars: 0, flags: {}, embedding_version: 'e', chunking_version: 'c' },
  parents,
})

const parent = (children: ReturnType<typeof child>[]) => ({ id: 'p', heading: null, section_ref: null, page_number: null, chunk_type: 'text', chars: 0, text: '', children })

describe('flaggedCount', () => {
  it('counts passages with at least one flag, across sections', () => {
    expect(flaggedCount(view([parent([child('a', ['tiny']), child('b')]), parent([child('c', ['duplicate', 'huge'])])]))).toBe(2)
  })

  it('is zero for a healthy or empty article', () => {
    expect(flaggedCount(view([parent([child('a'), child('b')])]))).toBe(0)
    expect(flaggedCount(view([]))).toBe(0)
  })
})

describe('CHUNK_FLAG_LABELS', () => {
  it('explains every flag the backend can raise', () => {
    for (const flag of ['tiny', 'huge', 'duplicate', 'stale_embedding', 'old_chunking']) {
      expect(CHUNK_FLAG_LABELS[flag]?.help.length).toBeGreaterThan(10)
    }
  })
})
