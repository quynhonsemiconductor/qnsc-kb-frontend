import { isAdminOrCeo } from '../../auth/roles'

export type ConflictArticle = {
  id: string
  title: string | null
  dept: string | null
  issue_date: string | null
  status?: string
}

export type ConflictEvidence = { article_id: string; title?: string | null; value?: string | null }

export type Conflict = {
  id: string
  fact: string
  contradiction_type: string | null
  // 'pattern' (labelled-fact lines) or 'llm'; the backend may add more
  detection_method: string
  article_ids: string[]
  articles: ConflictArticle[]
  evidence: ConflictEvidence[]
  // 'open' or 'resolved'
  status: string
  kept_article_id: string | null
  resolution_note: string | null
  resolved_at: string | null
  created_at: string
}

// The kinds the backend can record: the fixed fact labels plus what the model reports.
// An unknown kind renders no badge rather than a misleading generic one.
export const CONTRADICTION_TYPE_LABELS: Record<string, string> = {
  date: 'Date',
  status: 'Status',
  numerical: 'Numerical',
  ownership: 'Ownership',
  procedure: 'Procedure',
}

/** The statement one article makes in this conflict, or '' when none was recorded. */
export function statementFor(conflict: Conflict, articleId: string): string {
  const entry = conflict.evidence.find(item => item.article_id === articleId)
  return (entry?.value ?? '').toString()
}

export function articleLabel(article: ConflictArticle): string {
  return article.title || 'An article that was deleted or is not available to you'
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * The article with the later issue date, when both sides have one and they differ.
 * A hint for the reviewer, never a decision: a newer issue date does not make an article right.
 */
export function newerArticleId(conflict: Conflict): string | null {
  const dated = conflict.articles.filter(article => article.issue_date && ISO_DATE.test(article.issue_date))
  if (dated.length < 2) return null
  const sorted = [...dated].sort((a, b) => (a.issue_date as string).localeCompare(b.issue_date as string))
  const last = sorted[sorted.length - 1]
  const previous = sorted[sorted.length - 2]
  return last.issue_date === previous.issue_date ? null : last.id
}

/** Admin and CEO may decide which article is right; anyone with governance access may close with a note. */
export const canChooseWinner = isAdminOrCeo
