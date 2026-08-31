import React from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../auth/useAuth'
import { useLanguage } from '../i18n/LanguageProvider'

interface ProtectedRouteProps {
  children: React.ReactNode
  permission?: string
}

/**
 * Route-level gate. A UX affordance, not an access control.
 *
 * Everything this component decides with is client state, so a determined user can reach any
 * screen behind it by editing memory or calling the route directly. What actually protects
 * the data is `require_permission` on the backend endpoint: a mounted admin page whose every
 * request 403s shows nothing. The value here is not sending people to screens that cannot
 * work for them.
 *
 * That said, the permissions used to come from the `user` localStorage key, which meant a
 * one-line devtools edit produced a fully rendered admin UI — misleading enough to read as a
 * privilege escalation even though no data followed. So a permission gate now waits for the
 * server's own answer (`verified`, set by AuthProvider from GET /auth/me) before it admits
 * anyone. Unverified is treated as not-yet-known rather than as denied: the alternative
 * bounces every user to "/" for the length of one request on every cold load.
 */
export default function ProtectedRoute({ children, permission }: ProtectedRouteProps) {
  const { isAuthenticated, loading, user, verified } = useAuth()
  const { t } = useLanguage()

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-100">{t('common.loading')}</div>
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  if (permission) {
    // Held, not rendered, until the server has spoken. Rendering the page optimistically
    // from the cache and unmounting it on mismatch would flash real controls — and any
    // request the mounted page fires on the way past is a request made on the strength of
    // unverified permissions. A gated route is not on the hot path, so the wait is cheap.
    if (!verified) {
      return <div className="flex h-screen items-center justify-center bg-slate-950 text-slate-100">{t('common.loading')}</div>
    }
    if (!user?.permissions?.includes(permission)) {
      return <Navigate to="/" replace />
    }
  }

  return <>{children}</>
}
