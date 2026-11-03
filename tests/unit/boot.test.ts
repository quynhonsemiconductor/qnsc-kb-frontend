import { describe, expect, it, vi } from 'vitest'
import { boot } from '../../src/boot'
import { renderStartupError } from '../../src/startup-error'

/** The smallest element `renderStartupError` needs, so `boot` can run without a DOM package. */
interface FakeElement {
  tagName: string
  textContent: string
  type?: string
  style: { cssText: string }
  dataset: Record<string, string>
  children: FakeElement[]
  setAttribute(name: string, value: string): void
  append(...children: FakeElement[]): void
  addEventListener(type: string, listener: () => void): void
}

function fakeElement(tagName: string): FakeElement {
  return {
    tagName,
    textContent: '',
    style: { cssText: '' },
    dataset: {},
    children: [],
    setAttribute() {},
    append(...children) {
      this.children.push(...children)
    },
    addEventListener() {},
  }
}

function fakeRoot() {
  const replaced: FakeElement[][] = []
  const root = {
    ownerDocument: { createElement: (tag: string) => fakeElement(tag) },
    replaceChildren(...children: FakeElement[]) {
      replaced.push(children)
    },
  }
  return { root: root as unknown as HTMLElement, replaced }
}

const okFetch = () =>
  vi.fn<typeof fetch>(async () => new Response(JSON.stringify({ apiBaseUrl: '/api/v1' })))

describe('boot', () => {
  it('renders the app only after the config is applied', async () => {
    const { root, replaced } = fakeRoot()
    const render = vi.fn()
    const loadApp = vi.fn(async () => {
      // The app chunk sees the applied config, never the dev default.
      expect((await import('../../src/config/runtime')).getApiBaseUrl()).toBe('/api/v1')
      return { render }
    })

    await boot({ root, fetchImpl: okFetch(), loadApp })

    expect(loadApp).toHaveBeenCalledTimes(1)
    expect(render).toHaveBeenCalledWith(root)
    expect(replaced).toHaveLength(0)
  })

  it('shows the config error screen and never loads the app when /config.json fails', async () => {
    const { root, replaced } = fakeRoot()
    const loadApp = vi.fn(async () => ({ render: vi.fn() }))
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response('', { status: 404 }))

    await boot({ root, fetchImpl, loadApp })

    expect(loadApp).not.toHaveBeenCalled()
    expect(replaced).toHaveLength(1)
    expect(replaced[0]?.[0]?.dataset.testid).toBe('startup-error')
  })

  it('shows the app error screen when the app chunk fails to load', async () => {
    const { root, replaced } = fakeRoot()
    const loadApp = vi.fn(async () => {
      throw new Error('chunk gone')
    })

    await boot({ root, fetchImpl: okFetch(), loadApp })

    expect(replaced).toHaveLength(1)
    const screen = replaced[0]?.[0]
    expect(screen?.dataset.testid).toBe('startup-error')
    expect(screen?.children.some((child) => child.textContent === 'chunk gone')).toBe(true)
  })

  it('the startup error screen quotes the reason exactly once via textContent', () => {
    const { root, replaced } = fakeRoot()
    renderStartupError(root, new Error('<b>bad</b>'), 'description')
    const message = replaced[0]?.[0]?.children.find((child) => child.tagName === 'pre')
    expect(message?.textContent).toBe('<b>bad</b>')
  })
})
