import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, ArrowRight, BookOpen, ChevronRight, Edit3, FolderTree, Hash, Library, MessageSquare, Plus, Search } from 'lucide-react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'
import { browseKnowledge, getKnowledgeCatalog, type KnowledgeCatalogResponse } from '../api/knowledge'
import type { BrowseResponse } from '../types/search'
import type { ArticleCard } from '../types/article'
import { useAuth } from '../auth/useAuth'
import { canEditArticleForUser } from '../utils/articlePermissions'
import { usePermission } from '../hooks/usePermission'
import { useLanguage } from '../i18n/LanguageProvider'
import { PageTransition } from '../components/ui/PageTransition'
import { Button } from '../components/ui/Button'
import { Badge } from '../components/ui/Badge'

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

function DocumentRow({ article, canEdit, canAsk }: { article: ArticleCard; canEdit: boolean; canAsk: boolean }) {
  const requestPrompt = `I need help identifying who is allowed to change the knowledge-base article "${article.title}" (article ID: ${article.id}). I cannot change it directly. Please explain which role or person owns this responsibility and help me prepare a clear request for them.`
  return <article className="group grid min-h-[4.75rem] grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3 transition hover:bg-surface-elevated lg:grid-cols-[2.25rem_minmax(0,1fr)_10rem_7rem_auto]">
    <span className="grid h-9 w-8 place-items-center rounded-lg border border-border bg-background font-mono text-caption font-semibold text-primary">DOC</span>
    <div className="min-w-0">
      <div className="flex min-w-0 flex-wrap items-center gap-1.5">{topicsFor(article).slice(0, 2).map(topic => <span key={topic} className="rounded-md bg-primary/10 px-1.5 py-0.5 text-caption font-semibold text-primary-text">#{topic}</span>)}</div>
      <Link to={`/articles/${article.id}`} className="mt-1.5 block truncate text-body font-bold text-foreground no-underline group-hover:text-primary">{article.title}</Link>
      <p className="mt-1 truncate font-mono text-caption text-muted">v{article.version}</p>
    </div>
    <div className="hidden min-w-0 lg:block"><p className="truncate text-body-sm font-semibold text-foreground">{article.owner || 'Unassigned'}</p><p className="mt-1 text-caption text-muted">Owner</p></div>
    <Badge variant="success" size="sm" className="hidden rounded-md lg:inline-flex">Published</Badge>
    <div className="flex items-center justify-end gap-1">
      <Link to={`/articles/${article.id}`} className="inline-flex min-h-8 items-center gap-1.5 rounded-control bg-primary px-2.5 text-body-sm font-bold text-primary-foreground no-underline"><BookOpen size={13} /><span className="hidden sm:inline">Open</span></Link>
      {canEdit ? <Link to={`/articles/${article.id}/edit`} aria-label={`Edit ${article.title}`} className="inline-grid min-h-8 min-w-8 place-items-center rounded-control border border-border bg-surface text-foreground no-underline hover:border-primary"><Edit3 size={13} /></Link> : canAsk ? <Link to={`/ai?articleId=${encodeURIComponent(article.id)}&articleTitle=${encodeURIComponent(article.title)}&prompt=${encodeURIComponent(requestPrompt)}`} aria-label={`Request edit for ${article.title}`} className="inline-grid min-h-8 min-w-8 place-items-center rounded-control border border-info/30 bg-info/10 text-info-text no-underline"><MessageSquare size={13} /></Link> : null}
    </div>
  </article>
}

export default function BrowsePage() {
  const { user } = useAuth()
  const { has } = usePermission()
  const { language } = useLanguage()
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
    } catch (error) {
      console.error(error)
      setLoadError(true)
    }
  }, [dept, topic, query, offset])

  useEffect(() => { void loadPage() }, [loadPage])

  const updateParams = (updates: Record<string, string | undefined>) => {
    const next = new URLSearchParams(params)
    Object.entries(updates).forEach(([key, value]) => value ? next.set(key, value) : next.delete(key))
    setParams(next)
  }

  const pageRange = useMemo(() => {
    if (!data?.total) return '0 documents'
    return `${data.offset + 1}–${Math.min(data.offset + data.articles.length, data.total)} of ${data.total}`
  }, [data])

  if (!data || !catalog) return loadError
    ? <div className="page-shell"><div role="alert" className="rounded-surface border border-destructive/25 bg-destructive/10 px-4 py-3 text-body text-destructive-text">Failed to load the knowledge library. <button className="ml-2 font-bold underline" onClick={() => void loadPage()}>Retry</button></div></div>
    : <div className="page-shell grid min-h-[65vh] place-items-center text-body text-muted-foreground"><span className="flex items-center gap-2"><span className="h-2 w-2 animate-pulse rounded-full bg-primary" />Loading the knowledge library…</span></div>

  return <PageTransition className="-mx-3 -my-4 h-[calc(100%+2rem)] overflow-hidden sm:-mx-5 sm:h-[calc(100%+2rem)] lg:-mx-7">
    <div className="flex h-full min-h-0 flex-col">
      <header className="shrink-0 border-b border-border bg-surface px-4 py-4 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <div className="min-w-0"><p className="font-mono text-caption font-medium uppercase tracking-[.1em] text-primary">{language === 'vi' ? 'Khám phá theo ngữ cảnh' : 'Contextual knowledge explorer'}</p><h1 className="mt-1 truncate font-display text-h3 font-bold tracking-tight text-foreground">{dept || (language === 'vi' ? 'Tất cả phòng ban' : 'All departments')}{topic ? <span className="font-normal text-muted-foreground"> / {topic}</span> : null}</h1><p className="mt-1 text-body-sm text-muted-foreground">{language === 'vi' ? 'Duyệt theo Phòng ban → Chủ đề → Tài liệu' : 'Browse Department → Topic → Document'}</p></div>
          <form onSubmit={event => { event.preventDefault(); updateParams({ q: searchInput.trim() || undefined, offset: undefined }) }} className="flex min-w-0 flex-1 items-center rounded-xl border border-border bg-background px-3 xl:ml-auto xl:max-w-md">
            <Search size={14} className="text-primary" /><input aria-label="Search documents" value={searchInput} onChange={event => setSearchInput(event.target.value)} placeholder={language === 'vi' ? 'Tìm trong phạm vi hiện tại…' : 'Search within the current scope…'} className="h-9 min-w-0 flex-1 bg-transparent px-2 text-body-sm outline-none" /><button type="submit" className="text-body-sm font-bold text-primary">Search</button>
          </form>
          <div className="flex shrink-0 gap-2"><Link to="/articles/manage" className="inline-flex min-h-9 items-center rounded-control border border-border bg-surface px-3 text-body-sm font-bold text-foreground no-underline">Manage documents</Link>{has('article.create') && <Link to="/articles/new" className="inline-flex min-h-9 items-center gap-1.5 rounded-control bg-primary px-3 text-body-sm font-bold text-primary-foreground no-underline"><Plus size={13} />New article</Link>}</div>
        </div>
      </header>

      <nav aria-label="Knowledge path" className="flex shrink-0 flex-wrap items-center gap-1.5 border-b border-border bg-surface-muted px-4 py-2 text-caption font-semibold text-muted-foreground sm:px-6">
        <Link to={browsePath(basePath, undefined, undefined, query)} className="no-underline hover:text-primary">All departments</Link>
        {dept && <><ChevronRight size={13} /><Link to={browsePath(basePath, dept, undefined, query)} className={`no-underline hover:text-primary ${!topic ? 'text-foreground' : ''}`}>{dept}</Link></>}
        {topic && <><ChevronRight size={13} /><span className="text-foreground">{topic}</span></>}
        <span className="ml-auto font-mono text-muted">{pageRange}</span>
      </nav>

      <div className="grid min-h-0 flex-1 bg-surface-muted md:grid-cols-[13rem_15rem_minmax(0,1fr)]">
        <section className="app-scroll min-h-0 overflow-y-auto border-r border-border bg-surface">
          <div className="sticky top-0 z-sticky flex h-11 items-center border-b border-border bg-surface/95 px-3"><FolderTree size={14} className="mr-2 text-primary" /><strong className="text-body-sm">Departments</strong><span className="ml-auto font-mono text-caption text-muted">{catalog.departments.length}</span></div>
          {catalog.departments.map(group => <Link key={group.name} to={browsePath(basePath, group.name, undefined, query)} className={`flex min-h-[3.65rem] items-center gap-2.5 border-b border-border px-3 text-foreground no-underline transition hover:bg-surface-muted ${dept === group.name ? 'bg-primary/10 text-primary-text' : ''}`}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-surface-muted text-primary"><FolderTree size={15} /></span><span className="min-w-0"><strong className="block truncate text-body-sm">{group.name}</strong><span className="mt-0.5 block text-caption text-muted">{group.count} documents</span></span><ChevronRight size={14} className="ml-auto shrink-0 text-muted" /></Link>)}
        </section>

        <section className={`app-scroll min-h-0 overflow-y-auto border-r border-border bg-surface ${dept ? 'block' : 'hidden md:block'}`}>
          <div className="sticky top-0 z-sticky flex h-11 items-center border-b border-border bg-surface/95 px-3"><Hash size={14} className="mr-2 text-primary" /><strong className="text-body-sm">Topics</strong><span className="ml-auto font-mono text-caption text-muted">{catalog.topics.length}</span></div>
          {dept ? catalog.topics.map(group => <Link key={group.name} to={browsePath(basePath, dept, group.name, query)} className={`flex min-h-[3.65rem] items-center gap-2.5 border-b border-border px-3 text-foreground no-underline transition hover:bg-surface-muted ${topic === group.name ? 'bg-primary/10 text-primary-text' : ''}`}><span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Hash size={15} /></span><span className="min-w-0"><strong className="block truncate text-body-sm">{group.name}</strong><span className="mt-0.5 block text-caption text-muted">{group.count} documents</span></span><ChevronRight size={14} className="ml-auto shrink-0 text-muted" /></Link>) : <div className="grid min-h-48 place-items-center px-5 text-center text-body-sm text-muted"><div><Library size={24} className="mx-auto mb-3 text-primary/50" />{language === 'vi' ? 'Chọn một phòng ban để xem chủ đề.' : 'Choose a department to see its topics.'}</div></div>}
        </section>

        <section className="flex min-h-0 min-w-0 flex-col bg-surface">
          <div className="flex h-11 shrink-0 items-center border-b border-border px-4"><BookOpen size={14} className="mr-2 text-primary" /><strong className="text-body-sm">{query ? `Results for “${query}”` : topic ? `Documents in ${topic}` : dept ? `Documents in ${dept}` : 'Documents'}</strong><span className="ml-auto font-mono text-caption text-muted">{data.total}</span></div>
          <div className="app-scroll min-h-0 flex-1 overflow-y-auto">
            {data.articles.length ? data.articles.map(article => <DocumentRow key={article.id} article={article} canEdit={canEditArticleForUser(user, article)} canAsk={Boolean(user?.permissions?.includes('ai.ask'))} />) : <div className="grid min-h-64 place-items-center px-6 text-center text-body-sm text-muted-foreground">{dept || query ? 'No documents match this part of the library.' : 'Choose a department to begin exploring.'}</div>}
          </div>
          <footer className="flex min-h-12 shrink-0 items-center justify-between border-t border-border px-4 text-caption text-muted"><Button type="button" variant="secondary" size="sm" disabled={data.offset <= 0} onClick={() => updateParams({ offset: String(Math.max(0, data.offset - PAGE_SIZE)) })} icon={<ArrowLeft size={13} />}>Previous</Button><span className="font-mono">{pageRange}</span><Button type="button" variant="secondary" size="sm" disabled={data.offset + data.articles.length >= data.total} onClick={() => updateParams({ offset: String(data.offset + PAGE_SIZE) })} icon={<ArrowRight size={13} />} iconPosition="right">Next</Button></footer>
        </section>
      </div>
    </div>
  </PageTransition>
}
