import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, ChevronRight, Edit3, FolderTree, Hash, Library, MessageSquare, Search } from 'lucide-react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { browseKnowledge, getKnowledgeCatalog, type KnowledgeCatalogResponse } from '../api/knowledge'
import type { BrowseResponse } from '../types/search'
import type { ArticleCard } from '../types/article'
import PageHeader from '../components/ui/PageHeader'
import { useAuth } from '../auth/useAuth'
import { canEditArticleForUser } from '../utils/articlePermissions'

const PAGE_SIZE = 24

function topicsFor(article: ArticleCard) {
  const topics = (article.tags || []).map(tag => tag.trim()).filter(Boolean)
  return topics.length ? topics : ['General knowledge']
}

function browsePath(basePath: string, dept?: string, topic?: string, query?: string) {
  const next = new URLSearchParams()
  if (dept) next.set('dept', dept)
  if (topic) next.set('topic', topic)
  if (query) next.set('q', query)
  const value = next.toString()
  return `${basePath}${value ? `?${value}` : ''}`
}

function DocumentCard({ article, canEdit, canAsk }: { article: ArticleCard; canEdit: boolean; canAsk: boolean }) {
  const requestPrompt = `I need help identifying who is allowed to change the knowledge-base article "${article.title}" (article ID: ${article.id}). I cannot change it directly. Please explain which role or person owns this responsibility and help me prepare a clear request for them.`
  return <article className="glass-panel interactive-lift group rounded-2xl border border-border p-5">
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 flex-wrap gap-2 text-[10px] font-bold uppercase tracking-[.1em] text-primary">
        {topicsFor(article).slice(0, 3).map(topic => <span key={topic} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-1"><Hash size={10} />{topic}</span>)}
      </div>
      <ArrowUpRight size={16} className="shrink-0 text-muted transition group-hover:text-primary" />
    </div>
    <Link to={`/articles/${article.id}`} className="mt-4 block font-display text-base font-bold leading-6 text-foreground hover:text-primary">{article.title}</Link>
    <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted"><BookOpen size={13} /> {article.owner || 'Unassigned'} <span>·</span> v{article.version}</div>
    <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
      <Link to={`/articles/${article.id}`} className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground transition hover:bg-primary/90"><BookOpen size={13} /> Open document</Link>
      {canEdit ? <Link to={`/articles/${article.id}/edit`} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs font-bold text-foreground transition hover:border-primary hover:text-primary"><Edit3 size={13} /> Edit</Link> : canAsk ? <Link to={`/ai?articleId=${encodeURIComponent(article.id)}&articleTitle=${encodeURIComponent(article.title)}&prompt=${encodeURIComponent(requestPrompt)}`} className="inline-flex items-center gap-1.5 rounded-lg border border-info/30 bg-info/10 px-3 py-2 text-xs font-bold text-info transition hover:bg-info/15"><MessageSquare size={13} /> Request edit</Link> : null}
    </div>
  </article>
}

function CatalogLevel({ catalog, basePath, dept, topic, query }: { catalog: KnowledgeCatalogResponse; basePath: string; dept?: string; topic?: string; query?: string }) {
  if (!dept) return <section className="space-y-4">
    <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Level 1</p><h2 className="mt-1 font-display text-xl font-bold text-foreground">Choose a department</h2></div>
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {catalog.departments.map(group => <Link key={group.name} to={browsePath(basePath, group.name, undefined, query)} className="glass-panel interactive-lift group rounded-2xl border border-border p-5">
        <div className="flex items-start justify-between"><span className="grid h-10 w-10 place-items-center rounded-xl bg-info/10 text-info"><FolderTree size={18} /></span><ArrowUpRight size={16} className="text-muted group-hover:text-primary" /></div>
        <h2 className="mt-5 font-display text-lg font-bold text-foreground group-hover:text-primary">{group.name}</h2><p className="mt-1 text-sm text-muted-foreground">{group.count} document{group.count === 1 ? '' : 's'}</p>
      </Link>)}
    </div>
  </section>

  if (topic) return null
  return <section className="space-y-4">
    <div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">Level 2</p><h2 className="mt-1 font-display text-xl font-bold text-foreground">Choose a topic</h2></div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {catalog.topics.map(group => <Link key={group.name} to={browsePath(basePath, dept, group.name, query)} className="interactive-lift flex items-center gap-3 rounded-xl border border-border bg-surface-elevated p-4 transition hover:border-primary/40">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/10 text-primary"><Hash size={16} /></span><span className="min-w-0 flex-1"><span className="block truncate font-semibold text-foreground">{group.name}</span><span className="mt-0.5 block text-xs text-muted-foreground">{group.count} document{group.count === 1 ? '' : 's'}</span></span><ChevronRight size={15} className="text-muted" />
      </Link>)}
    </div>
  </section>
}

export default function BrowsePage() {
  const { user } = useAuth()
  const location = useLocation()
  const [params, setParams] = useSearchParams()
  const basePath = location.pathname.startsWith('/articles') ? '/articles' : '/browse'
  const dept = params.get('dept') || undefined
  const topic = params.get('topic') || undefined
  const query = params.get('q') || undefined
  const offset = Math.max(0, Number(params.get('offset') || 0))
  const [searchInput, setSearchInput] = useState(query || '')
  const [data, setData] = useState<BrowseResponse | null>(null)
  const [catalog, setCatalog] = useState<KnowledgeCatalogResponse | null>(null)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => { setSearchInput(query || '') }, [query])

  const loadPage = useCallback(async () => {
    setData(null)
    setCatalog(null)
    setLoadError(false)
    try {
      const [page, hierarchy] = await Promise.all([
        browseKnowledge({ dept, topic, q: query, limit: PAGE_SIZE, offset }),
        getKnowledgeCatalog({ dept, q: query }),
      ])
      setData(page)
      setCatalog(hierarchy)
    } catch (err) {
      console.error(err)
      setLoadError(true)
    }
  }, [dept, topic, query, offset])

  useEffect(() => { void loadPage() }, [loadPage])

  const updateParams = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    Object.entries(updates).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key))
    setParams(next)
  }

  const heading = topic || dept || (query ? `Search results for “${query}”` : 'Knowledge library')
  const description = topic
    ? `Documents in ${topic}, within ${dept || 'all departments'}.`
    : dept
      ? `Choose a topic to narrow the ${dept} knowledge space.`
      : 'Start with a department, then choose a topic to reach the document you need.'
  const pageRange = useMemo(() => {
    if (!data?.total) return '0 documents'
    return `${data.offset + 1}–${Math.min(data.offset + data.articles.length, data.total)} of ${data.total}`
  }, [data])

  if (!data || !catalog) return loadError
    ? <div className="page-shell page-stack"><div role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">Failed to load the knowledge library. <button className="ml-2 font-bold underline" onClick={() => void loadPage()}>Retry</button></div></div>
    : <div className="mx-auto max-w-6xl p-8 text-muted-foreground">Loading knowledge library…</div>

  return <div className="page-shell page-stack">
    <PageHeader eyebrow="Wiki-style knowledge" title={heading} description={description} icon={topic ? Hash : dept ? FolderTree : Library} actions={<div className="flex flex-wrap items-center justify-end gap-2">
      <form onSubmit={event => { event.preventDefault(); updateParams({ q: searchInput.trim() || undefined, offset: undefined }) }} className="flex items-center rounded-full border border-border bg-surface/70 pl-3 focus-within:border-primary/50">
        <Search size={14} className="text-muted" /><input aria-label="Search documents" value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder="Search titles…" className="w-36 bg-transparent px-2 py-1.5 text-xs text-foreground outline-none placeholder:text-muted sm:w-48" /><button type="submit" className="rounded-full bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground">Search</button>
      </form>
      <Link to="/articles/manage" className="rounded-full border border-border bg-surface/70 px-3 py-1.5 text-xs font-bold text-foreground transition hover:border-primary hover:text-primary">Manage documents</Link>
      <span className="rounded-full border border-border bg-surface/70 px-3 py-1.5 text-xs font-semibold text-muted-foreground"><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-success" />{pageRange}</span>
    </div>} />

    <nav aria-label="Knowledge path" className="flex flex-wrap items-center gap-1.5 text-xs font-semibold text-muted-foreground">
      <Link to={browsePath(basePath, undefined, undefined, query)} className="transition hover:text-primary">All departments</Link>
      {dept && <><ChevronRight size={14} /><Link to={browsePath(basePath, dept, undefined, query)} className={`transition hover:text-primary ${!topic ? 'text-foreground' : ''}`}>{dept}</Link></>}
      {topic && <><ChevronRight size={14} /><span className="text-foreground">{topic}</span></>}
    </nav>

    {!query && <CatalogLevel catalog={catalog} basePath={basePath} dept={dept} topic={topic} query={query} />}

    {(dept || topic || query) && <section className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[.18em] text-primary">{topic ? 'Level 3' : query ? 'Search index' : 'Document index'}</p><h2 className="mt-1 font-display text-xl font-bold text-foreground">{query ? `Matching documents` : topic ? `Documents in ${topic}` : dept ? 'Documents in this department' : 'Recently available documents'}</h2></div><span className="text-xs text-muted-foreground">Server-side pagination · {pageRange}</span></div>
      {data.articles.length ? <div className="grid gap-3 md:grid-cols-2">{data.articles.map(article => <DocumentCard key={article.id} article={article} canEdit={canEditArticleForUser(user, article)} canAsk={Boolean(user?.permissions?.includes('ai.ask'))} />)}</div> : <div className="rounded-2xl border border-dashed border-border bg-surface/60 px-5 py-12 text-center text-sm text-muted-foreground">No documents match this part of the library.</div>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"><button type="button" disabled={data.offset <= 0} onClick={() => updateParams({ offset: String(Math.max(0, data.offset - PAGE_SIZE)) })} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold text-foreground transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-40"><ArrowLeft size={14} /> Previous</button><span className="text-xs text-muted-foreground">Showing {pageRange}</span><button type="button" disabled={data.offset + data.articles.length >= data.total} onClick={() => updateParams({ offset: String(data.offset + PAGE_SIZE) })} className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2 text-xs font-bold text-foreground transition hover:border-primary disabled:cursor-not-allowed disabled:opacity-40">Next <ArrowRight size={14} /></button></div>
    </section>}

    {(dept || topic || query) && <Link to={topic ? browsePath(basePath, dept, undefined, query) : dept ? browsePath(basePath, undefined, undefined, query) : basePath} className="inline-flex w-fit items-center gap-2 text-sm font-bold text-primary hover:text-info"><ArrowLeft size={15} /> Back one level</Link>}
  </div>
}
