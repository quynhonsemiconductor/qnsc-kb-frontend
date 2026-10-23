import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The deployed CSP says `object-src 'none'` (public/_headers), which blocks <embed>, <object>
 * and <applet>. A PDF shown through <embed> rendered as a blank pane in production while it
 * worked in development (no CSP there), so nothing failed in review. A frame is allowed
 * (`frame-src 'self' blob:`), so documents are shown with <iframe>.
 */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap(name => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? sources(path) : /\.(tsx?|jsx?)$/.test(name) ? [path] : []
  })
}

describe('plugin elements', () => {
  it('the CSP still forbids them, which is why none may be used', () => {
    expect(readFileSync('public/_headers', 'utf8')).toMatch(/object-src 'none'/)
  })

  it('are not used anywhere in the app', () => {
    const offenders = sources('src').filter(file => /<(embed|object|applet)[\s>/]/i.test(readFileSync(file, 'utf8')))
    expect(offenders).toEqual([])
  })
})
