import { describe, expect, it } from 'vitest'
import { articleListParams } from './articleList'

describe('articleListParams', () => {
  it('asks the server to leave the document bodies out of a list', () => {
    expect(articleListParams({ limit: 50, offset: 0 })).toEqual({ include_body: false, limit: 50, offset: 0 })
  })

  it('keeps every filter the caller passed', () => {
    expect(articleListParams({ q: 'gpio', status: 'published', dept: 'Engineering' })).toMatchObject({
      q: 'gpio',
      status: 'published',
      dept: 'Engineering',
      include_body: false,
    })
  })

  it('lets a caller that needs the text ask for it', () => {
    expect(articleListParams({ include_body: true }).include_body).toBe(true)
  })

  it('works for no parameters at all', () => {
    expect(articleListParams({})).toEqual({ include_body: false })
  })
})
