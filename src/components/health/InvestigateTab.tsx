import React, { useState } from 'react'
import { RefreshCw } from 'lucide-react'
import {
  getInvestigateAi,
  getInvestigatePipeline,
  getInvestigateRequests,
  getWorkerDiagnostics,
  type Level,
  type PipelinePayload,
  type RequestsPayload,
  type WorkerDiagnostics,
} from '../../api/investigate'
import { Button } from '../ui/Button'
import { Skeleton } from '../ui/Skeleton'
import { useLanguage } from '../../i18n/LanguageProvider'
import { usePanelData, type PanelState } from '../../hooks/usePanelData'
import { usePolling } from '../../hooks/usePolling'
import { WINDOW_OPTIONS, worstLevel, type WindowHours } from '../../lib/investigate'
import { AiPanel } from './AiSection'
import { RequestLookup } from './FailureDetails'
import { PipelinePanel, WorkersPanel } from './OperationsSection'
import { AsyncBoundary, Card, LevelBadge, Section, Segmented } from './Primitives'
import { FailureGroups, RequestsChart, RequestStats, SlowRoutes } from './RequestsSection'

const REFRESH_MS = 30_000

function scrollToSection(id: string) {
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  document.getElementById(id)?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
}

interface Finding { key: string; label: string; target: string }

/**
 * One answer to "is something wrong, and where do I look": the worst level across traffic, background
 * work and workers, with each cause as a link to the part of the page that shows it.
 */
export function StatusBanner({
  requests,
  pipeline,
  workers,
}: {
  requests: PanelState<RequestsPayload>
  pipeline: PanelState<PipelinePayload>
  /** Optional: the overview does not ask for workers, because that call waits for them to answer. */
  workers?: PanelState<WorkerDiagnostics>
}) {
  const { t } = useLanguage()
  const panels = [requests, pipeline, ...(workers ? [workers] : [])]
  if (!panels.some((panel) => panel.data !== null)) {
    return panels.every((panel) => panel.loading) ? <Skeleton variant="rectangular" height="4.5rem" /> : null
  }

  // `healthy` already counts a busy consumer as fine: a backlog being drained is not a fault.
  const workerLevel: Level | undefined = workers?.data ? (workers.data.healthy ? 'ok' : 'critical') : undefined
  const level = worstLevel([requests.data?.verdict.level, pipeline.data?.attention.level, workerLevel])

  const findings: Finding[] = [
    ...(requests.data?.verdict.reasons ?? [])
      .filter((code) => code !== 'no_traffic')
      .map((code) => ({ key: `r-${code}`, label: t(`health.reason.${code}`), target: 'investigate-requests' })),
    ...(workerLevel === 'critical' && workers?.data
      ? [{ key: 'w', label: t(`health.worker.verdict.${workers.data.verdict}`), target: 'investigate-workers' }]
      : []),
    ...(pipeline.data?.attention.codes ?? []).map((code) => ({
      key: `p-${code}`,
      label: t(`health.attention.${code}`),
      target: 'investigate-pipeline',
    })),
  ]
  const noTraffic = requests.data?.verdict.reasons.includes('no_traffic') ?? false
  const failedPanels = panels.filter((panel) => panel.data === null && panel.error !== null).length

  return (
    <Card className="space-y-3">
      <div className="flex flex-wrap items-center gap-3">
        <LevelBadge level={level}>{t(`health.level.${level}`)}</LevelBadge>
        <p className="text-body-sm text-foreground">
          {level === 'ok' ? t('health.banner.ok') : t('health.banner.attention', { count: findings.length })}
        </p>
      </div>
      {findings.length > 0 && (
        <ul className="flex flex-wrap gap-2">
          {findings.map((finding) => (
            <li key={finding.key}>
              <button
                type="button"
                onClick={() => scrollToSection(finding.target)}
                className="rounded-md border border-border bg-surface px-2.5 py-1 text-caption font-semibold text-foreground transition-colors hover:border-primary/40 hover:text-primary-text"
              >
                {finding.label}
              </button>
            </li>
          ))}
        </ul>
      )}
      {noTraffic && <p className="text-caption text-muted-foreground">{t('health.reason.no_traffic')}</p>}
      {failedPanels > 0 && <p className="text-caption text-warning-text">{t('health.banner.partial', { count: failedPanels })}</p>}
    </Card>
  )
}

