import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * Hovering the notification bell, "Copy answer" or "Copy question" showed a solid white
 * box with nothing in it.
 *
 * The tooltip is an inverted chip: it paints `bg-foreground` and wrote its text in
 * `text-primary-foreground`. But index.css rewrites that class inside `@layer utilities`:
 *
 *     .text-slate-100, .text-slate-200, .text-primary-foreground, .text-ink {
 *       color: rgb(var(--foreground)) !important; }
 *
 * The block is not scoped to a theme, so it applies to both. Background and text
 * therefore resolved to the SAME token in both themes — a dark box in light mode, a white
 * box in dark mode, and invisible text in each.
 *
 * These are source assertions rather than rendered ones because this project runs vitest
 * without a DOM. The property they protect is real all the same: a foreground token used
 * as a background must be paired with a text token that nothing rewrites back to it.
 */

const read = (path: string) => readFileSync(resolve(__dirname, '../..', path), 'utf8')

/**
 * Comments stripped before matching. The note above the component explains the bug and
 * therefore names `text-primary-foreground`; matching the raw file found that sentence
 * and reported the fix as still broken. A test that reads its own documentation as code
 * is worse than no test, because it fails when correct and passes when the argument is
 * merely deleted.
 */
const code = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '')

const tooltip = code(read('src/components/ui/Tooltip.tsx'))
const css = read('src/index.css')

/** Classes index.css forcibly recolours to `--foreground` with `!important`. */
const forcedToForeground = (() => {
  const rule = css.match(/([^{}]*)\{\s*color:\s*rgb\(var\(--foreground\)\)\s*!important/)
  return rule ? rule[1].split(',').map(part => part.trim().replace(/^\./, '')) : []
})()

describe('tooltip contrast', () => {
  it('writes its text in the inverse of the surface it paints', () => {
    expect(tooltip).toContain('bg-foreground')
    expect(tooltip).toContain('text-background')
  })

  it('does not use a text class that index.css forces back to the background token', () => {
    expect(forcedToForeground.length).toBeGreaterThan(0)
    const used = forcedToForeground.filter(cls => tooltip.includes(cls))
    expect(used, `tooltip paints --foreground, so these collapse into it: ${used.join(', ')}`).toEqual([])
  })

  it('keeps that override unscoped, which is why the bug hit both themes', () => {
    // If this ever becomes theme-scoped the reasoning above changes, and the pairing
    // should be revisited rather than trusted.
    const utilities = css.slice(css.indexOf('@layer utilities'))
    expect(utilities).toContain('.text-primary-foreground')
  })
})
