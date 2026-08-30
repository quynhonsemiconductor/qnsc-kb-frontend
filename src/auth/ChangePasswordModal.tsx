import React, { useState } from 'react'
import { KeyRound } from 'lucide-react'
import { changePassword } from '../api/auth'
import { getAccessToken, refreshSession } from '../api/client'
import { readStoredUser } from '../store/authStore'
import { useAuth } from './useAuth'
import { useLanguage } from '../i18n/LanguageProvider'
import { PasswordRules } from '../components/ui/PasswordRules'
import { PASSWORD_MAX_BYTES, PASSWORD_MIN_LENGTH, validatePasswordPair } from '../lib/password'
import { apiErrorDetail, apiErrorStatus } from '../lib/error-handler'
import { Modal } from '../components/ui/Modal'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage()
  const { login } = useAuth()
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const close = () => {
    setCurrent(''); setPassword(''); setConfirmation(''); setError(''); setDone(false)
    onClose()
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    const problem = validatePasswordPair(password, confirmation)
    if (problem) {
      setError(t(problem, { min: PASSWORD_MIN_LENGTH, max: PASSWORD_MAX_BYTES }))
      return
    }
    setError('')
    setSaving(true)
    try {
      await changePassword({ current_password: current, new_password: password })
      // The change revokes every session, this one included: the in-memory bearer is now
      // stale even though the response set fresh cookies. Trading those cookies for a new
      // access token here keeps the user working instead of waiting for the next request
      // to 401 its way through the refresh interceptor.
      if (await refreshSession()) {
        const token = getAccessToken()
        const user = readStoredUser()
        if (token && user) login(token, user)
      }
      setDone(true)
      setCurrent(''); setPassword(''); setConfirmation('')
    } catch (err: unknown) {
      setError(apiErrorStatus(err) === 401 ? t('auth.currentPasswordWrong') : apiErrorDetail(err) || t('auth.genericError'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal open={open} onClose={close} title={t('auth.changePassword')} size="sm">
      {done ? (
        <div className="space-y-5">
          <div role="status" className="rounded-xl border border-success/25 bg-success/10 p-3 text-sm leading-6 text-success">{t('auth.changePasswordDone')}</div>
          <Button type="button" variant="primary" onClick={close} className="w-full">Done</Button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm leading-6 text-muted-foreground">{t('auth.changePasswordHint')}</p>
          {error && <div role="alert" className="rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-destructive">{error}</div>}
          <Input
            type="password"
            label={t('auth.currentPassword')}
            value={current}
            onChange={event => setCurrent(event.target.value)}
            required
            autoComplete="current-password"
            leftIcon={<KeyRound size={15} />}
          />
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
          <div className="flex gap-2">
            <Button type="button" variant="secondary" onClick={close} className="flex-1">Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving} loading={saving} className="flex-1">
              {saving ? t('auth.saving') : t('auth.changePassword')}
            </Button>
          </div>
        </form>
      )}
    </Modal>
  )
}
