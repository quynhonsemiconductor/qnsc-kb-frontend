import { useEffect, useState } from 'react'
import { Check, Copy } from 'lucide-react'
import { getServerBuild } from '../../api/system'
import { useLanguage } from '../../i18n/LanguageProvider'
import {
  BACKEND_REPO,
  FRONTEND_REPO,
  buildReport,
  commitUrl,
  describeBuild,
  frontendBuild,
  shortCommit,
  type BuildInfo,
} from '../../lib/buildInfo'
import { formatDateTime } from '../../lib/formatters'

type ServerState = { status: 'loading' } | { status: 'error' } | { status: 'ready'; build: BuildInfo }

function Row({ label, build, repo, atLabel }: { label: string; build: BuildInfo; repo: string; atLabel: string }) {
  const { t } = useLanguage()
  const url = commitUrl(repo, build.commit)
  const text = describeBuild(build)
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="text-caption text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right text-caption font-semibold text-foreground">
        {url
          ? <a href={url} target="_blank" rel="noreferrer" className="font-mono">{text}</a>
          : <span className="font-mono">{text}{!shortCommit(build.commit) && <span className="font-sans font-normal text-muted-foreground"> · {t('build.noCommit')}</span>}</span>}
        {build.at && <span className="block text-[0.6875rem] font-normal text-muted-foreground">{atLabel} {formatDateTime(build.at)}</span>}
      </dd>
    </div>
  )
}

/**
 * The two builds behind this screen, so "is it deployed yet" is answered by looking. The
 * commit is the part that changes with every merge; the release number only moves when
 * release-please cuts a release.
 */
export function BuildInfoPanel() {
  const { t } = useLanguage()
  const [server, setServer] = useState<ServerState>({ status: 'loading' })
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let live = true
    getServerBuild()
      .then(build => { if (live) setServer({ status: 'ready', build }) })
      .catch(() => { if (live) setServer({ status: 'error' }) })
    return () => { live = false }
  }, [])

  const backend = server.status === 'ready' ? server.build : null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(buildReport(frontendBuild, backend))
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable (insecure context, denied): the numbers are still on screen */
    }
  }

  return (
    <section aria-label={t('build.title')} data-testid="build-info" className="border-t border-border px-4 py-3">
      <div className="mb-1.5 flex items-center justify-between">
        <h3 className="text-caption font-bold uppercase tracking-wide text-muted-foreground">{t('build.title')}</h3>
        <button type="button" onClick={() => void copy()} className="inline-flex items-center gap-1 rounded text-caption font-semibold text-primary-text hover:underline">
          {copied ? <Check size={12} /> : <Copy size={12} />}{copied ? t('build.copied') : t('build.copy')}
        </button>
      </div>
      <dl className="space-y-1.5">
        <Row label={t('build.frontend')} build={frontendBuild} repo={FRONTEND_REPO} atLabel={t('build.builtAt')} />
        {server.status === 'ready' && <Row label={t('build.backend')} build={server.build} repo={BACKEND_REPO} atLabel={t('build.startedAt')} />}
        {server.status === 'loading' && <div className="text-caption text-muted-foreground">{t('build.backend')}: {t('build.loading')}</div>}
        {server.status === 'error' && <div className="text-caption text-muted-foreground">{t('build.backend')}: {t('build.unavailable')}</div>}
      </dl>
      {backend?.environment && <p className="mt-1.5 text-[0.6875rem] text-muted-foreground">{backend.environment}</p>}
    </section>
  )
}
