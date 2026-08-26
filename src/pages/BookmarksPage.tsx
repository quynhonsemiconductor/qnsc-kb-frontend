import React, { useEffect, useState } from 'react'
import { Bookmark, ArrowUpRight, Library } from 'lucide-react'
import { Link } from 'react-router-dom'
import { getBookmarks } from '../api/articles'
import PageHeader from '../components/ui/PageHeader'

export default function BookmarksPage() {
  const [items, setItems] = useState<any[] | null>(null)
  const [loadError, setLoadError] = useState(false)
  useEffect(() => { void getBookmarks().then((result) => { setItems(result); setLoadError(false) }).catch((err) => { console.error(err); setLoadError(true) }) }, [])

  if (!items) return loadError ? <div className="page-shell page-stack"><div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">Failed to load. Please retry.</div></div> : <div className="mx-auto max-w-6xl p-8 text-muted-foreground">Loading saved documents…</div>

  return (
    <div className="page-shell page-stack">
      <PageHeader eyebrow="Personal library" title="Saved documents" description="Keep the documents you return to most within easy reach." icon={Bookmark} actions={<span className="rounded-full border border-border bg-surface/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground">{items.length} saved</span>} />
      {items.length === 0 ? (
        <div className="glass-panel rounded-2xl border border-dashed border-border px-6 py-16 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary"><Library size={24} /></div>
          <h2 className="mt-4 font-display text-lg font-bold text-foreground">Your library is ready for its first save</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">Bookmark a useful article from the knowledge library and it will appear here.</p>
          <Link to="/browse" className="mm-primary mt-6 inline-flex items-center gap-2 px-4 py-2.5 text-sm font-semibold">Browse knowledge <ArrowUpRight size={15} /></Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {items.map(item => (
            <Link key={item.id} to={`/articles/${item.id}`} className="glass-panel interactive-lift group rounded-2xl border border-border p-5">
              <div className="flex items-start justify-between gap-4"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary"><Bookmark size={18} /></div><ArrowUpRight size={16} className="text-muted transition group-hover:text-primary" /></div>
              <h2 className="mt-5 font-display text-lg font-bold text-foreground">{item.title}</h2>
              <p className="mt-2 text-xs font-semibold uppercase tracking-[.12em] text-muted">{item.dept || 'Unassigned department'}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
