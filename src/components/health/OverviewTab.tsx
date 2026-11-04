import React from 'react'
import { Activity, AlertTriangle, BarChart3, HelpCircle, Layers, Search, ShieldCheck, TrendingUp } from 'lucide-react'
import { getHealthMetrics } from '../../api/governance'
import { getInvestigatePipeline, getInvestigateRequests } from '../../api/investigate'
import { Button } from '../ui/Button'
import { Skeleton } from '../ui/Skeleton'
import { useLanguage } from '../../i18n/LanguageProvider'
import { usePanelData } from '../../hooks/usePanelData'
import { AsyncBoundary, Card, Section, StatCard } from './Primitives'
import { RequestStats } from './RequestsSection'
import { StatusBanner } from './InvestigateTab'

interface HealthMetrics {
  total_articles: number
  percent_with_owner?: number
  percent_overdue?: number
  open_gaps: number
  helpful_rate?: number
  search_miss_rate?: number
  api_error_rate?: number
  api_p95_latency_ms?: number
  ai_tokens_total?: number
  ai_requests?: number
  dependencies?: {
    r2?: { configured?: boolean }
    sharepoint?: { configured?: boolean; active_connectors?: number }
    connectors?: { configured?: boolean; active_connectors?: number }
    indexing?: { pending_or_failed_articles?: number }
    llm?: { configured?: boolean }
  }
}

function Dependencies({ metrics }: { metrics: HealthMetrics }) {
  const { t } = useLanguage()
  const deps = metrics.dependencies
  if (!deps) return null
  // `connectors` counts every remote provider; `sharepoint` is the older key with the same shape,
  // kept as a fallback so a not-yet-deployed API does not render this card as "no active connector".
  const connectors = deps.connectors ?? deps.sharepoint
  const pending = Number(deps.indexing?.pending_or_failed_articles || 0)
  const items = [
    {
      label: t('health.dep.r2'),
      healthy: Boolean(deps.r2?.configured),
      status: deps.r2?.configured ? t('health.dep.configured') : t('health.dep.needsConfig'),
      detail: t('health.dep.r2Detail'),
    },
    {
      label: t('health.dep.connectors'),
      healthy: Boolean(connectors?.configured),
      status: connectors?.configured ? t('health.dep.configured') : t('health.dep.noConnector'),
      detail: t('health.dep.connectorsDetail', { count: connectors?.active_connectors ?? 0 }),
    },
    {
      label: t('health.dep.indexing'),
      healthy: pending === 0,
      status: pending === 0 ? t('health.dep.clear') : t('health.dep.attention'),
      detail: t('health.dep.indexingDetail', { count: pending }),
    },
    {
      label: t('health.dep.llm'),
      healthy: Boolean(deps.llm?.configured),
      status: deps.llm?.configured ? t('health.dep.configured') : t('health.dep.needsConfig'),
      detail: t('health.dep.llmDetail'),
    },
  ]
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => (
        <Card key={item.label}>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-semibold text-foreground">{item.label}</span>
            <span className={`h-2.5 w-2.5 rounded-full ${item.healthy ? 'bg-success' : 'bg-warning'}`} aria-label={item.healthy ? t('health.dep.healthy') : t('health.dep.attention')} />
          </div>
          <p className={`mt-3 text-xs font-semibold ${item.healthy ? 'text-success-text' : 'text-warning-text'}`}>{item.status}</p>
          <p className="mt-1 text-xs text-muted-foreground">{item.detail}</p>
        </Card>
      ))}
    </div>
  )
}

