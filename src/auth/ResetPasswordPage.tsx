import React, { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ArrowLeft, CheckCircle2, KeyRound } from 'lucide-react'
import { resetPassword } from '../api/auth'
import { useLanguage } from '../i18n/LanguageProvider'
import { AuthShell } from './AuthShell'
import { PasswordRules } from '../components/ui/PasswordRules'
import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH, validatePasswordPair } from '../lib/password'
import { apiErrorDetail, apiErrorStatus } from '../lib/error-handler'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export default function ResetPasswordPage() {
  const { t } = useLanguage()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') || ''
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [done, setDone] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const backLink = (
    <Link to="/login" className="mt-7 flex items-center justify-center gap-1.5 border-t border-border pt-5 text-sm font-semibold text-primary no-underline hover:underline">
      <ArrowLeft size={14} /> {t('auth.backToSignIn')}
    </Link>
  )

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const problem = validatePasswordPair(password, confirmation)
    if (problem) {
      setError(t(problem, { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_BYTES }))
      return
    }
    setError('')
    setLoading(true)
    try {
      await resetPassword({ token, password })
      setDone(true)
    } catch (err: unknown) {
      const status = apiErrorStatus(err)
      // 410 is the expected end of a stale link; anything else is a real fault.
      setError(status === 410 ? t('auth.resetTokenInvalid') : apiErrorDetail(err) || t('auth.genericError'))
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <AuthShell title={t('auth.resetTitle')}>
        <div role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm leading-6 text-destructive">{t('auth.resetTokenMissing')}</div>
        {backLink}
      </AuthShell>
    )
  }

  // Every session is revoked server-side, so there is no way to land the user in the app
  // from here: signing in again is the only correct next step.
  if (done) {
    return (
      <AuthShell title={t('auth.resetDoneTitle')}>
        <div role="status" className="flex items-start gap-3 rounded-xl border border-success/25 bg-success/10 p-4 text-sm leading-6 text-success">
          <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
          <p>{t('auth.resetDoneBody')}</p>
        </div>
        <Link to="/login" className="mt-5 block">
          <Button type="button" variant="primary" size="lg" className="w-full rounded-xl">{t('auth.signIn')}</Button>
        </Link>
      </AuthShell>
    )
  }

  return (
    <AuthShell eyebrow={t('auth.changePassword')} title={t('auth.resetTitle')} subtitle={t('auth.resetSubtitle')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-destructive">{error}</div>}
        <Input
          type="password"
          label={t('auth.newPassword')}
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
        <Button type="submit" variant="primary" size="lg" disabled={loading} loading={loading} className="w-full rounded-xl shadow-[0_10px_22px_rgb(var(--primary)/.24)]">
          {loading ? t('auth.saving') : t('auth.setPassword')}
        </Button>
      </form>
      {backLink}
    </AuthShell>
  )
}
