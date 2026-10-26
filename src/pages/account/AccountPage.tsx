import React, { useCallback, useEffect, useState } from 'react'
import { Clock, Globe, KeyRound, Laptop, LogOut, Monitor, Save, ShieldCheck, Smartphone, UserCog } from 'lucide-react'
import {
  listMyActivity, listMySessions, revokeMySession, revokeOtherSessions, updateMyProfile,
  type AccountActivity, type AccountSession,
} from '../../api/auth'
import { getAccessToken, refreshSession } from '../../api/client'
import { useAuth } from '../../auth/useAuth'
import { ChangePasswordModal } from '../../auth/ChangePasswordModal'
import { readStoredUser } from '../../store/authStore'
import PageHeader from '../../components/ui/PageHeader'
import { PageTransition } from '../../components/ui/PageTransition'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { useDialog } from '../../components/ui/DialogProvider'
import { useToast } from '../../components/ui/Toast'
import { useLanguage } from '../../i18n/LanguageProvider'
import { useTheme, type ThemePreference } from '../../theme/ThemeProvider'
import { apiErrorDetail } from '../../lib/error-handler'
import { formatDateTime } from '../../lib/formatters'
import { activityKey, deviceLabel, initials, normalizeName } from '../../lib/account'
import { useAuthStore } from '../../store/authStore'

const card = 'rounded-surface border border-border bg-surface-elevated p-5'

