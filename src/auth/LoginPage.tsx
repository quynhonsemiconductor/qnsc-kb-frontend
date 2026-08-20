import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowUpRight, Mail, Monitor, ShieldCheck, Sparkles } from 'lucide-react'
import { useAuth } from './useAuth'
import { getMicrosoftLoginUrl, getOidcConfig, login as loginApi } from '../api/auth'
import { useLanguage } from '../i18n/LanguageProvider'
import { useTheme, type ThemePreference } from '../theme/ThemeProvider'
import { Select } from '../components/ui/Select'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [ssoLoading, setSsoLoading] = useState(false)
  const [ssoAvailable, setSsoAvailable] = useState(false)
  const { login } = useAuth()
  const { isAuthenticated, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const sessionExpired = searchParams.get('expired') === '1'
  const { language, setLanguage, t } = useLanguage()
  const { theme, setTheme } = useTheme()

  useEffect(() => {
    getOidcConfig()
      .then((config) => setSsoAvailable(Boolean(config.entra_enabled)))
      .catch(() => setSsoAvailable(false))
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
      login(loginData.access_token, loginData.user, loginData.refresh_token)
      navigate('/')
    } catch (err: any) {
      setError(err.response?.data?.detail || t('auth.invalidCredentials'))
    } finally {
      setLoading(false)
    }
  }

  const handleMicrosoftLogin = async () => {
    setError('')
    setSsoLoading(true)
    try {
      const { authorization_url } = await getMicrosoftLoginUrl()
      window.location.assign(authorization_url)
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Microsoft sign-in is unavailable.')
      setSsoLoading(false)
    }
  }

  return <div className="relative min-h-screen overflow-hidden bg-background lg:grid lg:grid-cols-[1.1fr_.9fr]">
    <div className="pointer-events-none absolute -left-40 -top-48 h-[560px] w-[560px] rounded-full bg-primary/20 blur-3xl" /><div className="pointer-events-none absolute -bottom-56 right-[-8rem] h-[520px] w-[520px] rounded-full bg-info/10 blur-3xl" />
    <section className="soft-grid relative hidden min-h-screen flex-col justify-between overflow-hidden border-r border-border px-10 py-10 lg:flex xl:px-16">
      <div className="relative flex items-center gap-3"><span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-info via-primary to-primary-strong text-sm font-extrabold text-primary-foreground shadow-[0_12px_24px_rgb(var(--primary)/.3)]">Q</span><div><p className="font-display text-sm font-extrabold tracking-tight text-foreground">QNSC</p><p className="text-[9px] font-bold uppercase tracking-[.2em] text-stone">Knowledge workspace</p></div></div>
      <div className="relative max-w-xl pb-8"><div className="mb-6 inline-flex items-center gap-2 rounded-full border border-success/25 bg-success/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[.15em] text-success"><span className="h-1.5 w-1.5 rounded-full bg-success shadow-[0_0_10px_rgb(var(--success)/.7)]" /> Trusted by your team</div><h1 className="font-display text-5xl font-extrabold leading-[1.02] tracking-[-.06em] text-foreground xl:text-6xl">Turn scattered<br /><span className="text-info">knowledge into momentum.</span></h1><p className="mt-6 max-w-md text-base leading-7 text-muted-foreground">One calm workspace for finding answers, publishing trusted guidance, and keeping every department moving in the same direction.</p><div className="mt-10 grid max-w-lg grid-cols-3 gap-3"><div className="rounded-2xl border border-border bg-surface/60 p-4"><Sparkles size={16} className="text-warning" /><p className="mt-4 text-sm font-bold text-foreground">AI grounded</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">Answers tied to real sources.</p></div><div className="rounded-2xl border border-border bg-surface/60 p-4"><ShieldCheck size={16} className="text-success" /><p className="mt-4 text-sm font-bold text-foreground">Access aware</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">Every team sees what matters.</p></div><div className="rounded-2xl border border-border bg-surface/60 p-4"><ArrowUpRight size={16} className="text-info" /><p className="mt-4 text-sm font-bold text-foreground">Always current</p><p className="mt-1 text-[11px] leading-4 text-muted-foreground">Review keeps knowledge alive.</p></div></div></div>
      <div className="pointer-events-none absolute right-8 top-[10%] hidden h-56 w-56 xl:block"><div className="hero-orb h-full w-full"><div className="orbit-ring" /><div className="orbit-ring" style={{ inset: '8%', transform: 'rotate(-34deg) skewX(13deg)', animationDuration: '21s' }} /><div className="orb-core">Q</div><div className="float-card absolute right-0 top-2 rounded-xl border border-info/25 bg-surface-elevated/80 px-3 py-2 shadow-xl backdrop-blur-md"><p className="font-mono text-[9px] font-bold tracking-[.16em] text-info">LIVE INDEX</p><p className="mt-1 text-xs font-bold text-foreground">Knowledge synced</p></div><div className="float-card absolute -bottom-4 left-0 rounded-xl border border-primary/25 bg-surface-elevated/80 px-3 py-2 shadow-xl backdrop-blur-md" style={{ animationDelay: '-2s' }}><p className="font-mono text-[9px] font-bold tracking-[.16em] text-primary-muted">RAG / 24·7</p><p className="mt-1 text-xs font-bold text-foreground">Answers grounded</p></div></div></div>
      <p className="relative text-xs font-medium text-stone">A private knowledge system for QNSC teams.</p>
    </section>
    <section className="relative flex min-h-screen items-center justify-center px-5 py-24 sm:px-8 lg:px-12">
      <div className="absolute right-5 top-5 flex items-center gap-2"><label className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground"><Monitor size={13} /><Select value={theme} onChange={event => setTheme(event.target.value as ThemePreference)} className="theme-select" aria-label="Appearance"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></Select></label><Select value={language} onChange={event => setLanguage(event.target.value as 'en' | 'vi')} className="theme-select" aria-label={t('language.switch')}><option value="en">English</option><option value="vi">Tiếng Việt</option></Select></div>
      <form onSubmit={handleSubmit} className="login-panel glass-panel w-full max-w-xl rounded-panel border border-border p-6 shadow-[0_20px_56px_rgb(var(--shadow)/.16)] sm:p-8">
        <div className="mb-8"><span className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/10 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[.14em] text-primary"><ShieldCheck size={14} /> Secure sign in</span><h2 className="font-display text-3xl font-extrabold tracking-[-.04em] text-foreground">Welcome back.</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{language === 'vi' ? 'Sử dụng tài khoản công ty được cấp.' : 'Sign in to continue to your knowledge workspace.'}</p></div>
        {sessionExpired && !error && <div className="mb-5 rounded-xl border border-info/20 bg-info/10 p-3 text-sm text-info">{t('auth.sessionExpired')}</div>}
        {error && <div className="mb-5 rounded-xl border border-rose-500/20 bg-rose-500/10 p-3 text-sm text-destructive">{error}</div>}
        <div className="space-y-4">
          {ssoAvailable && <>
            <button type="button" onClick={() => void handleMicrosoftLogin()} disabled={ssoLoading} className="flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-surface py-3.5 text-sm font-bold text-foreground transition hover:bg-surface-soft disabled:cursor-wait disabled:opacity-50"><span className="grid h-4 w-4 grid-cols-2 gap-0.5"><span className="bg-[#f25022]" /><span className="bg-[#7fba00]" /><span className="bg-[#00a4ef]" /><span className="bg-[#ffb900]" /></span>{ssoLoading ? 'Redirecting…' : t('auth.signInMicrosoft')}</button>
            <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-[.14em] text-stone"><span className="h-px flex-1 bg-border" />{t('auth.or')}<span className="h-px flex-1 bg-border" /></div>
          </>}
          <label className="block text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">{t('auth.email')}<input type="email" value={email} onChange={e => setEmail(e.target.value)} className="field mt-2" placeholder="name@company.com" required /></label><label className="block text-xs font-bold uppercase tracking-[.12em] text-muted-foreground">{t('auth.password')}<input type="password" value={password} onChange={e => setPassword(e.target.value)} className="field mt-2" required /></label><button disabled={loading} className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-[0_10px_22px_rgb(var(--primary)/.24)] transition hover:-translate-y-0.5 hover:bg-primary/90 disabled:opacity-50"><Mail size={15} />{loading ? t('auth.signingIn') : t('auth.signInEmail')}</button>
        </div>
        <p className="mt-7 border-t border-border pt-5 text-center text-xs leading-relaxed text-muted">Accounts are created by an Admin or CEO. Microsoft SSO will appear here when Entra ID is configured.</p>
      </form>
    </section>
  </div>
}
