import React, { useMemo } from 'react'
import { BarChart3, Clock, Sparkles, Zap } from 'lucide-react'
import type { AiPayload } from '../../api/investigate'
import { useLanguage } from '../../i18n/LanguageProvider'
import { bucketLabel, formatCount, formatDuration, formatRate } from '../../lib/investigate'
import { TimeSeriesChart, type ChartSeries } from './TimeSeriesChart'
import { Card, Delta, EmptyNote, Sparkline, StatCard } from './Primitives'

export function AiPanel({ data }: { data: AiPayload }) {
  const { t, language } = useLanguage()
  const none = t('health.noComparison')
  const width = data.window.bucket_seconds
  const labels = useMemo(() => data.series.map((point) => bucketLabel(point.t, width, language)), [data.series, width, language])
  const series: ChartSeries[] = useMemo(
    () => [
      {
        id: 'ai-requests',
        label: t('health.ai.requests'),
        kind: 'bar',
        values: data.series.map((point) => point.requests),
        className: 'fill-info/40',
        swatchClassName: 'bg-info/60',
        format: (value) => formatCount(value),
      },
      {
        id: 'ai-latency',
        label: t('health.ai.avgLatency'),
        kind: 'line',
        axis: 'right',
        values: data.series.map((point) => point.avg_latency_ms),
        className: 'stroke-warning',
        swatchClassName: 'bg-warning',
        format: (value) => formatDuration(value),
      },
    ],
    [data.series, t],
  )
  const tokens = data.series.map((point) => point.tokens)
  const slowest = Math.max(...data.models.map((model) => model.avg_latency_ms ?? 0), 1)
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label={t('health.ai.requests')}
          value={formatCount(data.current.requests)}
          icon={<Sparkles size={16} />}
          delta={<Delta change={data.delta.requests_pct} unit="%" worseWhen="none" noneLabel={none} />}
          detail={t('health.stat.requestsDetail', { previous: formatCount(data.previous.requests) })}
        />
        <StatCard
          label={t('health.ai.tokens')}
          value={formatCount(data.current.tokens)}
          icon={<BarChart3 size={16} />}
          delta={<Delta change={data.delta.tokens_pct} unit="%" worseWhen="up" noneLabel={none} />}
          spark={<Sparkline values={tokens} className="stroke-info" />}
        />
        <StatCard
          label={t('health.ai.avgLatency')}
          value={formatDuration(data.current.avg_latency_ms)}
          icon={<Clock size={16} />}
          delta={<Delta change={data.delta.latency_pct} unit="%" worseWhen="up" noneLabel={none} />}
          detail={t('health.ai.p95Detail', { p95: formatDuration(data.current.p95_latency_ms) })}
        />
        <StatCard
          label={t('health.ai.cacheHit')}
          value={formatRate(data.current.cache_hit_rate)}
          icon={<Zap size={16} />}
          detail={t('health.ai.cacheDetail')}
        />
      </div>
      <Card>
        <TimeSeriesChart
          labels={labels}
          series={series}
          ariaLabel={t('health.ai.chartAria', { hours: data.window.hours })}
          emptyText={t('health.chart.empty')}
          hint={t('health.chart.hint')}
          height={150}
        />
      </Card>
      {data.models.length === 0 ? (
        <EmptyNote>{t('health.ai.noModels')}</EmptyNote>
      ) : (
        <div className="glass-panel overflow-x-auto rounded-2xl border border-border">
          <table className="w-full border-collapse text-left text-xs">
            <caption className="sr-only">{t('health.ai.modelsCaption')}</caption>
            <thead>
              <tr className="border-b border-border bg-surface-muted uppercase tracking-wider text-muted-foreground">
                <th scope="col" className="p-3 font-semibold">{t('health.ai.model')}</th>
                <th scope="col" className="p-3 text-right font-semibold">{t('health.col.requests')}</th>
                <th scope="col" className="p-3 text-right font-semibold">{t('health.ai.tokens')}</th>
                <th scope="col" className="p-3 font-semibold">{t('health.ai.avgLatency')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {data.models.map((model) => (
                <tr key={model.model} className="hover:bg-surface-soft">
                  <td className="p-3 font-mono text-foreground">{model.model}</td>
                  <td className="p-3 text-right text-foreground">{formatCount(model.requests)}</td>
                  <td className="p-3 text-right text-muted-foreground">{formatCount(model.tokens)}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <span className="w-16 shrink-0 font-bold text-foreground">{formatDuration(model.avg_latency_ms)}</span>
                      <span className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-muted" aria-hidden="true">
                        <span className="block h-full rounded-full bg-info" style={{ width: `${Math.max(4, ((model.avg_latency_ms ?? 0) / slowest) * 100)}%` }} />
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
