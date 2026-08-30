import React, { useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, Mail, MailCheck } from 'lucide-react'
import { requestPasswordReset } from '../api/auth'
import { useLanguage } from '../i18n/LanguageProvider'
import { AuthShell } from './AuthShell'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'
import { apiErrorDetail } from '../lib/error-handler'

export default function ForgotPasswordPage() {
  const { t } = useLanguage()
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      await requestPasswordReset(email)
      // The endpoint answers 202 for unknown addresses on purpose, so this screen
      // deliberately cannot tell the caller whether the account exists.
      setSent(true)
    } catch (err: unknown) {
      // Only a transport or server fault reaches here; it says nothing about the account.
      setError(apiErrorDetail(err) || t('auth.genericError'))
    } finally {
      setLoading(false)
    }
  }

  const backLink = (
    <Link to="/login" className="mt-7 flex items-center justify-center gap-1.5 border-t border-border pt-5 text-sm font-semibold text-primary no-underline hover:underline">
      <ArrowLeft size={14} /> {t('auth.backToSignIn')}
    </Link>
  )

  if (sent) {
    return (
      <AuthShell title={t('auth.forgotSentTitle')}>
        <div role="status" className="flex items-start gap-3 rounded-xl border border-success/25 bg-success/10 p-4 text-sm leading-6 text-success">
          <MailCheck size={18} className="mt-0.5 shrink-0" />
          <p>{t('auth.forgotSentBody', { email })}</p>
        </div>
        {backLink}
      </AuthShell>
    )
  }

  return (
    <AuthShell eyebrow={t('auth.changePassword')} title={t('auth.forgotTitle')} subtitle={t('auth.forgotSubtitle')}>
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <div role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-destructive">{error}</div>}
        <Input
          type="email"
          label={t('auth.email')}
          value={email}
          onChange={event => setEmail(event.target.value)}
          placeholder="name@company.com"
          required
          autoComplete="email"
          leftIcon={<Mail size={15} />}
        />
        <Button type="submit" variant="primary" size="lg" disabled={loading} loading={loading} className="w-full rounded-xl shadow-[0_10px_22px_rgb(var(--primary)/.24)]">
          {loading ? t('auth.sending') : t('auth.sendResetLink')}
        </Button>
      </form>
      {backLink}
    </AuthShell>
  )
}
