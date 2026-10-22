import { describe, expect, it } from 'vitest'
import {
  MAX_EDIT_ROWS,
  MAX_EDIT_TEXT,
  canSubmit,
  countsByRow,
  editErrorMessage,
  filledRows,
  missingTexts,
  rowsProblem,
} from '../../src/utils/sourceEdit'

const row = (find: string, replace: string) => ({ find, replace })

describe('rows to send', () => {
  it('drops lines with nothing to find but keeps spaces and case exactly', () => {
    expect(filledRows([row('', 'x'), row(' Ab ', ' cd ')])).toEqual([row(' Ab ', ' cd ')])
  })

  it('refuses nothing, a no-op, over-long text and too many rows', () => {
    expect(rowsProblem([row('', '')])).toBe('empty')
    expect(rowsProblem([row('a', 'a')])).toBe('unchanged')
    expect(rowsProblem([row('a'.repeat(MAX_EDIT_TEXT + 1), 'b')])).toBe('tooLong')
    expect(rowsProblem([row('a', 'b'.repeat(MAX_EDIT_TEXT + 1))])).toBe('tooLong')
    expect(rowsProblem(Array.from({ length: MAX_EDIT_ROWS + 1 }, (_, i) => row(`a${i}`, 'b')))).toBe('tooMany')
    expect(rowsProblem([row('1234', '1244')])).toBeNull()
  })

  it('allows deleting text by replacing it with nothing', () => {
    expect(rowsProblem([row('draft', '')])).toBeNull()
  })
})

describe('mapping the check back onto the rows', () => {
  it('skips unfilled lines, which were not sent', () => {
    expect(countsByRow([row('a', 'b'), row('', ''), row('c', 'd')], [2, 0])).toEqual([2, null, 0])
  })

  it('shows nothing for a row the API did not report', () => {
    expect(countsByRow([row('a', 'b')], [])).toEqual([null])
  })
})

describe('when a change can be submitted', () => {
  it('needs a completed check in which every line matched', () => {
    const rows = [row('1234', '1244'), row('x', 'y')]
    expect(canSubmit(rows, null)).toBe(false)
    expect(canSubmit(rows, [1, 0])).toBe(false)
    expect(canSubmit(rows, [1])).toBe(false)
    expect(canSubmit(rows, [1, 3])).toBe(true)
  })

  it('is not allowed for rows that are themselves invalid', () => {
    expect(canSubmit([row('a', 'a')], [1])).toBe(false)
    expect(canSubmit([row('', '')], [])).toBe(false)
  })
})

describe('reading API errors', () => {
  const body = (detail: unknown) => ({ response: { data: { detail } } })

  it('finds which texts were not found', () => {
    expect(missingTexts(body({ code: 'text_not_found', missing: ['a', 'b'] }))).toEqual(['a', 'b'])
    expect(missingTexts(body({ code: 'text_not_found' }))).toEqual([])
  })

  it('ignores any other error', () => {
    expect(missingTexts(body('nope'))).toBeNull()
    expect(missingTexts(body({ code: 'other' }))).toBeNull()
    expect(missingTexts(new Error('x'))).toBeNull()
  })

  it('turns string and structured details into a message', () => {
    expect(editErrorMessage(body('This PDF is a scan'), 'fallback')).toBe('This PDF is a scan')
    expect(editErrorMessage(body({ message: 'Some text was not found' }), 'fallback')).toBe('Some text was not found')
    expect(editErrorMessage(body({ code: 'x' }), 'fallback')).toBe('fallback')
    expect(editErrorMessage(undefined, 'fallback')).toBe('fallback')
  })
})
