import React, { useMemo, useState } from 'react'
import { Activity, AlertTriangle, Gauge, Layers } from 'lucide-react'
import type { FailureGroup, RequestsPayload } from '../../api/investigate'
import { Badge } from '../ui/Badge'
import { useLanguage } from '../../i18n/LanguageProvider'
import { formatDateTime } from '../../lib/formatters'
import {
  bucketLabel,
  formatCount,
  formatDuration,
  formatRate,
  groupKey,
} from '../../lib/investigate'
import { GroupFailures, statusVariant } from './FailureDetails'
import { TimeSeriesChart, type ChartSeries } from './TimeSeriesChart'
import { Card, Delta, EmptyNote, Sparkline, StatCard } from './Primitives'

export function RequestStats({ data }: { data: RequestsPayload }) {
  const { t } = useLanguage()
  const none = t('health.noComparison')
  const requests = data.series.map((point) => point.requests)
  const errors = data.series.map((point) => (point.requests > 0 ? (point.server_errors / point.requests) * 100 : null))
  const latency = data.series.map((point) => point.p95_ms)
  const errorHot = data.current.error_rate >= 1
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <StatCard
        label={t('health.stat.requests')}
        value={formatCount(data.current.requests)}
        icon={<Layers size={16} />}
        delta={<Delta change={data.delta.requests_pct} unit="%" worseWhen="none" noneLabel={none} />}
        spark={<Sparkline values={requests} className="stroke-primary" />}
        detail={t('health.stat.requestsDetail', { previous: formatCount(data.previous.requests) })}
      />
      <StatCard
        label={t('health.stat.errorRate')}
        value={formatRate(data.current.error_rate, 2)}
        valueClassName={errorHot ? 'text-destructive-text' : 'text-success-text'}
        icon={<AlertTriangle size={16} className={errorHot ? 'text-destructive-text' : 'text-success-text'} />}
        delta={<Delta change={data.delta.error_rate_pp} unit="pp" worseWhen="up" noneLabel={none} />}
        spark={<Sparkline values={errors} className="stroke-destructive" />}
        detail={t('health.stat.errorRateDetail', { count: formatCount(data.current.server_errors) })}
      />
      <StatCard
        label={t('health.stat.p95')}
        value={formatDuration(data.current.p95_ms)}
        icon={<Gauge size={16} />}
        delta={<Delta change={data.delta.p95_pct} unit="%" worseWhen="up" noneLabel={none} />}
        spark={<Sparkline values={latency} className="stroke-warning" />}
        detail={t('health.stat.p95Detail', { p50: formatDuration(data.current.p50_ms), p99: formatDuration(data.current.p99_ms) })}
      />
      <StatCard
        label={t('health.stat.clientErrors')}
        value={formatCount(data.current.client_errors)}
        icon={<Activity size={16} />}
        detail={t('health.stat.clientErrorsDetail')}
      />
    </div>
  )
}

export function RequestsChart({ data }: { data: RequestsPayload }) {
  const { t, language } = useLanguage()
  const width = data.window.bucket_seconds
  const labels = useMemo(() => data.series.map((point) => bucketLabel(point.t, width, language)), [data.series, width, language])
  const series: ChartSeries[] = useMemo(
    () => [
      {
        id: 'requests',
        label: t('health.chart.requests'),
        kind: 'bar',
        values: data.series.map((point) => point.requests),
        className: 'fill-primary/35',
        swatchClassName: 'bg-primary/50',
        format: (value) => formatCount(value),
      },
      {
        id: 'errors',
        label: t('health.chart.serverErrors'),
        kind: 'bar',
        overlay: true,
        values: data.series.map((point) => point.server_errors),
        className: 'fill-destructive',
        swatchClassName: 'bg-destructive',
        format: (value) => formatCount(value),
      },
      {
        id: 'p95',
        label: t('health.chart.p95'),
        kind: 'line',
        axis: 'right',
        values: data.series.map((point) => point.p95_ms),
        className: 'stroke-warning',
        swatchClassName: 'bg-warning',
        format: (value) => formatDuration(value),
      },
    ],
    [data.series, t],
  )
  return (
    <Card>
      <TimeSeriesChart
        labels={labels}
        series={series}
        ariaLabel={t('health.chart.requestsAria', { hours: data.window.hours })}
        emptyText={t('health.chart.empty')}
        hint={t('health.chart.hint')}
        height={180}
      />
    </Card>
  )
}

const TH = 'p-3 font-semibold'

