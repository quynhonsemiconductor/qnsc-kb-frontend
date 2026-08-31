import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AxiosError } from 'axios'
import type { AxiosAdapter, InternalAxiosRequestConfig } from 'axios'
import client, { getAccessToken, refreshSession, setAccessToken } from '../../src/api/client'
import { retryAfterSeconds, userMessage } from '../../src/lib/error-handler'
import { useAuthStore } from '../../src/store/authStore'

/**
 * These tests drive the real interceptor chain through a stub axios ADAPTER rather than a
 * mocking library, because the behaviour under test IS the interceptor chain: single-flight
 * refresh, the two retry ceilings, and the status-to-message mapping. The adapter is the seam
 * axios itself provides, so nothing about the chain is simulated and the suite needs no new
 * dependency.
 *
 * The globals below are installed in `vi.hoisted`, which runs before the imports above are
 * evaluated. That ordering is required, not stylistic: the runner is vitest's default `node`
 * environment (vite.config.ts sets no `environment` and no DOM package is installed), and
 * authStore calls `readStoredUser()` while zustand's `create` is still evaluating — so
 * `localStorage` has to exist before the import, not before the first test.
 */
const { storedItems, scheduledDelays, locationStub } = vi.hoisted(() => {
  const items = new Map<string, string>()
  const delays: number[] = []
  const location = { pathname: '/dashboard', assign: vi.fn<(url: string) => void>() }

  Object.assign(globalThis, {
    localStorage: {
      getItem: (key: string) => items.get(key) ?? null,
      setItem: (key: string, value: string) => void items.set(key, value),
      removeItem: (key: string) => void items.delete(key),
      clear: () => items.clear(),
    },
    window: {
      location,
      // The requested delay is recorded and the callback runs on the microtask queue instead
      // of the clock. What matters is that the client waited for the interval the server ASKED
      // for; actually sleeping through it would buy nothing but a slower suite, and a
      // wall-clock wait is what makes a throttling test flake under load.
      setTimeout: (callback: () => void, delay?: number) => {
        delays.push(delay ?? 0)
        queueMicrotask(callback)
        return 0
      },
    },
  })

  return { storedItems: items, scheduledDelays: delays, locationStub: location }
})

type StubReply = [status: number, data?: unknown, headers?: Record<string, string>]
type StubRoute = (config: InternalAxiosRequestConfig) => StubReply | Promise<StubReply>

const routes = new Map<string, StubRoute>()

// Resolves or rejects exactly as the real adapter would for a given status, so the
// interceptors cannot tell they are not talking to a server.
const stubAdapter: AxiosAdapter = async (config) => {
  const route = routes.get(String(config.url))
  if (!route) throw new AxiosError(`no stub route for ${config.url}`, 'ERR_STUB', config)
  const [status, data, headers = {}] = await route(config)
  const response = { data, status, statusText: String(status), headers, config, request: {} }
  if (status >= 200 && status < 300) return response
  throw new AxiosError(`Request failed with status code ${status}`, 'ERR_BAD_RESPONSE', config, {}, response)
}

/**
 * Runs every continuation already queued, without advancing any clock.
 *
 * The 401 path schedules no timer at all — it is promise hops through the adapter and the
 * interceptor — so draining the microtask queue is enough to reach a known state, and unlike a
 * sleep it takes the same number of steps on a loaded CI box as on an idle laptop.
 */
async function drainMicrotasks() {
  for (let hop = 0; hop < 100; hop += 1) await Promise.resolve()
}

// The mapper picks a key; it does not translate. An echoing stub keeps these assertions
// independent of the Vietnamese copy in LanguageProvider.
const t = (key: string, variables?: Record<string, string | number>) =>
  variables ? `${key}:${JSON.stringify(variables)}` : key

beforeEach(() => {
  client.defaults.adapter = stubAdapter
  routes.clear()
  scheduledDelays.length = 0
  storedItems.clear()
  locationStub.pathname = '/dashboard'
  locationStub.assign.mockClear()
  setAccessToken(null)
  useAuthStore.setState({ token: null, user: null })
})

afterEach(() => {
  vi.useRealTimers()
})

