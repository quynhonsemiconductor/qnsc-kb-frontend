import { AlertTriangle, ArrowLeft, Home, RotateCcw } from 'lucide-react'
import { isRouteErrorResponse, useNavigate, useRouteError } from 'react-router-dom'
import { Button } from '../components/ui/Button'
import { useLanguage } from '../i18n/LanguageProvider'

export default function RouteErrorPage() {
  const error = useRouteError()
  const navigate = useNavigate()
  const { t } = useLanguage()
  const status = isRouteErrorResponse(error) ? error.status : undefined

  return (
    <main className="grid min-h-dvh place-items-center bg-background px-4 py-12 text-foreground">
      <section className="w-full max-w-lg rounded-panel border border-border bg-surface-elevated p-6 text-center shadow-raised sm:p-8" role="alert">
        <span className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-destructive/10 text-destructive-text"><AlertTriangle size={22} /></span>
        <p className="mt-5 font-mono text-caption font-semibold uppercase tracking-[.12em] text-muted">{status ? `${status}` : t('error.unexpectedLabel')}</p>
        <h1 className="mt-2 text-h2 font-bold">{t('error.pageTitle')}</h1>
        <p className="mx-auto mt-3 max-w-md text-body leading-relaxed text-muted-foreground">{t('error.pageDescription')}</p>
        <div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row">
          <Button variant="primary" onClick={() => navigate(0)} icon={<RotateCcw size={15} />}>{t('common.retry')}</Button>
          <Button variant="secondary" onClick={() => navigate(-1)} icon={<ArrowLeft size={15} />}>{t('common.back')}</Button>
          <Button variant="ghost" onClick={() => navigate('/home', { replace: true })} icon={<Home size={15} />}>{t('nav.home')}</Button>
        </div>
      </section>
    </main>
  )
}
