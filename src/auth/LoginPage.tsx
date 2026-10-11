import React, { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { BookOpen, Mail, Monitor, ShieldCheck, Sparkles } from 'lucide-react'
import { useAuth } from './useAuth'
import { BrandMarkGlyph } from '../components/ui/BrandMark'
import { getMicrosoftLoginUrl, getOidcConfig, login as loginApi } from '../api/auth'
import { useLanguage } from '../i18n/LanguageProvider'
import { apiErrorStatus, userMessage } from '../lib/error-handler'
import { useTheme, type ThemePreference } from '../theme/ThemeProvider'
import { Select } from '../components/ui/Select'
import { Button } from '../components/ui/Button'
import { Input } from '../components/ui/Input'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ssoLoading, setSsoLoading] = useState(false)
  const [ssoAvailable, setSsoAvailable] = useState(false)
  const { login, isAuthenticated, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sessionExpired = searchParams.get('expired') === '1'
  const { language, setLanguage, t } = useLanguage()
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    getOidcConfig().then(config => setSsoAvailable(Boolean(config.entra_enabled))).catch(() => setSsoAvailable(false))
  }, [])

  useEffect(() => {
    if (!authLoading && isAuthenticated) navigate('/', { replace: true })
  }, [authLoading, isAuthenticated, navigate])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setLoading(true)
    try {
      const loginData = await loginApi({ username: email, password })
      login(loginData.access_token, loginData.user)
      navigate('/')
    } catch (err: unknown) {
      setError(apiErrorStatus(err) === 401 ? t('auth.invalidCredentials') : userMessage(err, t))
    } finally { setLoading(false) }
  }

  const handleMicrosoftLogin = async () => {
    setError('')
    setSsoLoading(true)
    try {
      const { authorization_url } = await getMicrosoftLoginUrl()
      window.location.assign(authorization_url)
    } catch (err: unknown) {
      setError(userMessage(err, t))
      setSsoLoading(false)
    }
  }

  return <div className="grid min-h-screen bg-background lg:grid-cols-[minmax(24rem,.9fr)_minmax(32rem,1.1fr)]">
    <aside className="relative hidden overflow-hidden bg-primary px-12 py-10 text-primary-foreground lg:flex lg:flex-col xl:px-16">
      <div className="flex items-center gap-3"><BrandMarkGlyph className="h-11 w-11" title="QNSC" /><div><p className="font-display text-body-lg font-bold">QNSC Knowledge</p><p className="font-mono text-caption uppercase tracking-[.12em] text-white/55">Enterprise knowledge workspace</p></div></div>
      <div className="my-auto max-w-lg">
        <p className="font-mono text-caption uppercase tracking-[.12em] text-white/55">Trusted company knowledge</p>
        <h1 className="mt-5 font-display text-5xl font-bold leading-[1.08] tracking-[-.045em] text-white">Find the right document. Ask grounded AI. Keep knowledge governed.</h1>
        <p className="mt-6 max-w-md text-body-lg leading-7 text-white/65">One workspace for approved documents, source-aware answers, and controlled publishing across every department.</p>
        <div className="mt-10 border-t border-white/15">
          <div className="flex items-center gap-3 border-b border-white/15 py-4"><BookOpen size={17} className="text-[#c7eb72]" /><div><strong className="block text-body-sm">Document-first discovery</strong><span className="text-body-sm text-white/55">Browse by department, topic and approved source.</span></div></div>
          <div className="flex items-center gap-3 border-b border-white/15 py-4"><Sparkles size={17} className="text-[#c7eb72]" /><div><strong className="block text-body-sm">Agent assistance</strong><span className="text-body-sm text-white/55">Answers remain connected to accessible evidence.</span></div></div>
          <div className="flex items-center gap-3 border-b border-white/15 py-4"><ShieldCheck size={17} className="text-[#c7eb72]" /><div><strong className="block text-body-sm">Governed publishing</strong><span className="text-body-sm text-white/55">Review, ownership and permissions stay explicit.</span></div></div>
        </div>
      </div>
      <p className="text-caption text-white/45">A private knowledge system for QNSC teams.</p>
    </aside>

    <main className="relative flex min-h-screen items-center justify-center px-5 py-20 sm:px-8 lg:px-12">
      <div className="absolute right-5 top-5 flex items-center gap-2"><label className="hidden items-center gap-1.5 text-caption font-semibold text-muted-foreground sm:flex"><Monitor size={13} /><Select value={theme} onChange={event => setTheme(event.target.value as ThemePreference)} className="theme-select" aria-label="Appearance"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></Select></label><Select value={language} onChange={event => setLanguage(event.target.value as 'en' | 'vi')} className="theme-select" aria-label={t('language.switch')}><option value="en">English</option><option value="vi">Tiếng Việt</option></Select></div>
      <form onSubmit={handleSubmit} className="w-full max-w-lg rounded-panel border border-border bg-surface-elevated p-6 shadow-popover sm:p-8">
        <div className="mb-8 lg:hidden"><div className="mb-6 flex items-center gap-3"><BrandMarkGlyph className="h-10 w-10" title="QNSC" /><div><p className="font-display text-body font-bold text-foreground">QNSC Knowledge</p><p className="font-mono text-caption uppercase tracking-[.12em] text-muted">Enterprise workspace</p></div></div></div>
        <div className="mb-8"><span className="mb-4 inline-flex items-center gap-2 font-mono text-caption font-medium uppercase tracking-[.1em] text-primary-text"><ShieldCheck size={14} />Secure sign in</span><h2 className="font-display text-3xl font-bold tracking-[-.035em] text-foreground">Welcome back.</h2><p className="mt-2 text-body leading-6 text-muted-foreground">{language === 'vi' ? 'Sử dụng tài khoản công ty được cấp.' : 'Sign in to continue to your knowledge workspace.'}</p></div>
        {sessionExpired && !error && <div className="mb-5 rounded-surface border border-info/20 bg-info/10 p-3 text-body-sm text-info-text">{t('auth.sessionExpired')}</div>}
        {error && <div className="mb-5 rounded-surface border border-destructive/20 bg-destructive/10 p-3 text-body-sm text-destructive-text">{error}</div>}
        <div className="space-y-4">
          {ssoAvailable && <><Button type="button" variant="secondary" size="lg" onClick={() => void handleMicrosoftLogin()} disabled={ssoLoading} loading={ssoLoading} icon={!ssoLoading ? <span className="grid h-4 w-4 grid-cols-2 gap-0.5"><span className="bg-[#f25022]" /><span className="bg-[#7fba00]" /><span className="bg-[#00a4ef]" /><span className="bg-[#ffb900]" /></span> : undefined} className="w-full">{ssoLoading ? 'Redirecting…' : t('auth.signInMicrosoft')}</Button><div className="flex items-center gap-3 font-mono text-caption uppercase tracking-[.1em] text-muted"><span className="h-px flex-1 bg-border" />{t('auth.or')}<span className="h-px flex-1 bg-border" /></div></>}
          <Input type="email" label={t('auth.email')} value={email} onChange={event => setEmail(event.target.value)} placeholder="name@company.com" required leftIcon={<Mail size={15} />} />
          <Input type="password" label={t('auth.password')} value={password} onChange={event => setPassword(event.target.value)} required />
          <Button type="submit" variant="primary" size="lg" disabled={loading} loading={loading} icon={!loading ? <Mail size={15} /> : undefined} className="mt-3 w-full">{loading ? t('auth.signingIn') : t('auth.signInEmail')}</Button>
          <p className="text-center"><Link to="/forgot-password" className="text-body-sm font-semibold text-primary no-underline hover:underline">{t('auth.forgotPassword')}</Link></p>
        </div>
        <p className="mt-7 border-t border-border pt-5 text-center text-caption leading-5 text-muted">Accounts are created by an Admin or CEO. Microsoft SSO appears when Entra ID is configured.</p>
      </form>
    </main>
  </div>
}