describe('api client session refresh', () => {
  it('collapses concurrent 401s into exactly one refresh', async () => {
    let refreshCalls = 0
    // Executor form rather than `Promise.withResolvers`: tsconfig pins `lib: ES2022` and the
    // Docker build runs node:20-alpine, where that method does not exist.
    let openGate = () => {}
    const gate = new Promise<void>((resolve) => { openGate = resolve })
    routes.set('/auth/refresh', async () => {
      refreshCalls += 1
      // Held open until all three failures have reached refreshSession. A refresh that settled
      // at once could let them queue behind each other rather than overlap, and the test would
      // pass without ever exercising concurrency.
      await gate
      return [200, { access_token: 'fresh-token', user: { id: 'u1', permissions: [] } }]
    })
    // Each endpoint rejects once with 401 then succeeds: the shape of a request issued with an
    // expired access token and replayed with a fresh one.
    const served: Record<string, number> = { '/a': 0, '/b': 0, '/c': 0 }
    for (const path of Object.keys(served)) {
      routes.set(path, () => {
        served[path] += 1
        return served[path] === 1 ? [401, { detail: 'Token expired' }] : [200, { path }]
      })
    }

    const pending = Promise.all([client.get('/a'), client.get('/b'), client.get('/c')])
    await drainMicrotasks()
    openGate()
    const responses = await pending

    expect(responses.map((response) => response.data.path)).toEqual(['/a', '/b', '/c'])
    // Three simultaneous 401s must not each mint a session. Racing refreshes rotate the refresh
    // cookie concurrently, and a server that treats reuse as replay revokes the whole token
    // family — one stale tab would then sign the user out everywhere.
    expect(refreshCalls).toBe(1)
    expect(getAccessToken()).toBe('fresh-token')
  })

  it('retries a 401 once and then surfaces it, even while the refresh keeps succeeding', async () => {
    let refreshCalls = 0
    routes.set('/auth/refresh', () => {
      refreshCalls += 1
      return [200, { access_token: `token-${refreshCalls}`, user: { id: 'u1' } }]
    })
    // A server answering 401 forever is where a loop would come from: the refresh succeeds, so
    // the interceptor has every reason to try again, and would recurse until something gave out.
    let attempts = 0
    routes.set('/always-401', () => {
      attempts += 1
      return [401, { detail: 'nope' }]
    })

    await expect(client.get('/always-401')).rejects.toMatchObject({ response: { status: 401 } })

    expect(attempts).toBe(2) // the original plus exactly one replay
    expect(refreshCalls).toBe(1)
  })

  it('does not refresh when the 401 is the login endpoint answering', async () => {
    const refresh = vi.fn<StubRoute>(() => [200, { access_token: 'x' }])
    routes.set('/auth/refresh', refresh)
    routes.set('/auth/login', () => [401, { detail: 'Incorrect email or password' }])

    await expect(client.post('/auth/login')).rejects.toMatchObject({ response: { status: 401 } })

    // Refreshing here would trade the real message for a sign-out over a typo.
    expect(refresh).not.toHaveBeenCalled()
  })

  it('does not retain a failed refresh, so a recoverable session can come back', async () => {
    routes.set('/auth/refresh', () => [401, { detail: 'refresh cookie expired' }])

    await expect(refreshSession()).resolves.toBe(false)

    // A retained rejected promise would make every later refresh answer false forever, leaving a
    // full page reload as the only way back in.
    routes.set('/auth/refresh', () => [200, { access_token: 'second-chance' }])
    await expect(refreshSession()).resolves.toBe(true)
    expect(getAccessToken()).toBe('second-chance')
  })

  it('clears store auth when the session cannot be recovered', async () => {
    useAuthStore.setState({ token: 'stale-token', user: { id: 'u1', permissions: ['user.manage'] } })
    storedItems.set('user', JSON.stringify({ id: 'u1', permissions: ['user.manage'] }))
    routes.set('/auth/refresh', () => [401, { detail: 'gone' }])
    routes.set('/protected', () => [401, { detail: 'gone' }])

    await expect(client.get('/protected')).rejects.toMatchObject({ response: { status: 401 } })

    // Nulling only the module token left zustand authenticated, so a blocked or slow navigation
    // kept rendering a signed-in shell to someone with no session.
    expect(useAuthStore.getState().token).toBeNull()
    expect(useAuthStore.getState().user).toBeNull()
    expect(localStorage.getItem('user')).toBeNull()
    expect(locationStub.assign).toHaveBeenCalledWith('/login?expired=1')
  })
})

