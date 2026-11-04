import React, { useEffect, useState } from 'react'
import { ChevronDown, ChevronRight, Search } from 'lucide-react'
import { getRequestFailures, type FailureGroup, type RequestFailure, type WindowInfo } from '../../api/investigate'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Input } from '../ui/Input'
import { useLanguage } from '../../i18n/LanguageProvider'
import { usePanelData } from '../../hooks/usePanelData'
import { formatDateTime } from '../../lib/formatters'
import { errorHeadline, formatDuration, groupKey, isValidRequestId, shortId } from '../../lib/investigate'
import { AsyncBoundary, CopyButton, EmptyNote } from './Primitives'

export function statusVariant(status: number): 'danger' | 'warning' | 'default' {
  return status >= 500 ? 'danger' : status >= 400 ? 'warning' : 'default'
}

/** One recorded failure: when, which request, how long, and the exception, expandable. */
export function FailureRow({ failure, defaultOpen = false }: { failure: RequestFailure; defaultOpen?: boolean }) {
  const { t } = useLanguage()
  const [open, setOpen] = useState(defaultOpen)
  const headline = errorHeadline(failure.error_detail)
  const detailId = `failure-${failure.request_id}`
  return (
    <li className="py-2.5">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-body-sm">
        <Badge variant={statusVariant(failure.status_code)} size="sm">{failure.status_code}</Badge>
        <span className="font-mono text-caption text-muted-foreground">{failure.method}</span>
        <span className="min-w-0 break-all font-mono text-caption text-foreground">{failure.path}</span>
        <span className="text-caption text-muted-foreground">{formatDateTime(failure.at)}</span>
        <span className="text-caption text-muted-foreground">{formatDuration(failure.duration_ms)}</span>
        <span className="ml-auto inline-flex items-center gap-1 font-mono text-caption text-muted-foreground" title={failure.request_id}>
          {shortId(failure.request_id, 12)}
          <CopyButton value={failure.request_id} label={t('health.copyRequestId')} />
        </span>
      </div>
      <div className="mt-1 flex items-start gap-2">
        {failure.error_detail ? (
          <button
            type="button"
            aria-expanded={open}
            aria-controls={detailId}
            onClick={() => setOpen((value) => !value)}
            className="flex min-w-0 items-start gap-1.5 text-left text-body-sm text-foreground hover:text-primary-text"
          >
            {open ? <ChevronDown size={15} className="mt-0.5 shrink-0" /> : <ChevronRight size={15} className="mt-0.5 shrink-0" />}
            <span className="min-w-0 break-words">
              {failure.error_type && <strong className="mr-1.5 font-semibold">{failure.error_type}</strong>}
              {headline}
            </span>
          </button>
        ) : (
          <span className="text-caption text-muted-foreground">{t('health.noDetail')}</span>
        )}
      </div>
      {open && failure.error_detail && (
        <div id={detailId} className="relative mt-2">
          <pre className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border bg-surface-muted p-3 pr-9 font-mono text-caption text-foreground">
            {failure.error_detail}
          </pre>
          <CopyButton value={failure.error_detail} label={t('health.copyTrace')} className="absolute right-2 top-2" />
        </div>
      )}
    </li>
  )
}

/** The newest failures behind one group of the failure table, fetched when it is opened. */
export function GroupFailures({ group, window, tick }: { group: FailureGroup; window: WindowInfo; tick: number }) {
  const { t } = useLanguage()
  const key = `${groupKey(group)}|${window.since}|${window.until}`
  const state = usePanelData(
    () =>
      getRequestFailures({
        route: group.path,
        method: group.method,
        errorType: group.error_type ?? undefined,
        minStatus: group.status_code,
        since: window.since,
        until: window.until,
        limit: 20,
      }),
    key,
    tick,
  )
  return (
    <AsyncBoundary state={state} onRetry={() => void state.reload()}>
      {(data) =>
        data.failures.length === 0 ? (
          <EmptyNote>{t('health.groupEmpty')}</EmptyNote>
        ) : (
          <div className="space-y-2">
            <p className="text-caption text-muted-foreground">
              {t('health.groupShowing', { shown: data.failures.length, total: group.count })}
            </p>
            <ul className="divide-y divide-border">
              {data.failures.map((failure) => (
                <FailureRow key={failure.request_id} failure={failure} />
              ))}
            </ul>
          </div>
        )
      }
    </AsyncBoundary>
  )
}

/**
 * Find the failure a user reports by the id the browser already holds.
 *
 * The API returns `X-Request-ID` on every response and the SPA exposes it in its error messages, so
 * the person reporting a problem can paste one string and the operator lands on the exception.
 */
export function RequestLookup({
  initial,
  retentionDays,
  onSearched,
}: {
  initial: string
  retentionDays: number | null
  onSearched: (requestId: string) => void
}) {
  const { t } = useLanguage()
  const [value, setValue] = useState(initial)
  const [submitted, setSubmitted] = useState(initial)
  const [invalid, setInvalid] = useState(false)

  const state = usePanelData(
    () => (submitted ? getRequestFailures({ requestId: submitted, minStatus: 400, limit: 5 }) : Promise.resolve({ count: 0, failures: [] })),
    submitted,
  )

  const submit = (event?: React.FormEvent) => {
    event?.preventDefault()
    const trimmed = value.trim()
    if (!isValidRequestId(trimmed)) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setSubmitted(trimmed)
    onSearched(trimmed)
  }

  // A linked investigation (`?request=...`) runs itself, so following the link shows the answer.
  // Keyed on the URL value alone: a search made here writes the same id back to the URL, and
  // depending on `submitted` too would let a stale URL value overwrite a search made a moment ago.
  useEffect(() => {
    if (initial) {
      setValue(initial)
      setSubmitted(initial)
    }
  }, [initial])

  return (
    <div className="space-y-3">
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <div className="min-w-0 flex-1">
          <Input
            label={t('health.lookupLabel')}
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder="0f3a9c1e-77aa-4b12-9d00-…"
            spellCheck={false}
            autoComplete="off"
            error={invalid ? t('health.lookupInvalid') : undefined}
            hint={t('health.lookupHint')}
            className="font-mono"
          />
        </div>
        <Button type="submit" variant="primary" size="md" icon={<Search size={15} />} disabled={!value.trim()}>
          {t('health.lookupAction')}
        </Button>
      </form>
      {submitted && (
        <AsyncBoundary state={state} onRetry={() => void state.reload()}>
          {(data) =>
            data.failures.length === 0 ? (
              <EmptyNote>
                {t('health.lookupNone', { days: retentionDays ?? 30 })}
              </EmptyNote>
            ) : (
              <ul className="divide-y divide-border rounded-xl border border-border px-3">
                {data.failures.map((failure) => (
                  <FailureRow key={failure.request_id + failure.at} failure={failure} defaultOpen />
                ))}
              </ul>
            )
          }
        </AsyncBoundary>
      )}
    </div>
  )
}
