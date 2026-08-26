import { describe, expect, it } from 'vitest'
import { safeExternalUrl } from '../../src/lib/formatters'
import { canEditArticleForUser } from '../../src/utils/articlePermissions'

describe('frontend safety helpers', () => {
  it('accepts only http(s) source links', () => {
    expect(safeExternalUrl('https://example.test/source')).toBe('https://example.test/source')
    expect(safeExternalUrl('javascript:alert(1)')).toBeUndefined()
    expect(safeExternalUrl('not a url')).toBeUndefined()
  })

  it('matches article edit controls to the effective permission scope', () => {
    const article = { id: 'article-1', owner_id: 'user-2', company_domain: 'qsnc.test', dept: 'Finance' }
    expect(canEditArticleForUser({ id: 'user-1', permissions: ['article.edit'], permission_scopes: { 'article.edit': 'own' } }, article)).toBe(false)
    expect(canEditArticleForUser({ id: 'user-1', permissions: ['article.edit'], permission_scopes: { 'article.edit': 'department' }, owned_departments: [{ name: 'Finance' }] }, article)).toBe(true)
    expect(canEditArticleForUser({ id: 'user-1', permissions: ['article.edit'], permission_scopes: { 'article.edit': 'company' }, company_domain: 'other.test' }, article)).toBe(false)
  })
})
