import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, Building2, CalendarClock, KeyRound, Mail, UserCheck } from 'lucide-react'
import { acceptInvitation, previewInvitation, type InvitationPreview } from '../api/auth'
import { useAuth } from './useAuth'
import { useLanguage } from '../i18n/LanguageProvider'
import { AuthShell } from './AuthShell'
import { PasswordRules } from '../components/ui/PasswordRules'
import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH, validatePasswordPair } from '../lib/password'
import { apiErrorDetail, apiErrorStatus } from '../lib/error-handler'
import { formatDateTime } from '../lib/formatters'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export default function AcceptInvitePage() {
  const { t } = useLanguage()
  const { login } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null)
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [previewLoading, setPreviewLoading] = useState(true)
  // A dead token (expired, used, revoked, unknown) is terminal: the form must not render,
  // which is a different state from a submit that merely failed and can be retried.
  const [tokenError, setTokenError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!token) {
      setTokenError(t('auth.invitationMissingToken'))
      setPreviewLoading(false)
      return
    }
    let active = true
    previewInvitation(token)
      .then((preview) => { if (active) setInvitation(preview) })
      .catch((err: unknown) => {
        if (!active) return
        const status = apiErrorStatus(err)
        setTokenError(status === 410 || status === 404 ? t('auth.invitationInvalid') : apiErrorDetail(err) || t('auth.genericError'))
      })
      .finally(() => { if (active) setPreviewLoading(false) })
    // An unmount mid-flight must not write state; the token is the only input.
    return () => { active = false }
  }, [token, t])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const problem = validatePasswordPair(password, confirmation)
    if (problem) {
      setError(t(problem, { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_BYTES }))
      return
    }
    setError('')
    setSubmitting(true)
    try {
      // Success returns exactly what POST /auth/login returns, so this is a login:
      // same store action, same landing, no second round trip to authenticate.
      const data = await acceptInvitation({ token, password })
      login(data.access_token, data.user)
      navigate('/')
    } catch (err: unknown) {
      const status = apiErrorStatus(err)
      if (status === 409) setTokenError(t('auth.invitationAccepted'))
      else if (status === 410) setTokenError(t('auth.invitationInvalid'))
      else setError(apiErrorDetail(err) || t('auth.genericError'))
    } finally {
      setSubmitting(false)
    }
  }

  const backLink = (
    <Link to="/login" className="mt-7 flex items-center justify-center gap-1.5 border-t border-border pt-5 text-sm font-semibold text-primary no-underline hover:underline">
      <ArrowLeft size={14} /> {t('auth.backToSignIn')}
    </Link>
  )

  if (previewLoading) {
    return (
      <AuthShell title={t('auth.acceptTitle')}>
        <div className="grid min-h-32 place-items-center text-sm text-muted-foreground">{t('auth.checkingInvitation')}</div>
      </AuthShell>
    )
  }

  if (tokenError || !invitation) {
    return (
      <AuthShell title={t('auth.acceptTitle')}>
        <div role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm leading-6 text-destructive">{tokenError || t('auth.invitationInvalid')}</div>
        {backLink}
      </AuthShell>
    )
  }

  return (
    <AuthShell eyebrow={t('auth.invitedAs')} title={t('auth.acceptTitle')} subtitle={t('auth.acceptSubtitle')}>
      <dl className="mb-6 space-y-2.5 rounded-2xl border border-border bg-card p-4 text-sm shadow-[0_10px_28px_rgb(var(--shadow)/.08)]">
        <div className="flex items-center gap-2.5">
          <UserCheck size={15} className="shrink-0 text-primary" aria-hidden="true" />
          <dt className="sr-only">{t('auth.invitedAs')}</dt>
          <dd className="min-w-0 flex-1 font-semibold text-foreground">{invitation.name}<Badge variant="primary" className="ml-2 align-middle">{invitation.role}</Badge></dd>
        </div>
        <div className="flex items-center gap-2.5">
          <Mail size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          <dt className="sr-only">{t('auth.email')}</dt>
          <dd className="min-w-0 flex-1 break-all text-muted-foreground">{invitation.email}</dd>
        </div>
        <div className="flex items-center gap-2.5">
          <Building2 size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          <dt className="sr-only">Company</dt>
          <dd className="min-w-0 flex-1 text-muted-foreground">{invitation.company_domain}</dd>
        </div>
        <div className="flex items-center gap-2.5">
          <CalendarClock size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          <dt className="sr-only">{t('auth.invitationExpires')}</dt>
          <dd className="min-w-0 flex-1 text-muted-foreground">{t('auth.invitationExpires')}: {formatDateTime(invitation.expires_at)}</dd>
        </div>
      </dl>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-destructive">{error}</div>}
        <Input
          type="password"
          label={t('auth.password')}
          value={password}
          onChange={event => setPassword(event.target.value)}
          required
          autoComplete="new-password"
          leftIcon={<KeyRound size={15} />}
        />
        <Input
          type="password"
          label={t('auth.confirmPassword')}
          value={confirmation}
          onChange={event => setConfirmation(event.target.value)}
          required
          autoComplete="new-password"
          leftIcon={<KeyRound size={15} />}
        />
        <PasswordRules password={password} confirmation={confirmation} />
        <Button type="submit" variant="primary" size="lg" disabled={submitting} loading={submitting} className="w-full rounded-xl shadow-[0_10px_22px_rgb(var(--primary)/.24)]">
          {submitting ? t('auth.activating') : t('auth.acceptSubmit')}
        </Button>
      </form>
      {backLink}
    </AuthShell>
  )
}
