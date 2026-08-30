import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api/v1'
let accessToken: string | null = null

const client = axios.create({
  baseURL: API_BASE_URL,
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
  accessToken = null
  localStorage.removeItem('user')
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

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config as (typeof error.config & { _authRetry?: boolean }) | undefined
    const requestUrl = String(request?.url || '')
    // A 401 from a credential endpoint is the ANSWER, not an expired session: /auth/login
    // rejects bad credentials and /auth/password/change rejects a wrong current password.
    // Refreshing and retrying those would hide the real message and, on failure, sign the
    // user out for mistyping a field.
    const isCredentialRequest = ['/auth/login', '/auth/register', '/auth/oidc', '/auth/entra', '/auth/password/'].some((path) => requestUrl.includes(path))
    if (error.response?.status === 401 && request && !request._authRetry && !requestUrl.includes('/auth/refresh') && !requestUrl.includes('/auth/logout') && !isCredentialRequest) {
      request._authRetry = true
      if (await refreshSession()) {
        request.headers = request.headers || {}
        request.headers.Authorization = `Bearer ${accessToken}`
        return client(request)
      }
      clearExpiredSession()
    }
    return Promise.reject(error)
  },
)

export default client
