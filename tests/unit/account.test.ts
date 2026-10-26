import { describe, expect, it } from 'vitest'
import { activityKey, deviceLabel, initials, normalizeName } from '../../src/lib/account'

describe('deviceLabel', () => {
  it('joins browser and system', () => {
    expect(deviceLabel({ browser: 'Chrome', os: 'Windows' })).toBe('Chrome · Windows')
  })
  it('shows whichever half is known, and nothing when neither is', () => {
    expect(deviceLabel({ browser: 'Safari', os: '' })).toBe('Safari')
    expect(deviceLabel({ browser: '', os: 'iOS' })).toBe('iOS')
    expect(deviceLabel({})).toBe('')
  })
})

describe('activityKey', () => {
  it('maps the events the server reports to their own wording', () => {
    expect(activityKey('login')).toBe('account.activity.login')
    expect(activityKey('sessions_revoke_others')).toBe('account.activity.sessions_revoke_others')
  })
  it('falls back to a generic row for an event it does not know', () => {
    expect(activityKey('something_new')).toBe('account.activity.other')
  })
})

describe('initials', () => {
  it('takes the first and last word', () => {
    expect(initials('Nguyễn Văn An')).toBe('NA')
    expect(initials('  trần  thị b ')).toBe('TB')
  })
  it('takes two letters of a single word', () => {
    expect(initials('admin')).toBe('AD')
  })
  it('does not split a character that takes two code units', () => {
    expect(initials('𝐀𝐛')).toHaveLength(4)
  })
  it('is a question mark when there is no name', () => {
    expect(initials('')).toBe('?')
    expect(initials(undefined)).toBe('?')
    expect(initials('   ')).toBe('?')
  })
})

describe('normalizeName', () => {
  it('single-spaces and strips control characters, like the server', () => {
    expect(normalizeName('  Nguyễn \t Văn\nA  ')).toBe('Nguyễn Văn A')
    expect(normalizeName('\u0007')).toBe('')
  })
})