export function InvestigateTab({
  windowHours,
  onWindowChange,
  requestId,
  onRequestSearched,
}: {
  windowHours: WindowHours
  onWindowChange: (hours: WindowHours) => void
  requestId: string
  onRequestSearched: (id: string) => void
}) {
  const { t } = useLanguage()
  const [tick, setTick] = useState(0)
  const [auto, setAuto] = useState(false)
  const refresh = () => setTick((value) => value + 1)
  usePolling(refresh, REFRESH_MS, auto)

  const key = String(windowHours)
  const requests = usePanelData(() => getInvestigateRequests(windowHours), `requests-${key}`, tick)
  const ai = usePanelData(() => getInvestigateAi(windowHours), `ai-${key}`, tick)
  const pipeline = usePanelData(getInvestigatePipeline, 'pipeline', tick)
  const workers = usePanelData(getWorkerDiagnostics, 'workers', tick)

  const busy = [requests, ai, pipeline, workers].some((panel) => panel.refreshing || (panel.loading && panel.data === null))
  const updatedAt = Math.max(0, ...[requests, ai, pipeline, workers].map((panel) => panel.updatedAt ?? 0))

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3">
          <Segmented
            ariaLabel={t('health.window.label')}
            value={windowHours}
            onChange={onWindowChange}
            options={WINDOW_OPTIONS.map((hours) => ({ value: hours, label: t(`health.window.${hours}`) }))}
          />
          <label className="flex cursor-pointer items-center gap-2 text-body-sm text-muted-foreground">
            <input type="checkbox" checked={auto} onChange={(event) => setAuto(event.target.checked)} className="h-4 w-4 accent-primary" />
            {t('health.autoRefresh', { seconds: REFRESH_MS / 1000 })}
          </label>
        </div>
        <div className="flex items-center gap-3">
          {updatedAt > 0 && (
            <span className="text-caption text-muted-foreground">{t('health.updatedAt', { time: new Date(updatedAt).toLocaleTimeString() })}</span>
          )}
          <Button variant="secondary" size="sm" onClick={refresh} icon={<RefreshCw size={14} className={busy ? 'animate-spin' : ''} />}>
            {t('health.refresh')}
          </Button>
        </div>
      </div>

      <StatusBanner requests={requests} pipeline={pipeline} workers={workers} />

      <div id="investigate-requests" className="scroll-mt-24">
        <Section id="requests" eyebrow={t('health.requests.eyebrow')} title={t('health.requests.title')} description={t('health.requests.description')}>
          <AsyncBoundary state={requests} onRetry={() => void requests.reload()} skeleton={<Skeleton variant="rectangular" height="14rem" />}>
            {(data) => (
              <div className="space-y-6">
                <RequestStats data={data} />
                <RequestsChart data={data} />
                <div className="space-y-2">
                  <h3 className="text-body-sm font-bold text-foreground">{t('health.groups.title')}</h3>
                  <p className="text-caption text-muted-foreground">{t('health.groups.description')}</p>
                  <FailureGroups data={data} tick={tick} />
                </div>
                <div className="space-y-2">
                  <h3 className="text-body-sm font-bold text-foreground">{t('health.slow.title')}</h3>
                  <SlowRoutes data={data} />
                </div>
                <p className="text-caption text-muted-foreground">{t('health.requests.excludes', { paths: data.excludes.join(', '), days: data.retention_days })}</p>
              </div>
            )}
          </AsyncBoundary>
        </Section>
      </div>

      <div id="investigate-lookup" className="scroll-mt-24">
        <Section id="lookup" eyebrow={t('health.lookup.eyebrow')} title={t('health.lookup.title')} description={t('health.lookup.description')}>
          <RequestLookup initial={requestId} retentionDays={requests.data?.retention_days ?? null} onSearched={onRequestSearched} />
        </Section>
      </div>

      <div id="investigate-workers" className="scroll-mt-24">
        <Section id="workers" eyebrow={t('health.workers.eyebrow')} title={t('health.workers.title')} description={t('health.workers.description')}>
          <AsyncBoundary state={workers} onRetry={() => void workers.reload()}>
            {(data) => <WorkersPanel data={data} />}
          </AsyncBoundary>
        </Section>
      </div>

      <div id="investigate-pipeline" className="scroll-mt-24">
        <Section id="pipeline" eyebrow={t('health.pipeline.eyebrow')} title={t('health.pipeline.title')} description={t('health.pipeline.description')}>
          <AsyncBoundary state={pipeline} onRetry={() => void pipeline.reload()}>
            {(data) => <PipelinePanel data={data} />}
          </AsyncBoundary>
        </Section>
      </div>

      <div id="investigate-ai" className="scroll-mt-24">
        <Section id="ai" eyebrow={t('health.ai.eyebrow')} title={t('health.ai.title')} description={t('health.ai.description')}>
          <AsyncBoundary state={ai} onRetry={() => void ai.reload()} skeleton={<Skeleton variant="rectangular" height="10rem" />}>
            {(data) => <AiPanel data={data} />}
          </AsyncBoundary>
        </Section>
      </div>
    </div>
  )
}
