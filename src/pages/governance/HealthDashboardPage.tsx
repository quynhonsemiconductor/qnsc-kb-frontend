import React, { useEffect, useState } from 'react'
import { Activity, Layers, AlertTriangle, ShieldCheck, HelpCircle, BarChart3, TrendingUp, RefreshCw } from 'lucide-react'
import { getHealthMetrics, getEvalReport, getEvalRuns, verifyReviewDeadlines } from '../../api/governance'
import PageHeader from '../../components/ui/PageHeader'

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
      <div className="flex justify-center items-center h-64 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-500 mr-3" />
        <span>Compiling performance benchmarks...</span>
      </div>
    )
  }

  if (error && !metrics) {
    return (
      <div className="page-shell page-stack">
        <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <span>Failed to load. Please retry.</span>
          <button type="button" onClick={() => void fetchDashboardData().catch(() => undefined)} className="text-xs font-bold uppercase tracking-wide hover:underline">Retry</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page-shell page-stack">
      <PageHeader eyebrow="System observability" title="KB health dashboard" description="Live metrics, governance audits, and offline RAG evaluation scores." icon={Activity} actions={<button onClick={() => void runReviewScan().catch(() => undefined)} disabled={verifyingReviews} className="mm-secondary flex items-center gap-2 px-3 py-2 text-xs font-semibold disabled:opacity-50">
            <RefreshCw size={14} className={verifyingReviews ? 'animate-spin' : ''} />
            {verifyingReviews ? 'Checking reviews…' : 'Check review deadlines'}
          </button>} />

      {/* Grid of stats */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
          {/* Card 1 */}
          <div className="glass-panel interactive-lift rounded-2xl border border-border p-4 space-y-2">
            <div className="flex justify-between items-center text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Total Articles</span>
              <Layers size={16} />
            </div>
            <div className="text-2xl font-extrabold text-primary-foreground">{metrics.total_articles}</div>
            <div className="text-[10px] text-slate-500">Published documents</div>
          </div>

          {/* Card 2 */}
          <div className="glass-panel interactive-lift rounded-2xl border border-border p-4 space-y-2">
            <div className="flex justify-between items-center text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Owner Coverage</span>
              <ShieldCheck size={16} className="text-emerald-400" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-400">{metrics.percent_with_owner?.toFixed(0)}%</div>
            <div className="text-[10px] text-slate-500">Articles with registered owner</div>
          </div>

          {/* Card 3 */}
          <div className="glass-panel interactive-lift rounded-2xl border border-border p-4 space-y-2">
            <div className="flex justify-between items-center text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Overdue Review</span>
              <AlertTriangle size={16} className="text-rose-400" />
            </div>
            <div className="text-2xl font-extrabold text-rose-400">{metrics.percent_overdue?.toFixed(0)}%</div>
            <div className="text-[10px] text-slate-500">Awaiting governance review</div>
          </div>

          {/* Card 4 */}
          <div className="glass-panel interactive-lift rounded-2xl border border-border p-4 space-y-2">
            <div className="flex justify-between items-center text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Active Gaps</span>
              <HelpCircle size={16} className="text-amber-400" />
            </div>
            <div className="text-2xl font-extrabold text-amber-400">{metrics.open_gaps}</div>
            <div className="text-[10px] text-slate-500">Unanswered search queries</div>
          </div>

          {/* Card 5 */}
          <div className="glass-panel interactive-lift rounded-2xl border border-border p-4 space-y-2">
            <div className="flex justify-between items-center text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Helpful Rate</span>
              <TrendingUp size={16} className="text-brand-400" />
            </div>
            <div className="text-2xl font-extrabold text-brand-400">{metrics.helpful_rate?.toFixed(0)}%</div>
            <div className="text-[10px] text-slate-500">Thumbs-up feedback ratio</div>
          </div>

          <div className="glass-panel interactive-lift rounded-2xl border border-border p-4 space-y-2">
            <div className="flex justify-between items-center text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">Search Miss Rate</span>
              <Activity size={16} className="text-amber-400" />
            </div>
            <div className="text-2xl font-extrabold text-amber-400">{metrics.search_miss_rate?.toFixed(0)}%</div>
            <div className="text-[10px] text-slate-500">Queries with no authorized results</div>
          </div>

          <div className="glass-panel interactive-lift rounded-2xl border border-border p-4 space-y-2">
            <div className="flex justify-between items-center text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">API Error Rate</span>
              <AlertTriangle size={16} className="text-rose-400" />
            </div>
            <div className="text-2xl font-extrabold text-rose-400">{metrics.api_error_rate?.toFixed(1)}%</div>
            <div className="text-[10px] text-slate-500">Persisted request telemetry</div>
          </div>

          <div className="glass-panel interactive-lift rounded-2xl border border-border p-4 space-y-2">
            <div className="flex justify-between items-center text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">API P95</span>
              <Activity size={16} className="text-brand-400" />
            </div>
            <div className="text-2xl font-extrabold text-brand-400">{metrics.api_p95_latency_ms?.toFixed(0)}ms</div>
            <div className="text-[10px] text-slate-500">All recorded API requests</div>
          </div>

          <div className="glass-panel interactive-lift rounded-2xl border border-border p-4 space-y-2">
            <div className="flex justify-between items-center text-slate-500">
              <span className="text-xs font-semibold uppercase tracking-wider">AI Tokens</span>
              <BarChart3 size={16} className="text-amber-400" />
            </div>
            <div className="text-2xl font-extrabold text-amber-400">{metrics.ai_tokens_total?.toLocaleString()}</div>
            <div className="text-[10px] text-slate-500">{metrics.ai_requests || 0} logged AI requests</div>
          </div>
        </div>
      )}

      {metrics?.dependencies && (
        <section className="space-y-4" aria-labelledby="dependency-health-heading">
          <div className="flex items-end justify-between border-b border-slate-800 pb-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-brand-300">Dependency health</p>
              <h2 id="dependency-health-heading" className="mt-1 text-lg font-bold text-primary-foreground">Runtime services</h2>
            </div>
            <span className="text-xs text-slate-500">Configuration and queue signals</span>
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
                label: 'SharePoint sync',
                healthy: Boolean(metrics.dependencies.sharepoint?.configured),
                status: metrics.dependencies.sharepoint?.configured ? 'Configured' : 'No active connector',
                detail: `${metrics.dependencies.sharepoint?.active_connectors || 0} active connector(s)`,
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
                  <span className="text-sm font-semibold text-primary-foreground">{dependency.label}</span>
                  <span className={`h-2.5 w-2.5 rounded-full ${dependency.healthy ? 'bg-emerald-400' : 'bg-amber-400'}`} aria-label={dependency.healthy ? 'healthy' : 'attention'} />
                </div>
                <p className={`mt-3 text-xs font-semibold ${dependency.healthy ? 'text-emerald-400' : 'text-amber-400'}`}>{dependency.status}</p>
                <p className="mt-1 text-xs text-slate-500">{dependency.detail}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* RAG evaluation runs */}
      <div className="space-y-4">
        <h2 className="text-lg font-bold text-primary-foreground flex items-center gap-2 border-b border-slate-800 pb-2">
          <BarChart3 size={18} className="text-brand-400" />
          <span>Offline RAG Evaluation Runs</span>
        </h2>

        {evalReport && <div className={`rounded-2xl border p-4 ${evalReport.verdict === 'GO' ? 'border-emerald-400/25 bg-emerald-500/10' : 'border-amber-400/25 bg-amber-500/10'}`}><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-slate-400">Current evaluation verdict</p><p className={`mt-1 text-xl font-extrabold ${evalReport.verdict === 'GO' ? 'text-emerald-400' : 'text-amber-400'}`}>{evalReport.verdict}</p></div><div className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4"><span>Samples <strong className="ml-1 text-primary-foreground">{evalReport.sample_count || 0}</strong></span><span>Grounded <strong className="ml-1 text-primary-foreground">{((evalReport.kpis?.groundedness || 0) * 100).toFixed(1)}%</strong></span><span>Latency <strong className="ml-1 text-primary-foreground">{evalReport.kpis?.latency_ms || 0}ms</strong></span><span>Leakage <strong className={`ml-1 ${evalReport.permission_leakage ? 'text-rose-400' : 'text-emerald-400'}`}>{evalReport.permission_leakage || 0}</strong></span></div></div>{evalReport.reason && <p className="mt-3 text-xs text-amber-200">{evalReport.reason}</p>}</div>}
        
        {evalRuns.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-850 p-8 text-center bg-slate-900/5 text-slate-500 text-xs">
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
                    <td className={`p-3.5 font-bold ${run.context_recall >= 0.8 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {(run.context_recall * 100).toFixed(0)}%
                    </td>
                    <td className={`p-3.5 font-bold ${run.faithfulness >= 0.8 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {(run.faithfulness * 100).toFixed(0)}%
                    </td>
                    <td className={`p-3.5 font-bold ${run.answer_correctness >= 0.8 ? 'text-emerald-400' : 'text-amber-400'}`}>
                      {(run.answer_correctness * 100).toFixed(0)}%
                    </td>
                    <td className="p-3.5 text-slate-500">
                      {new Date(run.created_at).toLocaleDateString()}
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
