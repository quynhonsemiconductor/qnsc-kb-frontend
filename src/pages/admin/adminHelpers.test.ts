import { describe, expect, it } from 'vitest'
import { isAdminOrCeo } from '../../auth/roles'
import { stalledLabel } from './connectorJobs'
import { describeSaveFailure, STALE_MESSAGE } from './mcpConfigUtils'

describe('stalledLabel', () => {
  it('says nothing for a job that is not stalled', () => {
    expect(stalledLabel({})).toBeNull()
    expect(stalledLabel({ stalled: false, queued_minutes: 3 })).toBeNull()
  })

  it('says how long a stalled job has waited', () => {
    expect(stalledLabel({ stalled: true, queued_minutes: 42 })).toBe('No worker picked this up for 42 min')
  })

  it('never prints "for min" when the server sends no duration', () => {
    expect(stalledLabel({ stalled: true, queued_minutes: null })).toBe('No worker picked this up')
    expect(stalledLabel({ stalled: true })).toBe('No worker picked this up')
  })
})

describe('describeSaveFailure', () => {
  it('treats a 409 as a stale version that must be reloaded', () => {
    expect(describeSaveFailure({ response: { status: 409 } })).toEqual({ message: STALE_MESSAGE, stale: true })
  })

  it('shows the server\'s reason for any other failure', () => {
    expect(describeSaveFailure({ response: { status: 403, data: { detail: 'Only an Admin or CEO can change the team configuration' } } }))
      .toEqual({ message: 'Only an Admin or CEO can change the team configuration', stale: false })
  })

  it('falls back to a generic message when there is no readable reason', () => {
    expect(describeSaveFailure({ response: { status: 500, data: { detail: { code: 'x' } } } })).toEqual({ message: 'It could not be saved.', stale: false })
    expect(describeSaveFailure(new Error('network'))).toEqual({ message: 'It could not be saved.', stale: false })
    expect(describeSaveFailure(undefined)).toEqual({ message: 'It could not be saved.', stale: false })
  })
})

describe('isAdminOrCeo', () => {
  it('accepts either role, directly or assigned', () => {
    expect(isAdminOrCeo({ role: 'Admin' })).toBe(true)
    expect(isAdminOrCeo({ role: 'CEO' })).toBe(true)
    expect(isAdminOrCeo({ role: 'Manager', roles: [{ name: 'CEO' }] })).toBe(true)
  })

  it('refuses others and a missing user', () => {
    expect(isAdminOrCeo({ role: 'Manager', roles: [{ name: 'Editor' }, {}] })).toBe(false)
    expect(isAdminOrCeo(null)).toBe(false)
    expect(isAdminOrCeo(undefined)).toBe(false)
  })
})