export function FailureGroups({
  data,
  tick,
}: {
  data: RequestsPayload
  tick: number
}) {
  const { t } = useLanguage()
  const [openKey, setOpenKey] = useState<string | null>(null)
  if (data.failure_groups.length === 0) {
    return <EmptyNote>{t('health.groupsNone')}</EmptyNote>
  }
  const toggle = (group: FailureGroup) => {
    const key = groupKey(group)
    setOpenKey((current) => (current === key ? null : key))
  }
  return (
    <div className="glass-panel overflow-x-auto rounded-2xl border border-border">
      <table className="w-full border-collapse text-left text-xs">
        <caption className="sr-only">{t('health.groupsCaption')}</caption>
        <thead>
          <tr className="border-b border-border bg-surface-muted uppercase tracking-wider text-muted-foreground">
            <th scope="col" className={TH}>{t('health.col.route')}</th>
            <th scope="col" className={TH}>{t('health.col.status')}</th>
            <th scope="col" className={TH}>{t('health.col.error')}</th>
            <th scope="col" className={`${TH} text-right`}>{t('health.col.count')}</th>
            <th scope="col" className={TH}>{t('health.col.lastSeen')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.failure_groups.map((group) => {
            const key = groupKey(group)
            const open = openKey === key
            return (
              <React.Fragment key={key}>
                <tr className={`transition-colors hover:bg-surface-soft ${open ? 'bg-surface-soft' : ''}`}>
                  <td className="p-3">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => toggle(group)}
                      className="text-left font-mono text-foreground underline-offset-2 hover:text-primary-text hover:underline"
                    >
                      <span className="text-muted-foreground">{group.method}</span> {group.path}
                    </button>
                  </td>
                  <td className="p-3"><Badge variant={statusVariant(group.status_code)} size="sm">{group.status_code}</Badge></td>
                  <td className="p-3 font-mono text-foreground">{group.error_type ?? <span className="text-muted-foreground">{t('health.noType')}</span>}</td>
                  <td className="p-3 text-right font-bold text-foreground">{formatCount(group.count)}</td>
                  <td className="p-3 text-muted-foreground">{formatDateTime(group.last_seen)}</td>
                </tr>
                {open && (
                  <tr>
                    <td colSpan={5} className="bg-surface px-4 py-3">
                      <GroupFailures group={group} window={data.window} tick={tick} />
                    </td>
                  </tr>
                )}
              </React.Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function SlowRoutes({ data }: { data: RequestsPayload }) {
  const { t } = useLanguage()
  if (data.slow_routes.length === 0) {
    return <EmptyNote>{t('health.slowNone', { min: 5 })}</EmptyNote>
  }
  const slowest = Math.max(...data.slow_routes.map((route) => route.p95_ms ?? 0), 1)
  return (
    <div className="glass-panel overflow-x-auto rounded-2xl border border-border">
      <table className="w-full border-collapse text-left text-xs">
        <caption className="sr-only">{t('health.slowCaption')}</caption>
        <thead>
          <tr className="border-b border-border bg-surface-muted uppercase tracking-wider text-muted-foreground">
            <th scope="col" className={TH}>{t('health.col.route')}</th>
            <th scope="col" className={`${TH} text-right`}>{t('health.col.requests')}</th>
            <th scope="col" className={TH}>{t('health.col.p95')}</th>
            <th scope="col" className={`${TH} text-right`}>{t('health.col.avg')}</th>
            <th scope="col" className={`${TH} text-right`}>{t('health.col.errorRate')}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {data.slow_routes.map((route) => (
            <tr key={`${route.method} ${route.path}`} className="hover:bg-surface-soft">
              <td className="p-3 font-mono text-foreground"><span className="text-muted-foreground">{route.method}</span> {route.path}</td>
              <td className="p-3 text-right text-foreground">{formatCount(route.requests)}</td>
              <td className="p-3">
                <div className="flex items-center gap-2">
                  <span className="w-16 shrink-0 font-bold text-foreground">{formatDuration(route.p95_ms)}</span>
                  <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
                    <span className="block h-full rounded-full bg-warning" style={{ width: `${Math.max(4, ((route.p95_ms ?? 0) / slowest) * 100)}%` }} />
                  </span>
                </div>
              </td>
              <td className="p-3 text-right text-muted-foreground">{formatDuration(route.avg_ms)}</td>
              <td className={`p-3 text-right font-semibold ${route.error_rate >= 1 ? 'text-destructive-text' : 'text-muted-foreground'}`}>{formatRate(route.error_rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
