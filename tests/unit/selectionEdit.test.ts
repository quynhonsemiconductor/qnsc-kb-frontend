import { describe, expect, it } from 'vitest'
import {
  CONTEXT_CHARS,
  MAX_PENDING_EDITS,
  MAX_SELECTION_CHARS,
  canQueue,
  cleanSelectedText,
  contextAround,
  describeEdit,
  editErrorMessage,
  missingTexts,
  placePopover,
  selectionProblem,
  spansLines,
  toFractions,
  toPayloadRow,
  trimSelection,
  willApply,
  type PendingEdit,
} from '../../src/lib/selectionEdit'

const edit = (over: Partial<PendingEdit> = {}): PendingEdit => ({ id: 'e1', find: '1234', replace: '1244', before: 'Phụ cấp ', after: ' theo', all: false, ...over })

describe('what may be selected', () => {
  it('accepts a normal word or phrase', () => {
    expect(selectionProblem('1234')).toBeNull()
    expect(selectionProblem('Phụ cấp 1234')).toBeNull()
  })

  it('refuses an empty selection, a line break and an over-long selection', () => {
    expect(selectionProblem('   ')).toBe('empty')
    expect(selectionProblem('a\nb')).toBe('multiline')
    expect(selectionProblem('a\r\nb')).toBe('multiline')
    expect(selectionProblem('x'.repeat(MAX_SELECTION_CHARS + 1))).toBe('tooLong')
    expect(selectionProblem('x'.repeat(MAX_SELECTION_CHARS))).toBeNull()
  })

  it('turns non-breaking spaces into ordinary ones, as the file stores them', () => {
    expect(cleanSelectedText('Phụ cấp')).toBe('Phụ cấp')
  })

  it('knows when a selection lies on more than one line', () => {
    expect(spansLines([{ top: 100, height: 16 }, { top: 101, height: 16 }])).toBe(false)
    expect(spansLines([{ top: 100, height: 16 }, { top: 130, height: 16 }])).toBe(true)
    expect(spansLines([{ top: 100, height: 16 }])).toBe(false)
    expect(spansLines([])).toBe(false)
    expect(spansLines([{ top: 100, height: 0 }, { top: 300, height: 0 }])).toBe(false)
  })
})

describe('the text around a selection', () => {
  const whole = 'Lương cơ bản 1234 đồng. Phụ cấp 1234 theo quy định. Thưởng 1234.'
  const second = whole.indexOf('1234', whole.indexOf('Phụ cấp'))

  it('takes the characters on each side of the chosen occurrence', () => {
    const { before, after } = contextAround(whole, second, 4, 10)
    expect(before).toBe('. Phụ cấp ')
    expect(after).toBe(' theo quy ')
  })

  it('stops at the ends of the text', () => {
    expect(contextAround('1234 x', 0, 4)).toEqual({ before: '', after: ' x' })
    expect(contextAround('x 1234', 2, 4)).toEqual({ before: 'x ', after: '' })
  })

  it('tells occurrences apart: the three 1234s get three different surroundings', () => {
    const starts = [...whole.matchAll(/1234/g)].map(match => match.index as number)
    const contexts = starts.map(start => JSON.stringify(contextAround(whole, start, 4, CONTEXT_CHARS)))
    expect(new Set(contexts).size).toBe(3)
  })
})

describe('what is sent', () => {
  it('sends the surroundings and the page so only the selected occurrence changes', () => {
    expect(toPayloadRow(edit({ page: 2 }))).toEqual({ find: '1234', replace: '1244', before: 'Phụ cấp ', after: ' theo', page: 2 })
  })

  it('sends nothing but the texts when every place is to change', () => {
    expect(toPayloadRow(edit({ all: true, page: 2 }))).toEqual({ find: '1234', replace: '1244' })
  })

  it('leaves out empty surroundings and a missing page', () => {
    expect(toPayloadRow(edit({ before: '', after: '' }))).toEqual({ find: '1234', replace: '1244' })
  })

  it('allows deleting text by replacing it with nothing', () => {
    expect(toPayloadRow(edit({ replace: '' })).replace).toBe('')
  })
})

