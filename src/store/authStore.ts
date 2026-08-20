import { create } from 'zustand'
import { setAccessToken } from '../api/client'

interface AuthState {
  token: string | null
  refreshToken: string | null
  user: any | null
  setAuth: (token: string, user: any, refreshToken?: string) => void
  clearAuth: () => void
}

// localStorage can hold corrupt JSON (manual edits, quota truncation). Drop the
// entry instead of crashing hydration for every consumer.
export function readStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('user') || 'null')
  } catch {
    localStorage.removeItem('user')
    return null
  }
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  refreshToken: null,
  user: readStoredUser(),
  setAuth: (token, user, refreshToken) => {
    setAccessToken(token)
    localStorage.setItem('user', JSON.stringify(user))
    set({ token, refreshToken: null, user })
  },
  clearAuth: () => {
    localStorage.removeItem('user')
    setAccessToken(null)
    set({ token: null, refreshToken: null, user: null })
  }
}))
