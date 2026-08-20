import React, { createContext, useEffect, useRef, useState } from 'react'
import { readStoredUser, useAuthStore } from '../store/authStore'
import { logoutSession } from '../api/auth'
import { getAccessToken, refreshSession } from '../api/client'

interface AuthContextType {
  isAuthenticated: boolean
  loading: boolean
  user: any
  login: (token: string, user: any, refreshToken?: string) => void
  logout: () => void | Promise<void>
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const logoutInProgress = useRef(false)
  const { token, user, setAuth, clearAuth } = useAuthStore()

  useEffect(() => {
    if (token) {
      setLoading(false)
      return
    }
    if (logoutInProgress.current) {
      setLoading(false)
      return
    }
    void refreshSession().then((ok) => {
      const refreshedUser = readStoredUser()
      const refreshedToken = getAccessToken()
      if (ok && refreshedToken && refreshedUser) setAuth(refreshedToken, refreshedUser)
    }).finally(() => setLoading(false))
  }, [token])

  const login = (token: string, user: any, refreshToken?: string) => {
    logoutInProgress.current = false
    setAuth(token, user, refreshToken)
  }

  const logout = async () => {
    // Clearing local state triggers the authentication bootstrap effect. Keep
    // that effect from renewing the still-active refresh cookie before the
    // logout response has had a chance to clear it.
    logoutInProgress.current = true
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
    <AuthContext.Provider value={{ isAuthenticated: !!token, loading, user, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
