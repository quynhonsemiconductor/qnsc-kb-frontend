import { FormEvent, useEffect, useMemo, useState } from 'react'
import { ArchiveRestore, Check, ChevronRight, Plus, RefreshCw, Tag as TagIcon, Trash2, X } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { createTagCatalogItem, deprecateTagCatalogItem, getTagCatalog, getTags, TagCatalogItem } from '../../api/search'
import PageHeader from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { buildTagTree } from '../../utils/tagTree'

export default function TagsPage() {
  const [tags, setTags] = useState<string[]>([])
  const [catalog, setCatalog] = useState<TagCatalogItem[]>([])
  const [formTag, setFormTag] = useState('')
  const [formParentId, setFormParentId] = useState('')
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [acting, setActing] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const [usedTags, catalogue] = await Promise.all([getTags(), getTagCatalog()])
      setTags(usedTags)
      setCatalog(catalogue)
    } catch (requestError: any) {
      setError(requestError?.response?.data?.detail || 'Could not load the tag catalogue.')
    } finally { setLoading(false) }
  }

  useEffect(() => { void load() }, [])

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    const value = formTag.trim()
    if (!value) return
    setActing('create')
    setError('')
    try {
      const created = await createTagCatalogItem(value, formParentId || null)
      setCatalog(items => [...items, created].sort((a, b) => a.normalized_tag.localeCompare(b.normalized_tag)))
      setFormTag('')
      setFormParentId('')
      setMessage(`Added ${created.tag} to the approved vocabulary.`)
    } catch (requestError: any) {
      setError(requestError?.response?.data?.detail || 'Could not add this tag.')
    } finally { setActing(null) }
  }

  const deprecate = async (item: TagCatalogItem) => {
    setActing(item.id)
    setError('')
    try {
      await deprecateTagCatalogItem(item.id)
      setCatalog(items => items.map(current => current.id === item.id ? { ...current, active: false } : current))
      setMessage(`${item.tag} is no longer suggested for new content.`)
    } catch (requestError: any) {
      setError(requestError?.response?.data?.detail || 'Could not deprecate this tag.')
    } finally { setActing(null) }
  }

  const visibleCatalog = useMemo(() => {
    const normalized = query.trim().toLowerCase()
    return catalog.filter(item => !normalized || `${item.tag} ${item.normalized_tag}`.toLowerCase().includes(normalized))
  }, [catalog, query])

  // Root tags sorted alphabetically, each followed immediately by its own children --
  // a tree flattened into one ordered list is simpler to render than nested JSX and
  // still reads top-to-bottom as a hierarchy once each child carries its own indent.
  const treeOrder = useMemo(() => buildTagTree(catalog), [catalog])

  const visibleTreeOrder = useMemo(() => {
    if (!query.trim()) return treeOrder
    const visibleIds = new Set(visibleCatalog.map(item => item.id))
    return treeOrder.filter(({ item }) => visibleIds.has(item.id))
  }, [treeOrder, visibleCatalog, query])

  const parentOptions = useMemo(() => catalog.filter(item => item.active), [catalog])

  return <div className="page-shell page-stack text-foreground">
    <PageHeader eyebrow="Knowledge taxonomy" title="Tags database" description="Manage the approved vocabulary used by AI suggestions and browse tags already used by articles." icon={TagIcon} actions={<Button variant="secondary" size="sm" icon={<RefreshCw size={15} className={loading ? 'animate-spin' : ''} />} onClick={() => void load()}>Refresh</Button>} />
    {(message || error) && <div role={error ? 'alert' : 'status'} className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-3 text-sm ${error ? 'border-destructive/25 bg-destructive/10 text-destructive' : 'border-success/25 bg-success/10 text-success'}`}><span>{error || message}</span><Button variant="ghost" size="sm" aria-label="Dismiss" onClick={() => { setMessage(''); setError('') }} icon={<X size={15} />} /></div>}
    <form onSubmit={submit} className="rounded-2xl border border-primary/20 bg-card p-5 shadow-[0_10px_28px_rgb(var(--shadow)/.08)]"><div className="mb-4 flex items-center gap-3"><span className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary"><Plus size={17} /></span><div><h2 className="font-semibold">Add approved tag</h2><p className="text-xs text-muted-foreground">Only active catalogue tags can be suggested by AI. Choose a parent to file it under an existing tag.</p></div></div><div className="flex flex-col gap-3 sm:flex-row"><Input required maxLength={80} value={formTag} onChange={event => setFormTag(event.target.value)} placeholder="e.g. PCCC" className="flex-1" /><div className="sm:w-56"><Select value={formParentId} onChange={event => setFormParentId(event.target.value)} aria-label="Parent tag"><option value="">No parent (top-level)</option>{parentOptions.map(option => <option key={option.id} value={option.id}>{option.tag}</option>)}</Select></div><Button type="submit" variant="primary" disabled={acting === 'create'} loading={acting === 'create'} icon={<Plus size={15} />}>{acting === 'create' ? 'Adding…' : 'Add tag'}</Button></div></form>
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_10px_28px_rgb(var(--shadow)/.08)]"><header className="flex flex-col gap-3 border-b border-border bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between"><div><h2 className="font-semibold">Approved vocabulary</h2><p className="mt-1 text-xs text-muted-foreground">{catalog.filter(item => item.active).length} active · {catalog.filter(item => !item.active).length} deprecated</p></div><Input aria-label="Search tag catalogue" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search approved tags…" className="w-full sm:w-64" /></header>{loading ? <div className="grid min-h-40 place-items-center text-sm text-muted-foreground">Loading tag catalogue…</div> : !visibleTreeOrder.length ? <div className="p-10 text-center text-sm text-muted-foreground">No catalogue tags match this view.</div> : <div className="divide-y divide-border">{visibleTreeOrder.map(({ item, depth }) => <article key={item.id} style={{ paddingLeft: `${1.25 + depth * 1.5}rem` }} className={`flex flex-col gap-3 py-4 pr-5 sm:flex-row sm:items-center sm:justify-between ${!item.active ? 'opacity-60' : ''}`}><div className="flex min-w-0 items-center gap-3">{depth > 0 && <ChevronRight size={13} className="shrink-0 text-muted-foreground" />}<span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-info/10 text-info"><TagIcon size={15} /></span><div><p className="font-semibold">{item.tag}</p><p className="mt-1 text-xs text-muted-foreground">{item.active ? 'Active and available to AI suggestions' : 'Deprecated; retained for historical articles'}</p></div></div><div className="flex flex-wrap gap-2"><Button variant="secondary" size="sm" icon={<TagIcon size={13} />} onClick={() => navigate(`/articles?q=${encodeURIComponent(item.tag)}`)}>View articles</Button>{item.active ? <Button variant="ghost" size="sm" disabled={acting === item.id} onClick={() => void deprecate(item)} icon={<Trash2 size={13} />} className="border border-warning/25 bg-warning/5 text-warning">Deprecate</Button> : <Badge variant="default" size="md"><ArchiveRestore size={13} /> Deprecated</Badge>}</div></article>)}</div>}</section>
    <section className="rounded-2xl border border-border bg-surface p-5"><div className="flex items-center gap-2"><Check size={16} className="text-success" /><h2 className="font-semibold">Tags currently used by articles</h2></div><div className="mt-4 flex flex-wrap gap-2">{tags.length ? tags.map(tag => <Button key={tag} variant="secondary" size="sm" onClick={() => navigate(`/articles?q=${encodeURIComponent(tag)}`)}>{tag}</Button>) : <span className="text-sm text-muted-foreground">No article tags found yet.</span>}</div></section>
  </div>
}
