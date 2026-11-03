import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  CONFIG_PATH,
  ConfigError,
  DEFAULT_API_BASE_URL,
  applyConfig,
  configSchema,
  getApiBaseUrl,
  loadConfig,
} from '../../src/config/runtime'

/** A fetch stub that answers `body` with `status`; `body` undefined answers invalid JSON. */
function responding(body: unknown, status = 200) {
  return vi.fn<typeof fetch>(async () =>
    new Response(body === undefined ? 'not json' : JSON.stringify(body), {
      status,
      headers: { 'content-type': 'application/json' },
    }),
  )
}

describe('runtime config', () => {
  beforeEach(() => {
    applyConfig({ apiBaseUrl: DEFAULT_API_BASE_URL })
  })

  it('fetches /config.json with no-store and validates it', async () => {
    const fetchImpl = responding({ apiBaseUrl: '/api/v1' })

    await expect(loadConfig(fetchImpl)).resolves.toEqual({ apiBaseUrl: '/api/v1' })

    expect(fetchImpl).toHaveBeenCalledTimes(1)
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(url).toBe(CONFIG_PATH)
    expect(init?.cache).toBe('no-store')
    expect(init?.headers).toEqual({ accept: 'application/json' })
  })

  it('applies the fetched config to the API base URL', async () => {
    await loadConfig(responding({ apiBaseUrl: '/kb-api' }))
    expect(getApiBaseUrl()).toBe('/kb-api')
  })

  it('falls back to the dev default when the config names the same origin', async () => {
    await loadConfig(responding({ apiBaseUrl: '' }))
    expect(getApiBaseUrl()).toBe(DEFAULT_API_BASE_URL)
  })

  it('reports a non-2xx answer as a ConfigError naming the status', async () => {
    await expect(loadConfig(responding({}, 404))).rejects.toThrow(ConfigError)
    await expect(loadConfig(responding({}, 404))).rejects.toThrow('HTTP 404')
  })

  it('reports an unreachable config as a ConfigError', async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError('Failed to fetch')
    })
    await expect(loadConfig(fetchImpl)).rejects.toThrow(/Could not fetch .*Failed to fetch/)
  })

  it('reports a body that is not JSON as a ConfigError', async () => {
    await expect(loadConfig(responding(undefined))).rejects.toThrow('is not valid JSON')
  })

  it('rejects a config that would send the app cross-origin', async () => {
    for (const apiBaseUrl of ['https://api.example.com/v1', '//evil.example.com', '/\\evil']) {
      await expect(loadConfig(responding({ apiBaseUrl }))).rejects.toThrow(ConfigError)
    }
  })

  it('rejects a missing apiBaseUrl', async () => {
    await expect(loadConfig(responding({}))).rejects.toThrow('is invalid')
  })

  it('keeps the applied config unchanged when loading fails', async () => {
    applyConfig({ apiBaseUrl: '/api/v1' })
    await expect(loadConfig(responding({}, 500))).rejects.toThrow(ConfigError)
    expect(getApiBaseUrl()).toBe('/api/v1')
  })

  it('accepts only a relative path or the empty same-origin value', () => {
    expect(configSchema.safeParse({ apiBaseUrl: '/api/v1' }).success).toBe(true)
    expect(configSchema.safeParse({ apiBaseUrl: '' }).success).toBe(true)
    expect(configSchema.safeParse({ apiBaseUrl: 'api/v1' }).success).toBe(false)
    expect(configSchema.safeParse({ apiBaseUrl: 1 }).success).toBe(false)
  })
})
