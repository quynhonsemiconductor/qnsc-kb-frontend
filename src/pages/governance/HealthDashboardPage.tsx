import React, { useEffect, useState } from 'react'
import { Activity, Layers, AlertTriangle, ShieldCheck, HelpCircle, BarChart3, TrendingUp, RefreshCw } from 'lucide-react'
import { getHealthMetrics, getEvalReport, getEvalRuns, verifyReviewDeadlines } from '../../api/governance'
import PageHeader from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { formatDay } from '../../lib/formatters'

export default function HealthDashboardPage() {
  const [metrics, setMetrics] = useState<any>(null)
  const [evalRuns, setEvalRuns] = useState<any[]>([])
  const [evalReport, setEvalReport] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [verifyingReviews, setVerifyingReviews] = useState(false)
  const [error, setError] = useState(false)

  const fetchDashboardData = async () => {
    setLoading(true)
    try {
      const [m, ev, report] = await Promise.all([getHealthMetrics(), getEvalRuns(), getEvalReport()])
      setMetrics(m)
      setEvalRuns(ev)
      setEvalReport(report)
      setError(false)
    } catch (err) {
      console.error(err)
      setError(true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDashboardData()
  }, [])

  const runReviewScan = async () => {
    setVerifyingReviews(true)
    try {
      await verifyReviewDeadlines()
      await fetchDashboardData()
    } finally {
      setVerifyingReviews(false)
    }
  }

  if (loading) {
    return (
      <div className="page-shell page-stack">
        <div className="rounded-panel border border-border bg-card p-6"><div className="animate-pulse space-y-4"><div className="h-8 w-2/5 rounded bg-muted/50" /><div className="h-4 w-3/5 rounded bg-muted/40" /></div></div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 4 }, (_, i) => <div key={i} className="animate-pulse rounded-2xl border border-border bg-card p-5"><div className="h-4 w-1/2 rounded bg-muted/50 mb-3" /><div className="h-8 w-1/3 rounded bg-muted/50 mb-2" /><div className="h-3 w-2/3 rounded bg-muted/40" /></div>)}</div>
      </div>
    )
  }

  if (error && !metrics) {
    return (
      <div className="page-shell page-stack">
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>Failed to load. Please retry.</span>
          <Button variant="ghost" size="sm" onClick={() => void fetchDashboardData().catch(() => undefined)}>Retry</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell page-stack">
      <PageHeader eyebrow="System observability" title="KB health dashboard" description="Live metrics, governance audits, and offline RAG evaluation scores." icon={Activity} actions={<Button variant="secondary" size="sm" onClick={() => void runReviewScan().catch(() => undefined)} disabled={verifyingReviews} icon={<RefreshCw size={14} className={verifyingReviews ? 'animate-spin' : ''} />}>
            {verifyingReviews ? 'Checking reviews…' : 'Check review deadlines'}
          </Button>} />

      {/* Grid of stats */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
          {/* Card 1 */}
          <div className="glass-panel interactive-lift rounded-2xl border border-border p-4 space-y-2">
            <div className="flex justify-between items-center text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Articles</span>
              <Layers size={16} />
            </div>
            {/* `text-foreground`: this is a metric value on a panel, not a label on a
                primary fill. The on-primary token only belongs over --primary/--destructive. */}
            <div className="text-2xl font-extrabold text-foreground">{metrics.total_articles}</div>
            <div className="text-caption text-muted-foreground">Published documents</div>
          </div>

          {/* Card 2 */}
          <div className="glass-panel interactive-lift rounded-2xl border border-border p-4 space-y-2">
            <div className="flex justify-between items-center text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Owner Coverage</span>
              <ShieldCheck size={16} className="text-success-text" />
            </div>
            <div className="text-2xl font-extrabold text-success-text">{metrics.percent_with_owner?.toFixed(0)}%</div>
            <div className="text-caption text-muted-foreground">Articles with registered owner</div>
          </div>

          {/* Card 3 */}
          <div className="glass-panel interactive-lift rounded-2xl border border-border p-4 space-y-2">
            <div className="flex justify-between items-center text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Overdue Review</span>
              <AlertTriangle size={16} className="text-rose-400" />
            </div>
            <div className="text-2xl font-extrabold text-rose-400">{metrics.percent_overdue?.toFixed(0)}%</div>
            <div className="text-caption text-muted-foreground">Awaiting governance review</div>
          </div>

          {/* Card 4 */}
          <div className="glass-panel interactive-lift rounded-2xl border border-border p-4 space-y-2">
            <div className="flex justify-between items-center text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Active Gaps</span>
              <HelpCircle size={16} className="text-amber-400" />
            </div>
            <div className="text-2xl font-extrabold text-amber-400">{metrics.open_gaps}</div>
            <div className="text-caption text-muted-foreground">Unanswered search queries</div>
          </div>

          {/* Card 5 */}
          <div className="glass-panel interactive-lift rounded-2xl border border-border p-4 space-y-2">
            <div className="flex justify-between items-center text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Helpful Rate</span>
              <TrendingUp size={16} className="text-primary-text" />
            </div>
            <div className="text-2xl font-extrabold text-primary-text">{metrics.helpful_rate?.toFixed(0)}%</div>
            <div className="text-caption text-muted-foreground">Thumbs-up feedback ratio</div>
          </div>

          <div className="glass-panel interactive-lift rounded-2xl border border-border p-4 space-y-2">
            <div className="flex justify-between items-center text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">Search Miss Rate</span>
              <Activity size={16} className="text-amber-400" />
            </div>
            <div className="text-2xl font-extrabold text-amber-400">{metrics.search_miss_rate?.toFixed(0)}%</div>
            <div className="text-caption text-muted-foreground">Queries with no authorized results</div>
          </div>

          <div className="glass-panel interactive-lift rounded-2xl border border-border p-4 space-y-2">
            <div className="flex justify-between items-center text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">API Error Rate</span>
              <AlertTriangle size={16} className="text-rose-400" />
            </div>
            <div className="text-2xl font-extrabold text-rose-400">{metrics.api_error_rate?.toFixed(1)}%</div>
            <div className="text-caption text-muted-foreground">Persisted request telemetry</div>
          </div>

          <div className="glass-panel interactive-lift rounded-2xl border border-border p-4 space-y-2">
            <div className="flex justify-between items-center text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">API P95</span>
              <Activity size={16} className="text-primary-text" />
            </div>
            <div className="text-2xl font-extrabold text-primary-text">{metrics.api_p95_latency_ms?.toFixed(0)}ms</div>
            <div className="text-caption text-muted-foreground">All recorded API requests</div>
          </div>

          <div className="glass-panel interactive-lift rounded-2xl border border-border p-4 space-y-2">
            <div className="flex justify-between items-center text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider">AI Tokens</span>
              <BarChart3 size={16} className="text-amber-400" />
            </div>
            <div className="text-2xl font-extrabold text-amber-400">{metrics.ai_tokens_total?.toLocaleString()}</div>
            <div className="text-caption text-muted-foreground">{metrics.ai_requests || 0} logged AI requests</div>
          </div>
        </div>
      )}

      {metrics?.dependencies && (
        <section className="space-y-4" aria-labelledby="dependency-health-heading">
          <div className="flex items-end justify-between border-b border-slate-800 pb-2">
            <div>
              <p className="text-caption font-semibold uppercase tracking-[0.24em] text-primary-text">Dependency health</p>
              <h2 id="dependency-health-heading" className="mt-1 text-lg font-bold text-foreground">Runtime services</h2>
            </div>
            <span className="text-xs text-muted-foreground">Configuration and queue signals</span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: 'Cloudflare R2',
                healthy: Boolean(metrics.dependencies.r2?.configured),
                status: metrics.dependencies.r2?.configured ? 'Configured' : 'Needs configuration',
                detail: 'Private source storage',
              },
              {
                // `connectors` counts every remote provider; `sharepoint` is the older
                // key with the same shape, kept as a fallback so a not-yet-deployed API
                // does not render this card as "no active connector".
                label: 'Connector sync',
                healthy: Boolean(metrics.dependencies.connectors?.configured ?? metrics.dependencies.sharepoint?.configured),
                status: (metrics.dependencies.connectors?.configured ?? metrics.dependencies.sharepoint?.configured) ? 'Configured' : 'No active connector',
                detail: `${metrics.dependencies.connectors?.active_connectors ?? metrics.dependencies.sharepoint?.active_connectors ?? 0} active connector(s)`,
              },
              {
                label: 'Indexing queue',
                healthy: Number(metrics.dependencies.indexing?.pending_or_failed_articles || 0) === 0,
                status: Number(metrics.dependencies.indexing?.pending_or_failed_articles || 0) === 0 ? 'Clear' : 'Attention required',
                detail: `${metrics.dependencies.indexing?.pending_or_failed_articles || 0} pending or failed article(s)`,
              },
              {
                label: 'LLM provider',
                healthy: Boolean(metrics.dependencies.llm?.configured),
                status: metrics.dependencies.llm?.configured ? 'Configured' : 'Needs configuration',
                detail: 'Grounded answer generation',
              },
            ].map((dependency) => (
              <div key={dependency.label} className="glass-panel rounded-2xl border border-border p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-foreground">{dependency.label}</span>
                  <span className={`h-2.5 w-2.5 rounded-full ${dependency.healthy ? 'bg-emerald-400' : 'bg-amber-400'}`} aria-label={dependency.healthy ? 'healthy' : 'attention'} />
                </div>
                <p className={`mt-3 text-xs font-semibold ${dependency.healthy ? 'text-success-text' : 'text-amber-400'}`}>{dependency.status}</p>
                <p className="mt-1 text-xs text-muted-foreground">{dependency.detail}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* RAG evaluation runs */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2 border-b border-slate-800 pb-2">
          <BarChart3 size={18} className="text-primary-text" />
          <span>Offline RAG Evaluation Runs</span>
        </h2>

        {evalReport && <div className={`rounded-2xl border p-4 ${evalReport.verdict === 'GO' ? 'border-emerald-400/25 bg-emerald-500/10' : 'border-amber-400/25 bg-amber-500/10'}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-caption font-bold uppercase tracking-[.16em] text-slate-400">Current evaluation verdict</p><p className={`mt-1 text-xl font-extrabold ${evalReport.verdict === 'GO' ? 'text-success-text' : 'text-amber-400'}`}>{evalReport.verdict}</p></div><div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4"><span>Samples <strong className="ml-1 text-foreground">{evalReport.sample_count || 0}</strong></span><span>Grounded <strong className="ml-1 text-foreground">{((evalReport.kpis?.groundedness || 0) * 100).toFixed(1)}%</strong></span><span>Latency <strong className="ml-1 text-foreground">{evalReport.kpis?.latency_ms || 0}ms</strong></span><span>Leakage <strong className={`ml-1 ${evalReport.permission_leakage ? 'text-rose-400' : 'text-success-text'}`}>{evalReport.permission_leakage || 0}</strong></span></div></div>{evalReport.reason && <p className="mt-3 text-xs text-warning-text">{evalReport.reason}</p>}</div>}
        
        {evalRuns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center bg-slate-900/5 text-muted-foreground text-xs">
            No offline evaluation data found. Trigger eval suites in the background.
          </div>
        ) : (
        <div className="glass-panel overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-900/80 text-slate-400 uppercase tracking-wider border-b border-slate-800">
                  <th className="p-3.5 font-semibold">Evaluation Target</th>
                  <th className="p-3.5 font-semibold">Context Recall</th>
                  <th className="p-3.5 font-semibold">Faithfulness</th>
                  <th className="p-3.5 font-semibold">Correctness</th>
                  <th className="p-3.5 font-semibold">Executed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 text-slate-300">
                {evalRuns.map((run) => (
                  <tr key={run.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="p-3.5 font-mono">
                      {run.question?.question ? `Q: "${run.question.question}"` : 'Global Target'}
                    </td>
                    <td className={`p-3.5 font-bold ${run.context_recall >= 0.8 ? 'text-success-text' : 'text-amber-400'}`}>
                      {(run.context_recall * 100).toFixed(0)}%
                    </td>
                    <td className={`p-3.5 font-bold ${run.faithfulness >= 0.8 ? 'text-success-text' : 'text-amber-400'}`}>
                      {(run.faithfulness * 100).toFixed(0)}%
                    </td>
                    <td className={`p-3.5 font-bold ${run.answer_correctness >= 0.8 ? 'text-success-text' : 'text-amber-400'}`}>
                      {(run.answer_correctness * 100).toFixed(0)}%
                    </td>
                    <td className="p-3.5 text-muted-foreground">
                      {formatDay(run.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
