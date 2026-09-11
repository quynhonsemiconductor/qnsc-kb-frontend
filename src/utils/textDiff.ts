export type DiffToken = { type: 'same' | 'add' | 'del'; text: string }

// Splits on whitespace boundaries while keeping the whitespace itself as its own token,
// so the diffed output can be rejoined without collapsing spacing.
function tokenize(text: string): string[] {
  return (text || '').split(/(\s+)/).filter(token => token.length > 0)
}

// Cell count above which the O(n*m) LCS table would be too large to build without
// noticeably blocking the tab. Article bodies here are section-sized (chunker.py packs
// ~1800 characters per parent chunk), so this ceiling is far above any real document and
// only guards the pathological case.
const MAX_DIFF_CELLS = 4_000_000

/**
 * Word-level diff between two texts using a classic LCS backtrace.
 *
 * Returns `null` when both texts together are too large to diff safely, so the caller can
 * fall back to showing the two versions side by side without highlighting instead of
 * hanging the tab.
 */
export function diffWords(oldText: string, newText: string): DiffToken[] | null {
  const a = tokenize(oldText)
  const b = tokenize(newText)
  const n = a.length
  const m = b.length
  if (n * m > MAX_DIFF_CELLS) return null

  // dp[i][j] = length of the LCS of a[i:] and b[j:], built backwards so the forward
  // backtrace below can walk from (0, 0) toward the end.
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0))
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = a[i] === b[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }

  const tokens: DiffToken[] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      tokens.push({ type: 'same', text: a[i] })
      i += 1
      j += 1
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      tokens.push({ type: 'del', text: a[i] })
      i += 1
    } else {
      tokens.push({ type: 'add', text: b[j] })
      j += 1
    }
  }
  while (i < n) { tokens.push({ type: 'del', text: a[i] }); i += 1 }
  while (j < m) { tokens.push({ type: 'add', text: b[j] }); j += 1 }

  // Merge adjacent same-type tokens so a run of added/removed words renders as one span
  // instead of one <span> per word.
  const merged: DiffToken[] = []
  for (const token of tokens) {
    const last = merged[merged.length - 1]
    if (last && last.type === token.type) last.text += token.text
    else merged.push({ ...token })
  }
  return merged
}