describe('api client throttling', () => {
  it('waits the interval the server asked for and replays the request once', async () => {
    let attempts = 0
    routes.set('/throttled', () => {
      attempts += 1
      return attempts === 1
        ? [429, { detail: 'Too Many Requests' }, { 'retry-after': '2' }]
        : [200, { ok: true }]
    })

    const response = await client.get('/throttled')

    expect(response.data).toEqual({ ok: true })
    expect(attempts).toBe(2)
    expect(scheduledDelays).toContain(2000) // the server's number, not a fixed backoff
  })

  it('gives up rather than looping when every attempt is throttled', async () => {
    let attempts = 0
    routes.set('/always-429', () => {
      attempts += 1
      return [429, { detail: 'Too Many Requests' }, { 'retry-after': '1' }]
    })

    await expect(client.get('/always-429')).rejects.toMatchObject({ response: { status: 429 } })

    expect(attempts).toBe(2)
  })

  it('hands a long Retry-After to the caller instead of hiding it behind a spinner', async () => {
    let attempts = 0
    routes.set('/slow-throttle', () => {
      attempts += 1
      return [429, { detail: 'Too Many Requests' }, { 'retry-after': '600' }]
    })

    const error = await client.get('/slow-throttle').catch((failure) => failure)

    expect(attempts).toBe(1) // ten minutes is not a wait to absorb behind a spinner
    expect(userMessage(error, t)).toBe('error.rateLimitedAfter:{"seconds":600}')
  })

  it('does not retry a 429 that arrived without Retry-After', async () => {
    let attempts = 0
    routes.set('/no-retry-after', () => {
      attempts += 1
      return [429, { detail: 'Too Many Requests' }]
    })

    const error = await client.get('/no-retry-after').catch((failure) => failure)

    expect(attempts).toBe(1)
    expect(userMessage(error, t)).toBe('error.rateLimited')
  })
})

describe('failure to user-facing message', () => {
  it('maps status classes to their own wording', () => {
    const failure = (status: number, detail?: string) => ({ response: { status, data: { detail } } })

    // A 403 detail names an internal permission key and a 5xx detail is a traceback. Neither is
    // for a user to read, so the status decides the message.
    expect(userMessage(failure(403, 'Missing permission: user.manage'), t)).toBe('error.forbidden')
    expect(userMessage(failure(429), t)).toBe('error.rateLimited')
    expect(userMessage(failure(500, 'Traceback (most recent call last)'), t)).toBe('error.server')
    expect(userMessage(failure(503), t)).toBe('error.server')
    expect(userMessage(failure(401), t)).toBe('error.sessionExpiredShort')
    // No response at all: offline, DNS, a blocked preflight. "Check your connection" is the
    // actionable half, and calling it a server error would be a guess.
    expect(userMessage(new Error('Network Error'), t)).toBe('error.network')
  })

  it('passes through a detail the endpoint meant for the caller', () => {
    // 409 and 422 answer a question the screen asked, so their detail IS the message.
    expect(userMessage({ response: { status: 409, data: { detail: 'Article changed since you opened it' } } }, t))
      .toBe('Article changed since you opened it')
    // FastAPI sends validation errors as an array, which is not user-readable.
    expect(userMessage({ response: { status: 422, data: { detail: [{ loc: ['body', 'visibility'] }] } } }, t))
      .toBe('error.unexpected')
  })

  it('reads Retry-After in both formats RFC 9110 allows', () => {
    expect(retryAfterSeconds({ response: { headers: { 'retry-after': '42' } } })).toBe(42)

    vi.useFakeTimers()
    vi.setSystemTime(new Date('2026-01-01T00:00:00Z'))
    expect(retryAfterSeconds({ response: { headers: { 'retry-after': 'Thu, 01 Jan 2026 00:00:30 GMT' } } })).toBe(30)
    // A date already past must not become a negative countdown the UI renders as "-5s".
    expect(retryAfterSeconds({ response: { headers: { 'retry-after': 'Thu, 01 Jan 2025 00:00:00 GMT' } } })).toBe(0)
    expect(retryAfterSeconds({ response: { headers: { 'retry-after': 'not a date' } } })).toBeUndefined()
    expect(retryAfterSeconds({ response: { headers: {} } })).toBeUndefined()
  })
})
