import { useCallback, useEffect, useState } from 'react'
import { Check, ThumbsDown } from 'lucide-react'
import { listFeedbackForReview, markFeedbackReviewed, type FeedbackItem, type FeedbackReviewFilter } from '../../api/feedbackReview'
import PageHeader from '../../components/ui/PageHeader'
import { useDialog } from '../../components/ui/DialogProvider'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { apiErrorDetail } from '../../lib/error-handler'
import { formatDateTime } from '../../lib/formatters'

const TABS: { value: Exclude<FeedbackReviewFilter, 'all'>; label: string }[] = [
  { value: 'pending', label: 'To review' },
  { value: 'reviewed', label: 'Reviewed' },
]

export default function FeedbackReviewPage() {
  const dialog = useDialog()
  const [tab, setTab] = useState<'pending' | 'reviewed'>('pending')
  const [items, setItems] = useState<FeedbackItem[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setItems(null)
    setError('')
    try { setItems(await listFeedbackForReview(tab)) }
    catch (failure) { setItems([]); setError(apiErrorDetail(failure) || 'The feedback could not be loaded.') }
  }, [tab])
  useEffect(() => { void load() }, [load])

  const review = async (item: FeedbackItem) => {
    const note = await dialog.prompt('What did you do about it? For example: added a missing article, fixed an outdated one, or the answer was right.', { title: 'Mark as reviewed', confirmLabel: 'Mark reviewed', placeholder: 'Optional note', multiline: true })
    if (note === null) return
    setBusy(item.id)
    try { await markFeedbackReviewed(item.id, note); await load() }
    catch (failure) { await dialog.alert(apiErrorDetail(failure) || 'It could not be saved. Try again.', { title: 'Feedback' }) }
    finally { setBusy(null) }
  }

  return <div className="page-shell page-stack">
    <PageHeader eyebrow="Knowledge operations" title="Answer feedback" description="Answers people rated down. Each one is a place where the knowledge base may be missing something or out of date." icon={ThumbsDown} />
    <section className="glass-panel rounded-2xl border border-border p-5">
      <div className="flex gap-1" role="tablist" aria-label="Review status">
        {TABS.map(({ value, label }) => <Button key={value} size="sm" variant={tab === value ? 'primary' : 'secondary'} role="tab" aria-selected={tab === value} onClick={() => setTab(value)}>{label}</Button>)}
      </div>
      <div className="mt-4 space-y-3">
        {items === null && <div className="h-24 animate-pulse rounded-xl bg-surface-soft" />}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {items?.length === 0 && !error && <p className="text-sm text-muted">{tab === 'pending' ? 'Nothing waiting for review.' : 'Nothing has been reviewed yet.'}</p>}
        {items?.map(item => <article key={item.id} className="rounded-xl border border-border bg-surface p-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="danger" size="sm">Rated down</Badge>
            <span className="text-xs text-muted">{[item.user, formatDateTime(item.created_at)].filter(Boolean).join(' · ')}</span>
          </div>
          <p className="mt-2 text-sm font-semibold text-foreground">{item.question}</p>
          {item.comment && <p className="mt-2 rounded-lg bg-warning/10 px-3 py-2 text-sm text-foreground">“{item.comment}”</p>}
          <details className="mt-2">
            <summary className="cursor-pointer text-xs font-semibold text-muted">Show the answer that was given</summary>
            <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">{item.answer}</p>
          </details>
          {item.reviewed_at
            ? <p className="mt-3 text-xs text-muted">Reviewed {formatDateTime(item.reviewed_at)}{item.review_note ? ` · ${item.review_note}` : ''}</p>
            : <Button className="mt-3" size="sm" variant="secondary" icon={<Check size={14} />} disabled={busy === item.id} onClick={() => review(item)}>Mark reviewed</Button>}
        </article>)}
      </div>
    </section>
  </div>
}
