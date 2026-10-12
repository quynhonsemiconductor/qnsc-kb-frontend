import { BarChart3, ChevronDown } from 'lucide-react'
import type { AnalyticsResult, Citation } from '../../types/ai'
import { analyticsOperationLabel, type AnalyticsOperationLabels } from '../../lib/evidence-presentation'

interface AnalysisResultsProps {
  results: AnalyticsResult[]
  citations: Citation[]
  onCitationClick: (citation: Citation) => void
  labels: {
    title: string
    formula: string
    rowsUsed: string
    details: string
    operations: AnalyticsOperationLabels
  }
}

export default function AnalysisResults({ results, citations, onCitationClick, labels }: AnalysisResultsProps) {
  if (!results.length) return null
  return (
    <section className="mt-4 space-y-2 pl-10" aria-label={labels.title}>
      {results.map((item, index) => {
        const citation = citations.find(source => source.source_id === item.source_id || source.evidence_id === item.evidence_id)
        return (
          <article key={`${item.evidence_id}-${item.operation}-${index}`} className="rounded-xl border border-info/20 bg-info/[0.045] p-3">
            <div className="flex items-start gap-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-info/10 text-info"><BarChart3 size={16} /></span>
              <div className="min-w-0 flex-1">
                <p className="text-caption font-bold uppercase tracking-widest text-info">{analyticsOperationLabel(item.operation, labels.operations)}</p>
                <p className="mt-1 font-display text-2xl font-extrabold tabular-nums text-ink">{item.result}{item.unit ? ` ${item.unit}` : ''}</p>
                <p className="mt-1 break-words font-mono text-xs text-steel"><span className="text-stone">{labels.formula}: </span>{item.formula}</p>
                {citation && <button type="button" onClick={() => onCitationClick(citation)} className="mt-2 text-xs font-semibold text-info underline-offset-2 hover:underline">[{citation.source_index ?? citation.source_id?.replace('C', '')}] {citation.evidence_label || citation.title}</button>}
              </div>
            </div>
            {(item.operands?.length || item.warnings?.length || item.rows_used != null) && (
              <details className="mt-3 border-t border-hairline pt-2 text-xs text-steel">
                <summary className="flex cursor-pointer list-none items-center gap-1 font-semibold text-stone">{labels.details}<ChevronDown size={13} /></summary>
                {item.rows_used != null && <p className="mt-2">{labels.rowsUsed}: {item.rows_used}</p>}
                {!!item.operands?.length && <ul className="mt-1 list-disc space-y-1 pl-5">{item.operands.map((operand, operandIndex) => <li key={operandIndex}>{operand.label}: <span className="font-mono">{operand.value}{operand.unit ? ` ${operand.unit}` : ''}</span></li>)}</ul>}
                {!!item.warnings?.length && <ul className="mt-2 list-disc space-y-1 pl-5 text-warning-text">{item.warnings.map((warning, warningIndex) => <li key={warningIndex}>{warning}</li>)}</ul>}
              </details>
            )}
          </article>
        )
      })}
    </section>
  )
}
