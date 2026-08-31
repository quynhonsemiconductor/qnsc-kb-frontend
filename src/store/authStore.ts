import { create } from 'zustand'
// This module and api/client reference each other: the store owns the access token's
// lifetime, and the client's 401 handling has to be able to end a session. Both references
// live inside function bodies, never at module evaluation, so whichever module the bundler
// evaluates first, the other's bindings are in place before anything calls them.
import { setAccessToken } from '../api/client'
import { clearAsyncResourceCache } from '../hooks/useAsyncResource'

/**
 * The authenticated user as the UI consumes it — the subset of `UserResponse` that screens
 * actually read, all optional because it arrives from JSON this code did not construct.
 *
 * `permissions` and `permission_scopes` decide which affordances render. They are a UX
 * signal only: the server re-checks every permission on every request, so a tampered copy
 * of this object buys a user nothing but a screen that 403s.
 */
export type AuthUser = {
  id?: string
  email?: string
  name?: string
  role?: string
  roles?: Array<{ id?: string; name?: string }>
  dept?: string | null
  active?: boolean
  company_domain?: string
  permissions?: string[]
  permission_scopes?: Record<string, string>
  owned_departments?: Array<{ id?: string; name?: string }>
}

interface AuthState {
  token: string | null
  user: AuthUser | null
  setAuth: (token: string, user: AuthUser) => void
  clearAuth: () => void
}

// localStorage can hold corrupt JSON (manual edits, quota truncation) or a non-object left
// by an older build. Drop the entry instead of crashing hydration for every consumer, or
// handing them a string to read `.permissions` off.
export function readStoredUser(): AuthUser | null {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem('user') || 'null')
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null
    return parsed as AuthUser
  } catch {
    localStorage.removeItem('user')
    return null
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: readStoredUser(),
  // Both transitions drop the shared request cache, because it is keyed by endpoint and not
  // by user: signing out left `home-summary` and its neighbours resident in a module-level
  // Map, so the next person to sign in on the same tab saw the previous user's data until
  // their own request came back. Clearing on set as well as on clear also covers a login
  // that follows a session swap with no intervening logout.
  setAuth: (token, user) => {
    clearAsyncResourceCache()
    setAccessToken(token)
    localStorage.setItem('user', JSON.stringify(user))
    set({ token, user })
  },
  clearAuth: () => {
    clearAsyncResourceCache()
    localStorage.removeItem('user')
    setAccessToken(null)
    set({ token: null, user: null })
  }
}))
