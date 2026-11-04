import React from 'react'
import { BarChart3 } from 'lucide-react'
import { getEvalReport, getEvalRuns } from '../../api/governance'
import { useLanguage } from '../../i18n/LanguageProvider'
import { usePanelData } from '../../hooks/usePanelData'
import { formatDay } from '../../lib/formatters'
import { AsyncBoundary, Card, EmptyNote, Section } from './Primitives'

interface EvalRun {
  id: string
  question?: { question?: string } | null
  context_recall: number
  faithfulness: number
  answer_correctness: number
  created_at: string
}

interface EvalReport {
  verdict: string
  sample_count?: number
  kpis?: { groundedness?: number; latency_ms?: number }
  permission_leakage?: number
  reason?: string
}

const score = (value: number) => (value >= 0.8 ? 'text-success-text' : 'text-warning-text')

export function QualityTab({ tick }: { tick: number }) {
  const { t } = useLanguage()
  const state = usePanelData<{ runs: EvalRun[]; report: EvalReport | null }>(
    async () => {
      const [runs, report] = await Promise.all([getEvalRuns(), getEvalReport()])
      return { runs, report }
    },
    'quality',
    tick,
  )
  return (
    <Section id="quality" eyebrow={t('health.quality.eyebrow')} title={t('health.quality.title')} description={t('health.quality.description')}>
      <AsyncBoundary state={state} onRetry={() => void state.reload()}>
        {({ runs, report }) => (
          <div className="space-y-4">
            {report && (
              <div className={`rounded-2xl border p-4 ${report.verdict === 'GO' ? 'border-success/30 bg-success/10' : 'border-warning/30 bg-warning/10'}`}>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-caption font-bold uppercase tracking-[.16em] text-muted-foreground">{t('health.quality.verdict')}</p>
                    <p className={`mt-1 text-xl font-extrabold ${report.verdict === 'GO' ? 'text-success-text' : 'text-warning-text'}`}>{report.verdict}</p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
                    <span>{t('health.quality.samples')} <strong className="ml-1 text-foreground">{report.sample_count || 0}</strong></span>
                    <span>{t('health.quality.grounded')} <strong className="ml-1 text-foreground">{((report.kpis?.groundedness || 0) * 100).toFixed(1)}%</strong></span>
                    <span>{t('health.quality.latency')} <strong className="ml-1 text-foreground">{report.kpis?.latency_ms || 0}ms</strong></span>
                    <span>{t('health.quality.leakage')} <strong className={`ml-1 ${report.permission_leakage ? 'text-destructive-text' : 'text-success-text'}`}>{report.permission_leakage || 0}</strong></span>
                  </div>
                </div>
                {report.reason && <p className="mt-3 text-xs text-warning-text">{report.reason}</p>}
              </div>
            )}
            {runs.length === 0 ? (
              <EmptyNote>{t('health.quality.empty')}</EmptyNote>
            ) : (
              <Card className="overflow-x-auto p-0">
                <table className="w-full border-collapse text-left text-xs">
                  <caption className="sr-only">{t('health.quality.caption')}</caption>
                  <thead>
                    <tr className="border-b border-border bg-surface-muted uppercase tracking-wider text-muted-foreground">
                      <th scope="col" className="p-3.5 font-semibold"><span className="inline-flex items-center gap-1.5"><BarChart3 size={13} />{t('health.quality.target')}</span></th>
                      <th scope="col" className="p-3.5 font-semibold">{t('health.quality.recall')}</th>
                      <th scope="col" className="p-3.5 font-semibold">{t('health.quality.faithfulness')}</th>
                      <th scope="col" className="p-3.5 font-semibold">{t('health.quality.correctness')}</th>
                      <th scope="col" className="p-3.5 font-semibold">{t('health.quality.executed')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {runs.map((run) => (
                      <tr key={run.id} className="transition-colors hover:bg-surface-soft">
                        <td className="p-3.5 font-mono text-foreground">{run.question?.question ? `Q: "${run.question.question}"` : t('health.quality.global')}</td>
                        <td className={`p-3.5 font-bold ${score(run.context_recall)}`}>{(run.context_recall * 100).toFixed(0)}%</td>
                        <td className={`p-3.5 font-bold ${score(run.faithfulness)}`}>{(run.faithfulness * 100).toFixed(0)}%</td>
                        <td className={`p-3.5 font-bold ${score(run.answer_correctness)}`}>{(run.answer_correctness * 100).toFixed(0)}%</td>
                        <td className="p-3.5 text-muted-foreground">{formatDay(run.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )}
          </div>
        )}
      </AsyncBoundary>
    </Section>
  )
}