function Section({ icon: Icon, title, hint, children, action }: {
  icon: typeof UserCog
  title: string
  hint?: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return <section className={card}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0">
        <h2 className="flex items-center gap-2 font-display text-h4 font-bold text-foreground"><Icon size={16} className="text-primary" />{title}</h2>
        {hint && <p className="mt-1 text-body-sm text-muted-foreground">{hint}</p>}
      </div>
      {action}
    </div>
    <div className="mt-4">{children}</div>
  </section>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0">
    <dt className="text-caption font-semibold uppercase tracking-wider text-muted">{label}</dt>
    <dd className="mt-0.5 break-words text-body-sm text-foreground">{children || '—'}</dd>
  </div>
}

export default function AccountPage() {
  const { user, login } = useAuth()
  const { language, setLanguage, t } = useLanguage()
  const { theme, setTheme } = useTheme()
  const { toast } = useToast()
  const dialog = useDialog()

  const [name, setName] = useState(user?.name || '')
  const [saving, setSaving] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [sessions, setSessions] = useState<AccountSession[] | null>(null)
  const [sessionsFailed, setSessionsFailed] = useState(false)
  const [activity, setActivity] = useState<AccountActivity[] | null>(null)
  const [busy, setBusy] = useState('')

  useEffect(() => { setName(user?.name || '') }, [user?.name])

  const loadSessions = useCallback(async () => {
    try { setSessions(await listMySessions()); setSessionsFailed(false) } catch { setSessionsFailed(true) }
  }, [])
  const loadActivity = useCallback(async () => {
    try { setActivity(await listMyActivity(20)) } catch { setActivity([]) }
  }, [])
  useEffect(() => { void loadSessions(); void loadActivity() }, [loadSessions, loadActivity])

  const cleaned = normalizeName(name)
  const dirty = cleaned !== (user?.name || '')

  const saveName = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!dirty || !cleaned) return
    setSaving(true)
    try {
      const me = await updateMyProfile({ name: cleaned })
      const token = getAccessToken() || useAuthStore.getState().token
      if (token) useAuthStore.getState().setAuth(token, me)
      toast('success', t('account.nameSaved'))
      void loadActivity()
    } catch (error) {
      toast('error', apiErrorDetail(error) || t('auth.genericError'))
    } finally {
      setSaving(false)
    }
  }

  const signOutDevice = async (session: AccountSession) => {
    const ok = await dialog.confirm(t('account.signOutDeviceConfirm'), { title: t('account.signOutDevice'), confirmLabel: t('account.signOutDevice'), tone: 'danger' })
    if (!ok) return
    setBusy(session.id)
    try {
      await revokeMySession(session.id)
      toast('success', t('account.deviceSignedOut'))
      await Promise.all([loadSessions(), loadActivity()])
    } catch (error) {
      toast('error', apiErrorDetail(error) || t('auth.genericError'))
    } finally {
      setBusy('')
    }
  }

  const signOutOthers = async () => {
    const ok = await dialog.confirm(t('account.signOutOthersConfirm'), { title: t('account.signOutOthers'), confirmLabel: t('account.signOutOthers'), tone: 'danger' })
    if (!ok) return
    setBusy('others')
    try {
      const result = await revokeOtherSessions()
      // The call bumped the account's auth version, so this tab's bearer is stale even
      // though the response set fresh cookies. Same trade as after a password change.
      if (await refreshSession()) {
        const token = getAccessToken()
        const me = readStoredUser()
        if (token && me) login(token, me)
      }
      toast('success', t('account.othersSignedOut', { count: result.revoked }))
      await Promise.all([loadSessions(), loadActivity()])
    } catch (error) {
      toast('error', apiErrorDetail(error) || t('auth.genericError'))
    } finally {
      setBusy('')
    }
  }

  const others = (sessions || []).filter(item => !item.current)
  const departments = user?.departments?.map(d => d.name).filter(Boolean).join(', ')

  return (
    <PageTransition className="page-shell page-stack">
      <PageHeader eyebrow={t('account.eyebrow')} title={t('account.title')} description={t('account.description')} icon={UserCog} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Section icon={UserCog} title={t('account.profile')} hint={t('account.managedNote')}>
          <div className="mb-4 flex items-center gap-3">
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-body font-bold text-primary-foreground">{initials(user?.name)}</div>
            <div className="min-w-0"><p className="truncate text-body font-bold text-foreground">{user?.name}</p><p className="truncate text-body-sm text-muted-foreground">{user?.email}</p></div>
          </div>
          <form onSubmit={saveName} className="space-y-3">
            <Input label={t('account.name')} value={name} onChange={event => setName(event.target.value)} maxLength={255} autoComplete="name" required />
            <Button type="submit" variant="primary" size="sm" icon={<Save size={14} />} loading={saving} disabled={!dirty || !cleaned}>{t('account.save')}</Button>
          </form>
          <dl className="mt-5 grid gap-3 border-t border-border pt-4 sm:grid-cols-2">
            <Field label={t('account.email')}>{user?.email}</Field>
            <Field label={t('account.role')}>{user?.role}</Field>
            <Field label={t('account.company')}>{user?.company_domain}</Field>
            <Field label={t('account.departments')}>{departments}</Field>
          </dl>
        </Section>

        <div className="space-y-4">
          <Section icon={ShieldCheck} title={t('account.security')} hint={t('auth.changePasswordHint')}>
            <Button type="button" variant="secondary" size="sm" icon={<KeyRound size={14} />} onClick={() => setPasswordOpen(true)}>{t('auth.changePassword')}</Button>
          </Section>

          <Section icon={Globe} title={t('account.preferences')}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-body-sm font-semibold text-foreground">{t('language.switch')}
                <Select value={language} onChange={event => setLanguage(event.target.value as 'en' | 'vi')} className="mt-1 w-full"><option value="en">English</option><option value="vi">Tiếng Việt</option></Select>
              </label>
              <label className="block text-body-sm font-semibold text-foreground">{t('account.appearance')}
                <Select value={theme} onChange={event => setTheme(event.target.value as ThemePreference)} className="mt-1 w-full"><option value="system">{t('account.themeSystem')}</option><option value="light">{t('account.themeLight')}</option><option value="dark">{t('account.themeDark')}</option></Select>
              </label>
            </div>
          </Section>
        </div>
      </div>

      <Section
        icon={Laptop}
        title={t('account.sessions')}
        hint={t('account.sessionsHint')}
        action={others.length > 0 ? <Button type="button" variant="secondary" size="sm" icon={<LogOut size={14} />} loading={busy === 'others'} onClick={() => void signOutOthers()}>{t('account.signOutOthers')}</Button> : undefined}
      >
        {sessionsFailed ? <p role="alert" className="text-body-sm text-destructive">{t('account.loadFailed')}</p>
          : !sessions ? <div className="h-16 animate-pulse rounded-lg bg-surface-muted" />
          : sessions.length === 0 ? <p className="text-body-sm text-muted-foreground">{t('account.noSessions')}</p>
          : <ul className="divide-y divide-border">
            {sessions.map(item => {
              const mobile = item.os === 'iOS' || item.os === 'Android'
              const Icon = mobile ? Smartphone : Monitor
              return <li key={item.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-muted text-muted-foreground"><Icon size={16} /></span>
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-body-sm font-semibold text-foreground">
                    {deviceLabel(item) || t('account.unknownDevice')}
                    {item.current && <span className="rounded-md bg-success/15 px-2 py-0.5 text-caption font-bold text-success-text">{t('account.thisDevice')}</span>}
                  </p>
                  <p className="mt-0.5 text-caption text-muted-foreground">
                    {[item.ip_address, t('account.lastActive', { when: formatDateTime(item.last_used_at) }), t('account.signedInAt', { when: formatDateTime(item.signed_in_at) })].filter(Boolean).join(' · ')}
                  </p>
                </div>
                {!item.current && <Button type="button" variant="ghost" size="sm" loading={busy === item.id} onClick={() => void signOutDevice(item)} className="text-destructive-text">{t('account.signOutDevice')}</Button>}
              </li>
            })}
          </ul>}
      </Section>

      <Section icon={Clock} title={t('account.activity')} hint={t('account.activityHint')}>
        {!activity ? <div className="h-16 animate-pulse rounded-lg bg-surface-muted" />
          : activity.length === 0 ? <p className="text-body-sm text-muted-foreground">{t('account.activityEmpty')}</p>
          : <ul className="divide-y divide-border">
            {activity.map(row => <li key={row.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 py-2.5">
              <p className="min-w-0 text-body-sm text-foreground">
                {t(activityKey(row.action))}
                {row.action === 'login' && row.method === 'microsoft' && <span className="text-muted-foreground"> · {t('account.viaMicrosoft')}</span>}
                {row.outcome !== 'success' && <span className="ml-2 rounded-md bg-destructive/10 px-1.5 py-0.5 text-caption font-bold text-destructive-text">{t('account.failed')}</span>}
                {(deviceLabel(row) || row.ip_address) && <span className="text-caption text-muted-foreground"> — {[deviceLabel(row), row.ip_address].filter(Boolean).join(' · ')}</span>}
              </p>
              <time className="shrink-0 text-caption text-muted">{formatDateTime(row.at)}</time>
            </li>)}
          </ul>}
      </Section>

      <ChangePasswordModal open={passwordOpen} onClose={() => { setPasswordOpen(false); void loadSessions(); void loadActivity() }} />
    </PageTransition>
  )
}
