import axios from 'axios'
import { useAuthStore } from '../store/authStore'
import { retryAfterSeconds } from '../lib/error-handler'

// No `|| '/api/v1'` fallback in a production build, deliberately. This app calls its API
// cross-origin on the Cloudflare Pages deploy, where the origin is baked in at build time
// (see .github/workflows/web-deploy.yml). A relative base there is not a degraded mode: it
// is answered by Pages' own SPA fallback, so every GET returns index.html with status 200
// and every POST returns 405 — the app looks healthy and cannot log in. Failing at module
// load turns a silent misbuild into an immediate, obvious one. The docker path passes the
// relative `/api/v1` explicitly via the Dockerfile ARG, so it is unaffected.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL
if (!API_BASE_URL && import.meta.env.PROD) {
  throw new Error('VITE_API_BASE_URL is required in a production build')
}

let accessToken: string | null = null

const client = axios.create({
  baseURL: API_BASE_URL || '/api/v1',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Single-flight refresh: concurrent 401s share one POST /auth/refresh instead
// of each firing their own request.
let refreshInFlight: Promise<boolean> | null = null

export function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const response = await client.post('/auth/refresh')
        accessToken = response.data.access_token
        if (response.data.user) {
          localStorage.setItem('user', JSON.stringify(response.data.user))
        } else {
          localStorage.removeItem('user')
        }
        return true
      } catch {
        return false
      } finally {
        refreshInFlight = null
      }
    })()
  }
  return refreshInFlight
}

export function clearExpiredSession() {
  // Through the store rather than by hand: clearing only the module token and localStorage
  // left zustand still holding `token` and `user`, so `isAuthenticated` stayed true and the
  // app kept rendering a signed-in shell whenever the navigation below was slow or blocked
  // (a popup-blocked assign, an unload handler, a test environment with no navigation).
  // `clearAuth` is the one path that clears all three, and it drops the request cache too.
  useAuthStore.getState().clearAuth()
  if (window.location.pathname !== '/login') window.location.assign('/login?expired=1')
}

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function getAccessToken() {
  return accessToken
}

client.interceptors.request.use((config) => {
  // Let the browser/Axios generate the multipart boundary for file uploads.
  if (typeof FormData !== 'undefined' && config.data instanceof FormData && config.headers) {
    delete config.headers['Content-Type']
  }
  if (accessToken && config.headers) {
    config.headers.Authorization = `Bearer ${accessToken}`
  }
  return config
})

// Longest `Retry-After` this client will sit and wait through before handing the failure to
// the caller. A throttle measured in minutes is not something to absorb silently behind a
// spinner — past this the user is told the number instead (error.rateLimitedAfter).
const MAX_RETRY_AFTER_SECONDS = 5

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config as (typeof error.config & { _authRetry?: boolean; _throttleRetry?: boolean }) | undefined
    const requestUrl = String(request?.url || '')
    const status = error.response?.status
    // A 401 from a credential endpoint is the ANSWER, not an expired session: /auth/login
    // rejects bad credentials and /auth/password/change rejects a wrong current password.
    // Refreshing and retrying those would hide the real message and, on failure, sign the
    // user out for mistyping a field.
    const isCredentialRequest = ['/auth/login', '/auth/register', '/auth/oidc', '/auth/entra', '/auth/password/'].some((path) => requestUrl.includes(path))
    if (status === 401 && request && !request._authRetry && !requestUrl.includes('/auth/refresh') && !requestUrl.includes('/auth/logout') && !isCredentialRequest) {
      request._authRetry = true
      if (await refreshSession()) {
        request.headers = request.headers || {}
        request.headers.Authorization = `Bearer ${accessToken}`
        return client(request)
      }
      clearExpiredSession()
    }
    // 429 is the only status worth retrying here, and only because the server said when.
    // A rate limiter rejects before doing any work, so the request is safe to repeat
    // regardless of method — unlike a 5xx, which may have applied its side effect already
    // and is therefore left to the caller. Once per request: `_throttleRetry` stops a
    // server that answers every attempt with 429 from turning this into an unbounded loop.
    if (status === 429 && request && !request._throttleRetry) {
      const seconds = retryAfterSeconds(error)
      if (seconds !== undefined && seconds <= MAX_RETRY_AFTER_SECONDS) {
        request._throttleRetry = true
        await new Promise((resolve) => window.setTimeout(resolve, seconds * 1000))
        return client(request)
      }
    }
    // 403 and 5xx get no transport handling on purpose: a 403 will not become a 200 by
    // being repeated, and a 5xx may have already applied its side effect. What they needed
    // was wording a user can act on, and that lives in `userMessage` in lib/error-handler
    // so one status class maps to one message everywhere instead of screens interpolating
    // whatever `detail` string the failing layer happened to produce.
    return Promise.reject(error)
  },
)

export default client
