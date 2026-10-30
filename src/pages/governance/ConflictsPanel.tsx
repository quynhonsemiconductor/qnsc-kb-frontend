import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { CheckCircle2, RotateCcw } from 'lucide-react'
import { getConflicts, reopenConflict, resolveConflict } from '../../api/knowledge'
import { useAuth } from '../../auth/useAuth'
import { useDialog } from '../../components/ui/DialogProvider'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { apiErrorDetail } from '../../lib/error-handler'
import { formatDateTime } from '../../lib/formatters'
import {
  CONTRADICTION_TYPE_LABELS, articleLabel, canChooseWinner, newerArticleId, statementFor,
  type Conflict, type ConflictArticle,
} from './conflictUtils'

type Tab = 'open' | 'resolved'

export default function ConflictsPanel({ onChanged }: { onChanged?: () => void }) {
  const { user } = useAuth()
  const dialog = useDialog()
  const [tab, setTab] = useState<Tab>('open')
  const [items, setItems] = useState<Conflict[] | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const mayChoose = canChooseWinner(user)

  const load = useCallback(async () => {
    setItems(null)
    setItems(await getConflicts(tab))
  }, [tab])
  useEffect(() => { void load().catch(console.error) }, [load])

  const run = async (id: string, action: () => Promise<unknown>) => {
    setBusy(id)
    try { await action(); await load(); onChanged?.() }
    catch (error) { await dialog.alert(apiErrorDetail(error) || 'The change could not be saved. Try again.', { title: 'Conflict' }) }
    finally { setBusy(null) }
  }

  const keep = async (conflict: Conflict, article: ConflictArticle) => {
    const others = conflict.articles.filter(item => item.id !== article.id).map(articleLabel).join(', ')
    const ok = await dialog.confirm(
      `Answers will quote "${articleLabel(article)}" and stop quoting ${others} wherever both appear. You can undo this from the Resolved tab.`,
      { title: 'This article is right', confirmLabel: 'Keep this one' },
    )
    if (ok) await run(conflict.id, () => resolveConflict(conflict.id, { keepArticleId: article.id }))
  }

  const closeWithNote = async (conflict: Conflict) => {
    const note = await dialog.prompt('How was this conflict resolved? Answers keep flagging the disagreement unless an Admin chooses one article.', { title: 'Resolve conflict', confirmLabel: 'Resolve', placeholder: 'Resolution note', validate: value => (value ? '' : 'A note is required') })
    if (note) await run(conflict.id, () => resolveConflict(conflict.id, { note }))
  }

  const reopen = async (conflict: Conflict) => {
    if (await dialog.confirm('Answers will quote every article in this conflict again until it is decided anew.', { title: 'Reopen conflict', confirmLabel: 'Reopen' })) {
      await run(conflict.id, () => reopenConflict(conflict.id))
    }
  }

  return <section className="glass-panel rounded-2xl border border-border p-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h2 className="font-display text-lg font-bold text-foreground">Conflict resolution</h2>
        <p className="mt-1 text-xs text-muted">Choosing the right article makes answers stop quoting the other one.</p>
      </div>
      <div className="flex gap-1" role="tablist" aria-label="Conflict status">
        {(['open', 'resolved'] as const).map(value => <Button key={value} size="sm" variant={tab === value ? 'primary' : 'secondary'} role="tab" aria-selected={tab === value} onClick={() => setTab(value)}>{value === 'open' ? 'Open' : 'Resolved'}</Button>)}
      </div>
    </div>
    <div className="mt-4 space-y-3">
      {items === null && <div className="h-20 animate-pulse rounded-xl bg-surface-soft" />}
      {items?.length === 0 && <p className="text-sm text-muted">{tab === 'open' ? 'No unresolved conflicts.' : 'Nothing has been resolved yet.'}</p>}
      {items?.map(conflict => <ConflictCard key={conflict.id} conflict={conflict} busy={busy === conflict.id} mayChoose={mayChoose} onKeep={keep} onClose={closeWithNote} onReopen={reopen} />)}
    </div>
  </section>
}

function ConflictCard({ conflict, busy, mayChoose, onKeep, onClose, onReopen }: {
  conflict: Conflict; busy: boolean; mayChoose: boolean
  onKeep: (conflict: Conflict, article: ConflictArticle) => void
  onClose: (conflict: Conflict) => void
  onReopen: (conflict: Conflict) => void
}) {
  const open = conflict.status === 'open'
  const newer = newerArticleId(conflict)
  const typeLabel = conflict.contradiction_type ? CONTRADICTION_TYPE_LABELS[conflict.contradiction_type] : undefined
  return <div className={`rounded-xl border p-4 ${open ? 'border-warning/20 bg-warning/5' : 'border-border bg-surface'}`}>
    <div className="flex flex-wrap items-center gap-2">
      <p className="font-semibold text-foreground">{conflict.fact}</p>
      {typeLabel && <Badge variant="warning" size="sm">{typeLabel}</Badge>}
      {conflict.detection_method === 'llm' && <Badge variant="info" size="sm">Found by AI</Badge>}
      {!open && <Badge variant="success" size="sm">Resolved</Badge>}
    </div>
    <div className="mt-3 grid gap-3 sm:grid-cols-2">
      {conflict.articles.map(article => {
        const kept = conflict.kept_article_id === article.id
        const statement = statementFor(conflict, article.id)
        return <div key={article.id} className={`rounded-lg border bg-canvas p-3 ${kept ? 'border-success/40' : 'border-border'}`}>
          <div className="flex flex-wrap items-center gap-2">
            {article.title ? <Link to={`/articles/${article.id}`} className="text-sm font-semibold text-primary-text hover:underline">{articleLabel(article)}</Link> : <span className="text-sm font-semibold text-muted-foreground">{articleLabel(article)}</span>}
            {kept && <Badge variant="success" size="sm">Right one</Badge>}
            {!kept && conflict.kept_article_id && <Badge variant="default" size="sm">Superseded</Badge>}
            {newer === article.id && <Badge variant="default" size="sm">Newer</Badge>}
          </div>
          <p className="mt-1 text-xs text-muted">{[article.dept, article.issue_date && `Issued ${article.issue_date}`].filter(Boolean).join(' · ') || 'No department or issue date recorded'}</p>
          {statement && <p className="mt-2 text-sm text-foreground">“{statement}”</p>}
          {open && mayChoose && article.title && <Button className="mt-3" size="sm" variant="secondary" icon={<CheckCircle2 size={14} />} disabled={busy} onClick={() => onKeep(conflict, article)}>This one is right</Button>}
        </div>
      })}
    </div>
    {open && !mayChoose && <p className="mt-3 text-xs text-muted">Only an Admin or CEO can choose which article is right. You can still close the conflict with a note.</p>}
    {!open && conflict.resolution_note && <p className="mt-3 text-sm text-muted-foreground">{conflict.resolution_note}{conflict.resolved_at ? ` · ${formatDateTime(conflict.resolved_at)}` : ''}</p>}
    <div className="mt-3 flex flex-wrap gap-2">
      {open && <Button size="sm" variant="ghost" disabled={busy} onClick={() => onClose(conflict)}>Resolve without choosing</Button>}
      {!open && <Button size="sm" variant="secondary" icon={<RotateCcw size={14} />} disabled={busy} onClick={() => onReopen(conflict)}>Reopen</Button>}
    </div>
  </div>
}
