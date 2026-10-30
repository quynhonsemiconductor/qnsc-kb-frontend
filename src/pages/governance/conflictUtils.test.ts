import { describe, expect, it } from 'vitest'
import { articleLabel, canChooseWinner, newerArticleId, statementFor, type Conflict } from './conflictUtils'

const conflict = (overrides: Partial<Conflict> = {}): Conflict => ({
  id: 'c1',
  fact: 'Approval time',
  contradiction_type: 'numerical',
  detection_method: 'llm',
  article_ids: ['a', 'b'],
  articles: [
    { id: 'a', title: 'Policy 2025', dept: 'HR', issue_date: '2025-01-10' },
    { id: 'b', title: 'Policy 2026', dept: 'HR', issue_date: '2026-03-01' },
  ],
  evidence: [
    { article_id: 'a', value: '5 days' },
    { article_id: 'b', value: '3 days' },
  ],
  status: 'open',
  kept_article_id: null,
  resolution_note: null,
  resolved_at: null,
  created_at: '2026-10-30T00:00:00',
  ...overrides,
})

describe('statementFor', () => {
  it('returns what each article says', () => {
    expect(statementFor(conflict(), 'a')).toBe('5 days')
    expect(statementFor(conflict(), 'b')).toBe('3 days')
  })

  it('is empty when nothing was recorded for the article', () => {
    expect(statementFor(conflict(), 'zzz')).toBe('')
    expect(statementFor(conflict({ evidence: [{ article_id: 'a' }] }), 'a')).toBe('')
  })
})

describe('newerArticleId', () => {
  it('names the article with the later issue date', () => {
    expect(newerArticleId(conflict())).toBe('b')
  })

  it('says nothing when the dates are equal or missing', () => {
    const same = conflict({ articles: [
      { id: 'a', title: 'A', dept: 'HR', issue_date: '2026-01-01' },
      { id: 'b', title: 'B', dept: 'HR', issue_date: '2026-01-01' },
    ] })
    const missing = conflict({ articles: [
      { id: 'a', title: 'A', dept: 'HR', issue_date: null },
      { id: 'b', title: 'B', dept: 'HR', issue_date: '2026-01-01' },
    ] })
    expect(newerArticleId(same)).toBeNull()
    expect(newerArticleId(missing)).toBeNull()
  })

  it('ignores a date that is not ISO formatted', () => {
    const odd = conflict({ articles: [
      { id: 'a', title: 'A', dept: 'HR', issue_date: 'last spring' },
      { id: 'b', title: 'B', dept: 'HR', issue_date: '2026-01-01' },
    ] })
    expect(newerArticleId(odd)).toBeNull()
  })
})

describe('articleLabel', () => {
  it('uses the title, or says the article is unavailable', () => {
    expect(articleLabel({ id: 'a', title: 'Policy', dept: null, issue_date: null })).toBe('Policy')
    expect(articleLabel({ id: 'a', title: null, dept: null, issue_date: null })).toMatch(/deleted or is not available/)
  })
})

describe('canChooseWinner', () => {
  it('allows Admin and CEO, by role or by assigned role', () => {
    expect(canChooseWinner({ role: 'Admin' })).toBe(true)
    expect(canChooseWinner({ role: 'CEO' })).toBe(true)
    expect(canChooseWinner({ role: 'Manager', roles: [{ name: 'Admin' }] })).toBe(true)
  })

  it('refuses everyone else, including no user', () => {
    expect(canChooseWinner({ role: 'Manager' })).toBe(false)
    expect(canChooseWinner({ role: 'Employee', roles: [{ name: 'Editor' }] })).toBe(false)
    expect(canChooseWinner(null)).toBe(false)
    expect(canChooseWinner(undefined)).toBe(false)
  })
})
