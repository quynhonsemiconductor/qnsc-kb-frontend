import { useState } from 'react'
import { Check, ChevronDown, Minus } from 'lucide-react'
import type { AgentStep } from '../../types/ai'
import { stepText } from '../../lib/agent'
import { useLanguage } from '../../i18n/LanguageProvider'

/**
 * What the assistant is doing, as a column of steps.
 *
 * Rendered INSIDE the assistant's message, in the same column as its text, so it always sits
 * beside the assistant's avatar. It used to be a separate block under the whole transcript
 * with its own margin, which never lined up with the message it described.
 */
export default function AgentProgress({ steps, live }: { steps: AgentStep[]; live: boolean }) {
  const { t } = useLanguage()
  // While working the steps are always visible; afterwards they fold into one line the
  // reader can open, so a finished answer is not pushed down by its own history.
  const [open, setOpen] = useState(false)
  if (steps.length === 0) return null
  // While the stream is live the assistant is working even between two steps.
  const working = live
  const expanded = live || open
  return (
    <div className="mb-3 rounded-xl border border-border bg-surface-elevated" data-testid="agent-progress">
      <button
        type="button"
        onClick={() => !live && setOpen(value => !value)}
        aria-expanded={expanded}
        disabled={live}
        className="flex min-h-9 w-full items-center gap-2 px-3 text-left text-body-sm font-semibold text-foreground disabled:cursor-default"
      >
        {working ? (
          <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-info/25 border-t-info" />
        ) : (
          <Check size={14} className="shrink-0 text-success-text" />
        )}
        <span className="min-w-0 flex-1 truncate">{live ? t('agent.working') : t('agent.steps', { count: steps.length })}</span>
        {!live && <ChevronDown size={14} className={`shrink-0 text-muted transition ${open ? 'rotate-180' : ''}`} />}
      </button>
      {expanded && (
        <ol className="space-y-1.5 border-t border-border px-3 py-2.5 text-caption text-muted-foreground">
          {steps.map(step => (
            <li key={step.step} className="flex items-start gap-2">
              <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center">
                {step.status === 'running' ? (
                  <span className="h-3 w-3 animate-spin rounded-full border-2 border-info/25 border-t-info" />
                ) : step.status === 'skipped' ? (
                  <Minus size={12} className="text-muted" />
                ) : (
                  <Check size={12} className="text-success-text" />
                )}
              </span>
              <span className={`min-w-0 flex-1 ${step.status === 'running' ? 'text-foreground' : ''}`}>
                {stepText(t, step)}
                {step.step === 'understand' && step.status === 'done' && Array.isArray(step.data?.sub_queries) && (step.data?.sub_queries as unknown[]).length > 1 && (
                  <span className="mt-0.5 block text-muted">{(step.data?.sub_queries as string[]).join(' · ')}</span>
                )}
              </span>
              {typeof step.ms === 'number' && step.status !== 'running' && step.ms >= 1000 && (
                <span className="shrink-0 tabular-nums text-muted">{(step.ms / 1000).toFixed(1)}s</span>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}
