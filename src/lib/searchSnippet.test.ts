import { describe, expect, it } from 'vitest'
import { highlightParts, searchTerms, tidySnippet } from './searchSnippet'

const hits = (text: string, query: string) =>
  highlightParts(text, searchTerms(query))
    .filter((part) => part.match)
    .map((part) => part.text)

describe('searchTerms', () => {
  it('keeps the words that carry the question and drops the filler', () => {
    expect(searchTerms('What is the PWM base address')).toEqual(['address', 'base', 'pwm'])
  })

  it('drops Vietnamese filler words but keeps the identifier', () => {
    expect(searchTerms('Địa chỉ base của GPIO0 là gì')).toEqual(['gpio0', 'base', 'dia', 'chi'])
  })

  it('keeps a short word that has a digit in it', () => {
    expect(searchTerms('I2C of M8')).toEqual(['i2c', 'm8'])
  })

  it('strips punctuation round a word and repeats nothing', () => {
    expect(searchTerms('"UART0", uart0; (UART0)?')).toEqual(['uart0'])
  })

  it('returns nothing for a blank query', () => {
    expect(searchTerms('   ')).toEqual([])
  })
})

describe('highlightParts', () => {
  it('marks every occurrence and keeps the text whole', () => {
    const text = 'UART0 base is 0x100; the UART0 console'
    const parts = highlightParts(text, searchTerms('uart0'))
    expect(parts.map((part) => part.text).join('')).toBe(text)
    expect(parts.filter((part) => part.match).map((part) => part.text)).toEqual(['UART0', 'UART0'])
  })

  it('ignores case', () => {
    expect(hits('Base Address', 'base address')).toEqual(['Base', 'Address'])
  })

  it('ignores accents the way the search does', () => {
    expect(hits('Địa chỉ base của GPIO', 'dia chi')).toEqual(['Địa', 'chỉ'])
    expect(hits('dia chi', 'Địa chỉ')).toEqual(['dia', 'chi'])
  })

  it('prefers the longer term where two start at the same place', () => {
    expect(hits('GPIO0 and GPIO', 'GPIO GPIO0')).toEqual(['GPIO0', 'GPIO'])
  })

  it('merges overlapping hits into one mark', () => {
    expect(hits('registers', 'regis gisters')).toEqual(['registers'])
  })

  it('leaves text with no hit as one part', () => {
    expect(highlightParts('nothing here', searchTerms('uart'))).toEqual([{ text: 'nothing here', match: false }])
  })

  it('has no parts to mark without terms or text', () => {
    expect(highlightParts('abc', [])).toEqual([{ text: 'abc', match: false }])
    expect(highlightParts('', ['abc'])).toEqual([{ text: '', match: false }])
  })

  it('keeps positions right after an emoji and a decomposed accent', () => {
    expect(hits('🙂 base', 'base')).toEqual(['base'])
    expect(hits('Địa chi base', 'base')).toEqual(['base'])
  })

  it('does not treat a regex character in the query as a pattern', () => {
    expect(hits('cost (a+b) total, aab', '(a+b)')).toEqual(['a+b'])
    expect(hits('a.b and a+b', 'a.b')).toEqual(['a.b'])
  })
})

describe('tidySnippet', () => {
  it('takes the heading marks off', () => {
    expect(tidySnippet('# 6. Register map\n\n### Quyết định\n\ntext')).toBe('6. Register map\n\nQuyết định\n\ntext')
  })

  it('takes emphasis marks off but not asterisks used otherwise', () => {
    expect(tidySnippet('a **bold** and __also__ b * c')).toBe('a bold and also b * c')
  })

  it('shows list items with a bullet', () => {
    expect(tidySnippet('- one\n* two')).toBe('• one\n• two')
  })

  it('keeps table rows as they are', () => {
    expect(tidySnippet('| a | b |\n|---|---|\n| 1 | 2 |')).toBe('| a | b |\n|---|---|\n| 1 | 2 |')
  })

  it('collapses runs of blank lines and trims', () => {
    expect(tidySnippet('\n\na   \n\n\n\nb\n')).toBe('a\n\nb')
  })

  it('does not take a hash that is not a heading', () => {
    expect(tidySnippet('issue #12 and C# code')).toBe('issue #12 and C# code')
  })
})
