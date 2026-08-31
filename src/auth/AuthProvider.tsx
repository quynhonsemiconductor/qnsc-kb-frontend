import React, { createContext, useCallback, useEffect, useRef, useState } from 'react'
import { readStoredUser, useAuthStore, type AuthUser } from '../store/authStore'
import { getMe, logoutSession } from '../api/auth'
import { getAccessToken, refreshSession } from '../api/client'

interface AuthContextType {
  isAuthenticated: boolean
  loading: boolean
  user: AuthUser | null
  /**
   * True once GET /auth/me has confirmed this session's identity and permissions.
   *
   * Until then `user` is whatever localStorage held, which the person at the keyboard can
   * edit. Route gates wait for this before refusing anyone, and before trusting anyone.
   */
  verified: boolean
  login: (token: string, user: AuthUser) => void
  logout: () => void | Promise<void>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [verified, setVerified] = useState(false)
  const logoutInProgress = useRef(false)
  const { token, user, setAuth, clearAuth } = useAuthStore()

  /**
   * Replace the cached user with the server's own answer.
   *
   * The stored `user` key is a rendering cache, not a fact: `permissions` read from it is
   * client-side state and any user can edit it in devtools to reveal an admin nav item and
   * mount an admin screen. So the session's real identity is fetched once per boot and the
   * result overwrites the cache. Overwriting matters more than the fetch — a stale or
   * tampered `permissions` array must not survive this, or the gate keeps honouring it.
   *
   * A failed call is deliberately not a logout. The request already passed through the 401
   * interceptor, so an unauthenticated session has been cleared by the time this rejects;
   * anything left (offline, a 5xx) is not evidence about who the user is, and signing
   * someone out over a flaky network is its own bug. `verified` stays false in that case,
   * which is what keeps the route gate from acting on unverified permissions.
   */
  const verifySession = useCallback(async (accessToken: string) => {
    try {
      const me: AuthUser = await getMe()
      setAuth(accessToken, me)
      setVerified(true)
    } catch {
      setVerified(false)
    }
  }, [setAuth])

  useEffect(() => {
    if (token) {
      void verifySession(token).finally(() => setLoading(false))
      return
    }
    if (logoutInProgress.current) {
      setLoading(false)
      return
    }
    void refreshSession().then(async (ok) => {
      const refreshedUser = readStoredUser()
      const refreshedToken = getAccessToken()
      // The refresh response carries a user, but it lands in localStorage the same way the
      // login response did, so it gets verified on the same footing rather than trusted.
      if (ok && refreshedToken && refreshedUser) await verifySession(refreshedToken)
    }).finally(() => setLoading(false))
  }, [token, verifySession])

  const login = (token: string, user: AuthUser) => {
    logoutInProgress.current = false
    // Optimistic: renders the app immediately from the login response. That payload came
    // straight off the wire rather than out of localStorage, but it is confirmed anyway by
    // the effect above, which `setAuth` retriggers — one code path decides what is verified.
    setVerified(false)
    setAuth(token, user)
  }

  const logout = async () => {
    // Clearing local state triggers the authentication bootstrap effect. Keep
    // that effect from renewing the still-active refresh cookie before the
    // logout response has had a chance to clear it.
    logoutInProgress.current = true
    setVerified(false)
    // Fire the server-side revocation before clearing local auth so the
    // request is already on the wire with the current session cookie.
    const logoutRequest = logoutSession().catch(() => undefined)
    clearAuth()
    // Wait briefly for the cookie to be cleared, but never strand the user if
    // the call hangs or fails.
    const timeout = new Promise<void>((resolve) => window.setTimeout(resolve, 3000))
    await Promise.race([logoutRequest, timeout])
    if (window.location.pathname !== '/login') window.location.assign('/login')
  }

  return (
    <AuthContext.Provider value={{ isAuthenticated: !!token, loading, user, verified, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
