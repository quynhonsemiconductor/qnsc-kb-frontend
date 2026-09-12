import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, LayoutList, Network, RefreshCw, Search, Sparkles, Waypoints } from 'lucide-react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { GraphEntity, GraphEntityDetail, GraphRelationship, getGraphEntity, getGraphNeighbors, listGraphEntities, reprocessGraph } from '../../api/graph'
import PageHeader from '../../components/ui/PageHeader'
import { Button } from '../../components/ui/Button'
import { Input } from '../../components/ui/Input'
import { Select } from '../../components/ui/Select'
import { Badge } from '../../components/ui/Badge'
import { usePermission } from '../../hooks/usePermission'
import GraphCanvas, { TYPE_COLORS } from './graph/GraphCanvas'

const ENTITY_TYPES = ['person', 'organization', 'system', 'policy', 'location', 'product', 'concept', 'other']

function toCanvasLinks(relationships: GraphRelationship[]) {
  return relationships.map(edge => ({ id: edge.id, source: edge.source_entity_id, target: edge.target_entity_id, relation: edge.relation, description: edge.description }))
}

export default function GraphExplorerPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const [entities, setEntities] = useState<GraphEntity[]>([])
  const [query, setQuery] = useState(searchParams.get('q') || '')
  const [typeFilter, setTypeFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(searchParams.get('entity'))
  const [detail, setDetail] = useState<GraphEntityDetail | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [rebuilding, setRebuilding] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [viewMode, setViewMode] = useState<'graph' | 'list'>('graph')
  const [depth, setDepth] = useState(2)
  const [neighbors, setNeighbors] = useState<{ entities: GraphEntity[]; relationships: GraphRelationship[] } | null>(null)
  const [neighborsLoading, setNeighborsLoading] = useState(false)
  const navigate = useNavigate()
  const { has } = usePermission()

  const loadEntities = async (q: string, type: string) => {
    setLoading(true)
    setError('')
    try {
      setEntities(await listGraphEntities({ q: q || undefined, type: type || undefined, limit: 100 }))
    } catch (requestError: any) {
      setError(requestError?.response?.data?.detail || 'Could not load the knowledge graph.')
    } finally { setLoading(false) }
  }

  useEffect(() => { void loadEntities(query, typeFilter) }, [])

  useEffect(() => {
    const handle = setTimeout(() => { void loadEntities(query, typeFilter) }, 300)
    return () => clearTimeout(handle)
  }, [query, typeFilter])

  useEffect(() => {
    if (!selectedId) { setDetail(null); return }
    setDetailLoading(true)
    setSearchParams(previous => { const next = new URLSearchParams(previous); next.set('entity', selectedId); return next }, { replace: true })
    getGraphEntity(selectedId)
      .then(setDetail)
      .catch((requestError: any) => setError(requestError?.response?.data?.detail || 'Could not load this entity.'))
      .finally(() => setDetailLoading(false))
  }, [selectedId])

  // The canvas needs a focal node to center on. Nothing is selected on a fresh visit
  // (no `?entity=` in the URL), so the busiest node -- the list is already sorted by
  // mention_count -- becomes the default view instead of an empty diagram.
  useEffect(() => {
    if (!selectedId && entities.length) setSelectedId(entities[0].id)
  }, [entities])

  useEffect(() => {
    if (!selectedId || viewMode !== 'graph') return
    setNeighborsLoading(true)
    getGraphNeighbors(selectedId, depth)
      .then(setNeighbors)
      .catch((requestError: any) => setError(requestError?.response?.data?.detail || 'Could not load the graph around this entity.'))
      .finally(() => setNeighborsLoading(false))
  }, [selectedId, depth, viewMode])

  const rebuild = async () => {
    setRebuilding(true)
    setError('')
    try {
      const result = await reprocessGraph()
      setMessage(result.processed > 0
        ? `Extracted entities from ${result.processed} more article${result.processed === 1 ? '' : 's'}.${result.remaining_at_least > 0 ? ' More remain — run again to continue.' : ''}`
        : 'Every published article is already reflected in the graph.')
      await loadEntities(query, typeFilter)
    } catch (requestError: any) {
      setError(requestError?.response?.data?.detail || 'Could not rebuild the graph.')
    } finally { setRebuilding(false) }
  }

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const entity of entities) counts.set(entity.type, (counts.get(entity.type) || 0) + 1)
    return counts
  }, [entities])

  // Which currently-rendered graph nodes match the active search, so typing a query
  // highlights matches already on screen instead of doing nothing until a list item is
  // clicked (which still re-centers the view -- that stays an explicit navigation
  // action, distinct from just searching). `entities` is already server-filtered by
  // `query`, so intersecting it with the visible neighborhood is the match set.
  const highlightIds = useMemo(() => {
    if (!query.trim() || !neighbors) return undefined
    const matched = new Set(entities.map(entity => entity.id))
    return new Set(neighbors.entities.map(entity => entity.id).filter(id => matched.has(id)))
  }, [query, entities, neighbors])

  // The picture alone doesn't say what's WORTH noticing in it -- this turns the
  // rendered neighborhood into one sentence a reader can act on: who is the hub, and
  // who gets referenced the most, without them having to count edges themselves.
  const graphInsight = useMemo(() => {
    if (!neighbors || neighbors.entities.length < 2) return null
    if (!neighbors.relationships.length) return { sparse: true as const }
    const degree = new Map<string, number>()
    for (const rel of neighbors.relationships) {
      degree.set(rel.source_entity_id, (degree.get(rel.source_entity_id) || 0) + 1)
      degree.set(rel.target_entity_id, (degree.get(rel.target_entity_id) || 0) + 1)
    }
    const hub = [...neighbors.entities].sort((a, b) => (degree.get(b.id) || 0) - (degree.get(a.id) || 0))[0]
    const mostMentioned = [...neighbors.entities].sort((a, b) => b.mention_count - a.mention_count)[0]
    return { sparse: false as const, hub, hubDegree: degree.get(hub.id) || 0, mostMentioned, sameEntity: hub.id === mostMentioned.id }
  }, [neighbors])

  return <div className="page-shell page-stack text-foreground">
    <PageHeader
      eyebrow="Knowledge taxonomy"
      title="Knowledge graph"
      description="Entities and relationships extracted automatically from published articles — the people, systems, policies and concepts your documents actually talk about, and how they connect."
      icon={Network}
      actions={has('governance.read') && <Button variant="secondary" size="sm" disabled={rebuilding} loading={rebuilding} icon={<Sparkles size={15} />} onClick={() => void rebuild()}>{rebuilding ? 'Extracting…' : 'Extract from existing articles'}</Button>}
    />
    {(message || error) && <div role={error ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${error ? 'border-destructive/25 bg-destructive/10 text-destructive' : 'border-success/25 bg-success/10 text-success'}`}>{error || message}</div>}

    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,20rem)_1fr]">
      <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-[0_10px_28px_rgb(var(--shadow)/.08)]">
        <header className="flex flex-col gap-3 border-b border-border bg-surface px-4 py-4">
          <Input aria-label="Search entities" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search entities…" leftIcon={<Search size={14} />} />
          <Select aria-label="Filter by type" value={typeFilter} onChange={event => setTypeFilter(event.target.value)}>
            <option value="">All types ({entities.length})</option>
            {ENTITY_TYPES.filter(type => typeCounts.has(type)).map(type => <option key={type} value={type}>{type} ({typeCounts.get(type)})</option>)}
          </Select>
        </header>
        <div className="max-h-[60vh] divide-y divide-border overflow-y-auto">
          {loading ? <div className="grid min-h-40 place-items-center text-sm text-muted-foreground">Loading graph…</div>
            : !entities.length ? <div className="p-8 text-center text-sm text-muted-foreground">No entities yet. Publish an article, or extract from existing ones.</div>
            : entities.map(entity => (
              <button key={entity.id} type="button" onClick={() => setSelectedId(entity.id)} className={`flex w-full flex-col gap-1 px-4 py-3 text-left transition-colors hover:bg-surface ${selectedId === entity.id ? 'bg-primary/5' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="truncate font-semibold">{entity.name}</span>
                  <Badge variant="default" size="sm">{entity.type}</Badge>
                </div>
                {entity.description && <p className="line-clamp-2 text-xs text-muted-foreground">{entity.description}</p>}
                <span className="text-caption text-muted-foreground">{entity.mention_count} mention{entity.mention_count === 1 ? '' : 's'}</span>
              </button>
            ))}
        </div>
      </section>

      <section className="flex min-h-[24rem] flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-[0_10px_28px_rgb(var(--shadow)/.08)]">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="inline-flex rounded-xl border border-border bg-surface p-1">
            <button type="button" onClick={() => setViewMode('graph')} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-body-sm font-semibold transition-colors ${viewMode === 'graph' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}><Waypoints size={14} /> Graph</button>
            <button type="button" onClick={() => setViewMode('list')} className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-body-sm font-semibold transition-colors ${viewMode === 'list' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}><LayoutList size={14} /> List</button>
          </div>
          {viewMode === 'graph' && <Select aria-label="Neighborhood depth" value={String(depth)} onChange={event => setDepth(Number(event.target.value))} className="w-auto">
            <option value="1">1 hop</option>
            <option value="2">2 hops</option>
            <option value="3">3 hops</option>
          </Select>}
        </div>

        {!selectedId ? <div className="grid h-full min-h-[20rem] flex-1 place-items-center text-center text-sm text-muted-foreground"><div><Network size={28} className="mx-auto mb-3 opacity-40" /><p>Select an entity to see how it connects to the rest of the knowledge base.</p></div></div>
          : viewMode === 'graph' ? <div className="flex flex-1 flex-col gap-4">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
              <div className="flex flex-wrap gap-1.5">
                {Object.entries(TYPE_COLORS).map(([type, color]) => (
                  <span
                    key={type}
                    className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-caption font-semibold capitalize"
                    style={{ backgroundColor: `${color}14`, borderColor: `${color}30`, color }}
                  >
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} /> {type}
                  </span>
                ))}
              </div>
              {neighbors && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-muted px-3 py-1 text-caption font-semibold text-muted-foreground">
                  {neighbors.entities.length} entit{neighbors.entities.length === 1 ? 'y' : 'ies'} · {neighbors.relationships.length} relationship{neighbors.relationships.length === 1 ? '' : 's'}
                  {highlightIds && ` · ${highlightIds.size} match${highlightIds.size === 1 ? '' : 'es'}`}
                </span>
              )}
            </div>
            {neighbors && !!neighbors.entities.length && (
              <p className="text-caption text-muted-foreground">
                Larger circles are mentioned more often · hover a node or line for detail · drag to rearrange.
                {graphInsight && (graphInsight.sparse
                  ? ' Nothing here is linked yet — extract from more articles to connect them.'
                  : <>
                    {' '}
                    <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setSelectedId(graphInsight.hub.id)}>{graphInsight.hub.name}</button>
                    {' '}bridges the most connections here ({graphInsight.hubDegree}).
                    {!graphInsight.sameEntity && <>
                      {' '}
                      <button type="button" className="font-semibold text-primary hover:underline" onClick={() => setSelectedId(graphInsight.mostMentioned.id)}>{graphInsight.mostMentioned.name}</button>
                      {' '}is referenced the most ({graphInsight.mostMentioned.mention_count}×).
                    </>}
                  </>)}
              </p>
            )}
            {neighborsLoading || !neighbors ? <div className="grid min-h-[22rem] flex-1 place-items-center text-sm text-muted-foreground">Loading graph…</div>
              : neighbors.entities.length <= 1 ? <div className="grid min-h-[22rem] flex-1 place-items-center text-center text-sm text-muted-foreground"><p>No relationships extracted for this entity yet.</p></div>
              : <div className="min-h-[22rem] flex-1">
                <GraphCanvas
                  nodes={neighbors.entities.map(entity => ({ id: entity.id, name: entity.name, type: entity.type, mention_count: entity.mention_count, description: entity.description }))}
                  links={toCanvasLinks(neighbors.relationships)}
                  centerId={selectedId}
                  selectedId={selectedId}
                  onSelectNode={setSelectedId}
                  highlightIds={highlightIds}
                />
              </div>}
            {detail && <div className="rounded-xl border border-border bg-surface p-4">
              <div className="flex flex-wrap items-center gap-2"><h2 className="text-body-lg font-bold">{detail.name}</h2><Badge variant="default" size="sm">{detail.type}</Badge></div>
              {detail.description && <p className="mt-1 text-sm text-muted-foreground">{detail.description}</p>}
              {!!detail.articles.length && <div className="mt-2 flex flex-wrap gap-2">{detail.articles.map(article => <button key={article.id} type="button" onClick={() => navigate(`/articles/${article.id}`)} className="text-caption font-semibold text-primary hover:underline">{article.title}</button>)}</div>}
            </div>}
          </div>
          : detailLoading || !detail ? <div className="grid h-full min-h-[20rem] place-items-center text-sm text-muted-foreground">Loading…</div>
          : <div className="flex flex-col gap-6">
            <div>
              <div className="flex flex-wrap items-center gap-2"><h2 className="text-lg font-bold">{detail.name}</h2><Badge variant="default" size="sm">{detail.type}</Badge></div>
              {detail.description && <p className="mt-2 text-sm text-muted-foreground">{detail.description}</p>}
            </div>

            <div>
              <h3 className="mb-2 text-caption font-semibold uppercase tracking-widest text-muted-foreground">Relationships ({detail.relationships.length})</h3>
              {!detail.relationships.length ? <p className="text-sm text-muted-foreground">No relationships extracted for this entity yet.</p>
                : <ul className="space-y-2">
                  {detail.relationships.map(edge => (
                    <li key={edge.id} className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm">
                      {edge.direction === 'outgoing'
                        ? <><span className="font-semibold">{detail.name}</span><ArrowRight size={13} className="shrink-0 text-muted-foreground" /><span className="text-info">{edge.relation}</span><ArrowRight size={13} className="shrink-0 text-muted-foreground" /><button type="button" className="min-w-0 truncate font-semibold text-primary hover:underline" onClick={() => edge.other_entity && setSelectedId(edge.other_entity.id)}>{edge.other_entity?.name}</button></>
                        : <><button type="button" className="min-w-0 truncate font-semibold text-primary hover:underline" onClick={() => edge.other_entity && setSelectedId(edge.other_entity.id)}>{edge.other_entity?.name}</button><ArrowRight size={13} className="shrink-0 text-muted-foreground" /><span className="text-info">{edge.relation}</span><ArrowRight size={13} className="shrink-0 text-muted-foreground" /><span className="font-semibold">{detail.name}</span></>}
                    </li>
                  ))}
                </ul>}
            </div>

            <div>
              <h3 className="mb-2 text-caption font-semibold uppercase tracking-widest text-muted-foreground">Mentioned in ({detail.articles.length})</h3>
              {!detail.articles.length ? <p className="text-sm text-muted-foreground">No published article mentions this entity.</p>
                : <ul className="space-y-1.5">
                  {detail.articles.map(article => (
                    <li key={article.id}><button type="button" onClick={() => navigate(`/articles/${article.id}`)} className="truncate text-sm font-semibold text-primary hover:underline">{article.title}</button></li>
                  ))}
                </ul>}
            </div>
          </div>}
      </section>
    </div>
  </div>
}
