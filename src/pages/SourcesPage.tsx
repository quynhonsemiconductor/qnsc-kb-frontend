import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, ExternalLink, FileText, FolderOpen, Search } from 'lucide-react'
import { Link, useSearchParams } from 'react-router-dom'
import { getSources } from '../api/knowledge'
import type { SourceResponse } from '../types/knowledge'
import PageHeader from '../components/ui/PageHeader'

const PAGE_SIZE = 30

export default function SourcesPage() {
  const [params, setParams] = useSearchParams()
  const query = params.get('q') || undefined
  const offset = Math.max(0, Number(params.get('offset') || 0))
  const [searchInput, setSearchInput] = useState(query || '')
  const [result, setResult] = useState<SourceResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => { setSearchInput(query || '') }, [query])

  const loadPage = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    try {
      setResult(await getSources({ q: query, limit: PAGE_SIZE, offset }))
    } catch (err) {
      console.error(err)
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [query, offset])

  useEffect(() => { void loadPage() }, [loadPage])

  const updateParams = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    Object.entries(updates).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key))
    setParams(next)
  }

  const pageRange = useMemo(() => {
    if (!result?.total) return '0 sources'
    return `${result.offset + 1}–${Math.min(result.offset + result.sources.length, result.total)} of ${result.total}`
  }, [result])

  if (loading && !result) return <div className="mx-auto max-w-6xl p-8 text-muted-foreground">Loading source registry…</div>
  if (loadError && !result) return <div className="page-shell page-stack"><div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">Failed to load sources. <button className="ml-2 font-bold underline" onClick={() => void loadPage()}>Retry</button></div></div>
  if (!result) return null

  return <div className="page-shell page-stack">
    <PageHeader eyebrow="Traceability" title="Sources & files" description="Search and inspect the original files connected to each document without loading the entire source registry." icon={FolderOpen} actions={<div className="flex flex-wrap items-center justify-end gap-2">
      <form onSubmit={event => { event.preventDefault(); updateParams({ q: searchInput.trim() || undefined, offset: undefined }) }} className="flex items-center rounded-full border border-border bg-surface/70 pl-3 focus-within:border-primary/50">
        <Search size={14} className="text-muted" /><input aria-label="Search sources" value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="Search files or documents…" className="w-40 bg-transparent px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted sm:w-56" /><button type="submit" className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">Search</button>
      </form>
      <span className="rounded-full border border-border bg-surface/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground">{pageRange}</span>
    </div>} />

    {loadError && <div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">Could not refresh the source registry. <button className="ml-2 font-bold underline" onClick={() => void loadPage()}>Retry</button></div>}
    <div className="grid gap-3">
      {result.sources.length === 0 ? <div className="glass-panel rounded-2xl border border-dashed border-border px-6 py-16 text-center text-sm text-muted-foreground">No source records match this search.</div> : result.sources.map(source => <div key={source.id} className="glass-panel interactive-lift flex flex-col justify-between gap-4 rounded-2xl border border-border p-4 sm:flex-row sm:items-center"><div className="flex min-w-0 items-center gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-info/10 text-info"><FileText size={18} /></div><div className="min-w-0"><div className="truncate text-sm font-bold text-foreground">{source.filename || source.source_ref}</div><div className="mt-1 truncate text-xs text-muted">{source.source_system} · {source.mime_type || 'unknown type'} · {source.source_ref}</div></div></div><Link to={`/articles/${source.article_id}`} className="flex shrink-0 items-center gap-1.5 text-xs font-bold text-primary hover:text-info">{source.article_title} <ExternalLink size={13} /></Link></div>)}
    </div>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><button type="button" disabled={result.offset <= 0} onClick={() => updateParams({ offset: String(Math.max(0, result.offset - PAGE_SIZE)) })} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold text-foreground transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-40"><ArrowLeft size={14} /> Previous</button><span className="text-xs text-muted-foreground">Showing {pageRange}</span><button type="button" disabled={result.offset + result.sources.length >= result.total} onClick={() => updateParams({ offset: String(result.offset + PAGE_SIZE) })} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold text-foreground transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-40">Next <ArrowRight size={14} /></button></div>
  </div>
}
