import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Layers } from 'lucide-react'
import { getArticleChunks } from '../../api/articles'
import PageHeader from '../../components/ui/PageHeader'
import { Badge } from '../../components/ui/Badge'
import { apiErrorDetail } from '../../lib/error-handler'
import { CHUNK_FLAG_LABELS, flaggedCount, type ChunkView } from './chunkUtils'

export default function ArticleChunksPage() {
  const { id } = useParams()
  const [view, setView] = useState<ChunkView | null>(null)
  const [error, setError] = useState('')
  const [onlyFlagged, setOnlyFlagged] = useState(false)

  useEffect(() => {
    if (!id) return
    let cancelled = false
    setView(null)
    setError('')
    getArticleChunks(id)
      .then(data => { if (!cancelled) setView(data) })
      .catch(failure => { if (!cancelled) setError(apiErrorDetail(failure) || 'The passages could not be loaded.') })
    return () => { cancelled = true }
  }, [id])

  if (error) return <div className="page-shell p-8 text-destructive" role="alert">{error}</div>
  if (!view) return <div className="page-shell p-8 text-muted-foreground">Loading passages…</div>

  const { summary } = view
  const flagged = flaggedCount(view)
  return <div className="page-shell page-stack">
    <Link to={`/articles/${id}`} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft size={14} />Back to the article</Link>
    <PageHeader eyebrow="Knowledge operations" title="How this article was cut into passages" description="Search finds these passages, not the whole article. If an answer misses something that is in the document, look here for a table split in two, a scan that came out as fragments, or a passage that was indexed by an older model." icon={Layers} />
    <section className="glass-panel rounded-2xl border border-border p-5">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="default" size="sm">{summary.parents} sections</Badge>
        <Badge variant="default" size="sm">{summary.children} passages</Badge>
        <Badge variant="default" size="sm">~{summary.avg_chars} characters each</Badge>
        {Object.entries(summary.flags).filter(([, count]) => count > 0).map(([flag, count]) => <Badge key={flag} variant="warning" size="sm">{count} {CHUNK_FLAG_LABELS[flag]?.short ?? flag}</Badge>)}
        {flagged === 0 && <Badge variant="success" size="sm">Nothing looks wrong</Badge>}
        <label className="ml-auto flex items-center gap-2 text-xs text-muted">
          <input type="checkbox" checked={onlyFlagged} onChange={event => setOnlyFlagged(event.target.checked)} />Only passages that look wrong
        </label>
      </div>
      {summary.children === 0 && <p className="mt-4 text-sm text-muted">This article has no passages, so search cannot find it. If it was just published, indexing may still be running.</p>}
      <div className="mt-4 space-y-4">
        {view.parents.map(parent => {
          const children = onlyFlagged ? parent.children.filter(child => child.flags.length > 0) : parent.children
          if (onlyFlagged && children.length === 0) return null
          return <div key={parent.id} className="rounded-xl border border-border bg-surface p-4">
            <p className="text-sm font-semibold text-foreground">{parent.heading || parent.section_ref || 'Untitled section'}{parent.page_number ? <span className="ml-2 text-xs font-normal text-muted">page {parent.page_number}</span> : null}</p>
            <div className="mt-3 space-y-2">
              {children.map(child => <div key={child.id} className={`rounded-lg border p-3 ${child.flags.length ? 'border-warning/40 bg-warning/5' : 'border-border bg-canvas'}`}>
                <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                  <span className="font-semibold text-foreground">#{child.index + 1}</span>
                  <span>{child.chars} characters</span>
                  {child.page_number ? <span>page {child.page_number}</span> : null}
                  {child.flags.map(flag => <span key={flag} title={CHUNK_FLAG_LABELS[flag]?.help}><Badge variant="warning" size="sm">{CHUNK_FLAG_LABELS[flag]?.label ?? flag}</Badge></span>)}
                </div>
                <p className="mt-2 whitespace-pre-wrap text-sm text-foreground">{child.text}</p>
              </div>)}
            </div>
          </div>
        })}
      </div>
    </section>
  </div>
}