function AllTime({ metrics }: { metrics: HealthMetrics }) {
  const { t } = useLanguage()
  const pct = (value: number | undefined, digits = 0) => (value === undefined ? '—' : `${value.toFixed(digits)}%`)
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <StatCard label={t('health.all.articles')} value={metrics.total_articles} icon={<Layers size={16} />} detail={t('health.all.articlesDetail')} />
      <StatCard label={t('health.all.owner')} value={pct(metrics.percent_with_owner)} valueClassName="text-success-text" icon={<ShieldCheck size={16} className="text-success-text" />} detail={t('health.all.ownerDetail')} />
      <StatCard label={t('health.all.overdue')} value={pct(metrics.percent_overdue)} valueClassName="text-destructive-text" icon={<AlertTriangle size={16} className="text-destructive-text" />} detail={t('health.all.overdueDetail')} />
      <StatCard label={t('health.all.gaps')} value={metrics.open_gaps} valueClassName="text-warning-text" icon={<HelpCircle size={16} className="text-warning-text" />} detail={t('health.all.gapsDetail')} />
      <StatCard label={t('health.all.helpful')} value={pct(metrics.helpful_rate)} valueClassName="text-primary-text" icon={<TrendingUp size={16} className="text-primary-text" />} detail={t('health.all.helpfulDetail')} />
      <StatCard label={t('health.all.miss')} value={pct(metrics.search_miss_rate)} valueClassName="text-warning-text" icon={<Search size={16} className="text-warning-text" />} detail={t('health.all.missDetail')} />
      <StatCard label={t('health.all.errorRate')} value={pct(metrics.api_error_rate, 1)} valueClassName="text-destructive-text" icon={<AlertTriangle size={16} className="text-destructive-text" />} detail={t('health.all.errorRateDetail')} />
      <StatCard label={t('health.all.p95')} value={metrics.api_p95_latency_ms === undefined ? '—' : `${metrics.api_p95_latency_ms.toFixed(0)}ms`} valueClassName="text-primary-text" icon={<Activity size={16} className="text-primary-text" />} detail={t('health.all.p95Detail')} />
      <StatCard label={t('health.all.tokens')} value={metrics.ai_tokens_total?.toLocaleString() ?? '—'} valueClassName="text-warning-text" icon={<BarChart3 size={16} className="text-warning-text" />} detail={t('health.all.tokensDetail', { count: metrics.ai_requests || 0 })} />
    </div>
  )
}

export function OverviewTab({ tick, onInvestigate }: { tick: number; onInvestigate: () => void }) {
  const { t } = useLanguage()
  const metrics = usePanelData<HealthMetrics>(getHealthMetrics, 'metrics', tick)
  const requests = usePanelData(() => getInvestigateRequests(24), 'overview-requests', tick)
  const pipeline = usePanelData(getInvestigatePipeline, 'overview-pipeline', tick)

  return (
    <div className="space-y-8">
      <Section
        id="now"
        eyebrow={t('health.now.eyebrow')}
        title={t('health.now.title')}
        description={t('health.now.description')}
        actions={<Button variant="secondary" size="sm" onClick={onInvestigate} icon={<Search size={14} />}>{t('health.now.investigate')}</Button>}
      >
        <div className="space-y-4">
          <StatusBanner requests={requests} pipeline={pipeline} />
          <AsyncBoundary state={requests} onRetry={() => void requests.reload()} skeleton={<Skeleton variant="rectangular" height="8rem" />}>
            {(data) => <RequestStats data={data} />}
          </AsyncBoundary>
        </div>
      </Section>

      <Section id="all-time" eyebrow={t('health.all.eyebrow')} title={t('health.all.title')} description={t('health.all.description')}>
        <AsyncBoundary state={metrics} onRetry={() => void metrics.reload()} skeleton={<Skeleton variant="rectangular" height="10rem" />}>
          {(data) => <AllTime metrics={data} />}
        </AsyncBoundary>
      </Section>

      {metrics.data?.dependencies && (
        <Section id="dependencies" eyebrow={t('health.dep.eyebrow')} title={t('health.dep.title')} description={t('health.dep.description')}>
          <Dependencies metrics={metrics.data} />
        </Section>
      )}
    </div>
  )
}