describe('queueing a correction', () => {
  it('refuses a no-op and a full queue, otherwise allows it', () => {
    expect(canQueue([], '1234', '1234')).toBe('same')
    expect(canQueue([], '1234', '1244')).toBe('ok')
    expect(canQueue(Array.from({ length: MAX_PENDING_EDITS }, (_, i) => edit({ id: String(i) })), 'a', 'b')).toBe('full')
  })

  it('describes a change briefly', () => {
    expect(describeEdit({ find: '1234', replace: '1244' })).toBe('1234 → 1244')
    expect(describeEdit({ find: 'x'.repeat(40), replace: '' })).toBe(`${'x'.repeat(27)}… → ∅`)
  })

  it('applies a selected occurrence only if the server found it, or any place if "all"', () => {
    expect(willApply({ all: false }, { selected: 1, everywhere: 4 })).toBe(true)
    expect(willApply({ all: false }, { selected: 0, everywhere: 4 })).toBe(false)
    expect(willApply({ all: true }, { selected: 0, everywhere: 4 })).toBe(true)
    expect(willApply({ all: true }, { selected: 0, everywhere: 0 })).toBe(false)
    expect(willApply({ all: false }, undefined)).toBe(false)
  })
})

describe('placing the popover', () => {
  const viewport = { width: 1000, height: 700 }
  const size = { width: 320, height: 200 }

  it('goes just below the selection', () => {
    expect(placePopover({ left: 100, top: 100, width: 50, height: 16 }, viewport, size)).toEqual({ left: 100, top: 124 })
  })

  it('goes above it when there is no room below', () => {
    const placed = placePopover({ left: 100, top: 600, width: 50, height: 16 }, viewport, size)
    expect(placed.top).toBe(600 - 200 - 8)
  })

  it('stays inside the viewport at the right and left edges', () => {
    expect(placePopover({ left: 900, top: 100, width: 50, height: 16 }, viewport, size).left).toBe(1000 - 320 - 8)
    expect(placePopover({ left: -50, top: 100, width: 50, height: 16 }, viewport, size).left).toBe(8)
  })
})

describe('drawing a correction over the document', () => {
  it('expresses a rectangle as fractions of its container so it survives zooming', () => {
    expect(toFractions({ left: 150, top: 220, width: 50, height: 20 }, { left: 100, top: 200, width: 500, height: 400 })).toEqual({ left: 0.1, top: 0.05, width: 0.1, height: 0.05 })
    expect(toFractions({ left: 1, top: 1, width: 1, height: 1 }, { left: 0, top: 0, width: 0, height: 10 })).toBeNull()
  })
})

describe('reading API errors', () => {
  const body = (detail: unknown) => ({ response: { data: { detail } } })

  it('finds which texts were not found', () => {
    expect(missingTexts(body({ code: 'text_not_found', missing: ['a', 'b'] }))).toEqual(['a', 'b'])
    expect(missingTexts(body({ code: 'text_not_found' }))).toEqual([])
    expect(missingTexts(body('nope'))).toBeNull()
    expect(missingTexts(new Error('x'))).toBeNull()
  })

  it('turns string and structured details into a message', () => {
    expect(editErrorMessage(body('This PDF is a scan'), 'fallback')).toBe('This PDF is a scan')
    expect(editErrorMessage(body({ message: 'Some text was not found' }), 'fallback')).toBe('Some text was not found')
    expect(editErrorMessage(body({ code: 'x' }), 'fallback')).toBe('fallback')
    expect(editErrorMessage(undefined, 'fallback')).toBe('fallback')
  })
})

describe('trimming a selection', () => {
  it('moves the spaces a double-click picks up into the surrounding text', () => {
    const trimmed = trimSelection({ text: '1234 ', before: 'Phụ cấp ', after: 'theo' })
    expect(trimmed).toEqual({ text: '1234', before: 'Phụ cấp ', after: ' theo' })
    expect(trimSelection({ text: ' a ', before: 'x', after: 'y' })).toEqual({ text: 'a', before: 'x ', after: ' y' })
  })

  it('leaves a clean selection alone, and the same object', () => {
    const clean = { text: 'ab', before: '', after: '' }
    expect(trimSelection(clean)).toBe(clean)
  })
})
