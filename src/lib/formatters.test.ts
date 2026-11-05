import { afterEach, describe, expect, it } from 'vitest'
import { formatDateTime, formatDay, setDisplayLocale } from './formatters'

afterEach(() => setDisplayLocale(undefined))

describe('date formatting follows the display locale', () => {
  const stamp = '2026-11-04T09:30:00'

  it('uses the browser locale when none is set', () => {
    setDisplayLocale(undefined)
    expect(formatDateTime(stamp)).toBe(new Date('2026-11-04T09:30:00Z').toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }))
    expect(formatDay(stamp)).toBe(new Date('2026-11-04T09:30:00Z').toLocaleDateString())
  })

  it('writes dates the way the chosen language does', () => {
    setDisplayLocale('vi-VN')
    const date = new Date('2026-11-04T09:30:00Z')
    expect(formatDateTime(stamp)).toBe(date.toLocaleString('vi-VN', { dateStyle: 'medium', timeStyle: 'short' }))
    expect(formatDay(stamp)).toBe(date.toLocaleDateString('vi-VN'))
    expect(formatDay(stamp)).not.toBe(date.toLocaleDateString('en-US'))
  })

  it('still reads the API stamp as UTC and keeps the fallback for nothing', () => {
    setDisplayLocale('vi-VN')
    expect(formatDay(null, 'none')).toBe('none')
    expect(formatDateTime('', 'none')).toBe('none')
    expect(formatDay('2026-11-04T23:30:00')).toBe(new Date('2026-11-04T23:30:00Z').toLocaleDateString('vi-VN'))
  })
})
