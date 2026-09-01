import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Search as SearchIcon, Filter, Layers, FileText, ArrowRight, X, Sparkles } from 'lucide-react'
import { search } from '../../api/search'
import { listDepartments } from '../../api/auth'
import { useAuth } from '../../auth/useAuth'
import { useLanguage } from '../../i18n/LanguageProvider'
import { requestContent } from '../../api/knowledge'
import { safeExternalUrl } from '../../lib/formatters'
import PageHeader from '../../components/ui/PageHeader'
import { Select } from '../../components/ui/Select'
import { Input } from '../../components/ui/Input'
import { Button } from '../../components/ui/Button'
import { PageTransition } from '../../components/ui/PageTransition'
import { Badge } from '../../components/ui/Badge'

// The API validates `limit` as ge=1, le=20, so 20 is the most this surface can ever show.
// It is a deliberate ceiling on the reranked candidate pool, not a page size.
const SEARCH_LIMIT_STEP = 10
const SEARCH_LIMIT_MAX = 20

export default function SearchResultsPage() {
  // Seeded from the URL. /search?q=… is a shareable, linkable address: what a colleague
  // pastes into chat, what a citation points at, what a bookmark holds. Reading the query
  // only from local state meant every one of those arrived at an empty form showing no
  // results, with nothing to say the query had been dropped.
  const [searchParams, setSearchParams] = useSearchParams()
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '')
  const [dept, setDept] = useState('')
  const [tag, setTag] = useState('')
  const [status, setStatus] = useState('published')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [results, setResults] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  // Raised by "load more" up to SEARCH_LIMIT_MAX. /search is a ranked-retrieval surface
  // with no offset — the server caps the candidate pool — so this widens the window
  // rather than paging through it.
  const [limit, setLimit] = useState(SEARCH_LIMIT_STEP)
  const [requested, setRequested] = useState(false)
  const [error, setError] = useState(false)
  const [departments, setDepartments] = useState<{ id: string; name: string; company_domain: string; active: boolean }[]>([])

  const { t } = useLanguage()
  const { user } = useAuth()
  // Aborts the previous request on every new submit. Without it a slow earlier query could
  // resolve after a newer one and overwrite the results the user is looking at.
  const requestRef = useRef<AbortController | null>(null)

  useEffect(() => () => requestRef.current?.abort(), [])

  useEffect(() => {
    void listDepartments().then(setDepartments).catch((err) => console.error('Failed to load departments', err))
  }, [])

  const visibleDepartments = useMemo(
    () => departments.filter(item => item.active && item.company_domain === user?.company_domain),
    [departments, user?.company_domain],
  )

  useEffect(() => {
    if (dept && !visibleDepartments.some(item => item.name === dept)) setDept('')
  }, [dept, visibleDepartments])

  const handleSearch = async (e?: React.FormEvent, nextLimit = SEARCH_LIMIT_STEP) => {
    e?.preventDefault()
    if (!query.trim()) return
    // Keep the address bar in step with what is on screen, so a refined result set stays
    // as shareable as the one the user arrived on. `replace` rather than push: a search box
    // is not a navigation history, and pushing every submit would make Back walk backwards
    // through queries instead of leaving the page.
    const nextParams = new URLSearchParams(searchParams)
    nextParams.set('q', query.trim())
    setSearchParams(nextParams, { replace: true })
    requestRef.current?.abort()
    const controller = new AbortController()
    requestRef.current = controller
    setLoading(true)
    setSearched(true)
    setError(false)

    try {
      const data = await search({
        q: query,
        dept: dept || undefined,
        tag: tag.trim() || undefined,
        status: status || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo ? `${dateTo}T23:59:59` : undefined,
        limit: nextLimit
      }, controller.signal)
      setResults(data)
      setLimit(nextLimit)
    } catch (err) {
      // A cancelled request is not a failure: its replacement is already in flight, and
      // showing an error for it would flash a banner on every keystroke-fast resubmit.
      if (controller.signal.aborted) return
      console.error(err)
      setError(true)
    } finally {
      if (!controller.signal.aborted) setLoading(false)
    }
  }

  // Runs the query that arrived in the URL, exactly once per mount. A seeded input that
  // never fires is worse than an empty one: the page looks like it searched and found
  // nothing. The ref guard is what holds this to a single request — `handleSearch` closes
  // over the filter state, so declaring it a dependency would re-fire the search on every
  // filter change and take the explicit Search button out of the user's hands.
  const seededRef = useRef(false)
  useEffect(() => {
    if (seededRef.current) return
    seededRef.current = true
    if (searchParams.get('q')?.trim()) void handleSearch()
  })

  const clearFilters = () => {
    setDept('')
    setTag('')
    setStatus('published')
    setDateFrom('')
    setDateTo('')
  }

  const hasActiveFilters = dept || tag || status !== 'published' || dateFrom || dateTo

  return (
    <PageTransition className="page-shell page-stack">
      <PageHeader
        eyebrow="Discovery engine"
        title={t('search.hybrid')}
        description={t('search.subtitle')}
        icon={SearchIcon}
        actions={
          <Badge variant="info" size="md">
            <Sparkles size={13} />
            Hybrid retrieval
          </Badge>
        }
      />

      {/* Search form */}
      <form onSubmit={handleSearch} className="glass-panel soft-grid space-y-5 rounded-panel border border-border p-5 sm:p-6">
        {/* Search bar */}
        <div className="flex items-stretch gap-3">
          <div className="flex-1">
            <Input
              placeholder={t('search.placeholder')}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              leftIcon={<SearchIcon size={18} />}
              required
            />
          </div>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={loading}
            icon={<SearchIcon size={16} />}
          >
            {loading ? t('search.searching') : t('nav.search')}
          </Button>
        </div>

        {/* Filters section */}
        <div className="space-y-4 border-t border-border/60 pt-4">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-body-sm font-semibold uppercase tracking-wider text-muted">
              <Filter size={14} />
              {t('search.filters')}
            </span>
            {hasActiveFilters && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                icon={<X size={14} />}
                className="text-destructive hover:text-destructive/80"
              >
                {t('search.reset')}
              </Button>
            )}
          </div>

          {/* Tracks are `minmax(0,1fr)`, not the bare `1fr` the shorthand produces. A grid
              item defaults to min-width:auto, so a bare `1fr` track grows to its widest
              item's intrinsic width instead of the container's: at 320px this container
              measured 252px while its single track resolved to 346px, pushing the date pair
              and its neighbours 55px past the viewport, clipped rather than scrolled.
              Flooring the track at 0 lets the content shrink to the page. */}
          <div className="grid gap-3 [grid-template-columns:repeat(1,minmax(0,1fr))] sm:[grid-template-columns:repeat(2,minmax(0,1fr))] lg:[grid-template-columns:repeat(4,minmax(0,1fr))]">
            {/* Department */}
            <div className="space-y-1.5">
              <label className="block text-body-sm font-medium text-muted-foreground">
                {t('search.allDepartments')}
              </label>
              <Select
                value={dept}
                onChange={(e) => setDept(e.target.value)}
                aria-label="Department filter"
              >
                <option value="">{t('search.allDepartments')}</option>
                {visibleDepartments.map(item => <option key={item.id} value={item.name}>{item.name}</option>)}
              </Select>
            </div>

            {/* Tag */}
            <div className="space-y-1.5">
              <label className="block text-body-sm font-medium text-muted-foreground">
                {t('search.tag')}
              </label>
              <Input
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                placeholder={t('search.tag')}
                aria-label="Tag filter"
              />
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <label className="block text-body-sm font-medium text-muted-foreground">
                {t('search.status')}
              </label>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                aria-label="Status filter"
              >
                <option value="published">{t('search.statusPublished')}</option>
                <option value="">{t('search.statusAny')}</option>
              </Select>
            </div>

            {/* Date range — spans one column, but uses inline flex for "from/to" */}
            <div className="space-y-1.5">
              <label className="block text-body-sm font-medium text-muted-foreground">
                {t('search.from')} / {t('search.to')}
              </label>
              {/* `min-w-0` has to sit on the FLEX ITEM, and that is this wrapper — `Input`
                  forwards `className` to the inner <input>, not to the div it returns. A
                  `type="date"` field carries an intrinsic minimum width from its own picker
                  UI and a flex item defaults to min-width:auto, so the pair refused to
                  shrink into its grid column and ran 75px past the right edge of the
                  viewport, carrying the "to" field off-screen with it.
                  The decorative Calendar icons are gone too: a date input already draws its
                  own picker indicator, so they were a second icon competing for the same
                  corner, and their `pr-10` padding made the overflow worse. */}
              <div className="flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <Input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    aria-label="Date from"
                  />
                </div>
                <span className="shrink-0 text-body-sm text-muted">–</span>
                <div className="min-w-0 flex-1">
                  <Input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    aria-label="Date to"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>

      {/* Results */}
      {loading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} className="animate-pulse rounded-panel border border-border bg-card p-5">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-5 w-20 rounded-full bg-muted/50" />
                <div className="h-5 w-24 rounded-full bg-muted/40" />
              </div>
              <div className="h-5 w-3/4 rounded bg-muted/50 mb-3" />
              <div className="h-16 w-full rounded bg-muted/30 border-l-2 border-muted/50 pl-4" />
            </div>
          ))}
        </div>
      ) : searched && error ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-surface border border-destructive/25 bg-destructive/10 px-5 py-4 text-body text-destructive">
          <span className="font-medium">{t('search.failed')}</span>
          <Button
            type="button"
            variant="danger"
            size="sm"
            onClick={() => void handleSearch()}
          >
            {t('common.retry')}
          </Button>
        </div>
      ) : searched && results.length === 0 ? (
        <div className="glass-panel flex flex-col items-center rounded-panel border border-dashed border-border bg-surface/30 px-6 py-14 text-center">
          <div className="mb-4 grid h-16 w-16 place-items-center rounded-full bg-surface-muted">
            <Layers className="text-muted" size={32} />
          </div>
          <h3 className="text-h4 font-bold text-foreground">{t('search.noMatches')}</h3>
          <p className="mt-2 max-w-md text-body text-muted-foreground">
            {t('search.noAuthorized')}
          </p>
          <Button
            type="button"
            variant="primary"
            size="md"
            disabled={requested}
            className="mt-6"
            onClick={() => void requestContent(query, dept || undefined).then(() => setRequested(true)).catch(() => undefined)}
          >
            {requested ? t('search.contentRequested') : t('search.requestContent')}
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {results.length > 0 && (
            <p className="text-body-sm font-medium text-muted-foreground">
              {t('search.resultCount', { count: results.length })}
            </p>
          )}
          {results.map((res, idx) => {
            const sourceHref = res.source_url ? safeExternalUrl(res.source_url) : undefined
            const resultKey = String(res.chunk_id || res.article_id || idx)
            const articleId = res.article_id ? String(res.article_id) : ''
            return (
              <div
                key={resultKey}
                className="glass-panel interactive-lift group flex items-start justify-between gap-4 rounded-panel border border-border p-5"
              >
                <div className="min-w-0 flex-1 space-y-2.5">
                  {/* Meta badges */}
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="default" size="sm">
                      {res.dept}
                    </Badge>
                    {res.section_ref && (
                      <Badge variant="primary" size="sm">
                        {res.section_ref}
                      </Badge>
                    )}
                    <span className="ml-auto text-caption font-semibold text-muted">
                      {t('search.matchStrength')}: {(Number(res.score || 0) * 100).toFixed(0)}%
                    </span>
                  </div>

                  {/* The title is the link, rather than the card being a `div role="link"`.
                      The card cannot be an anchor: it already contains the cited-source
                      anchor below, and nesting anchors is invalid. A real link also gets
                      Enter, middle-click and "open in new tab" for free — none of which the
                      hand-rolled click/keydown handlers supported. */}
                  <h3 className="flex items-center gap-2 text-body-lg font-bold text-foreground transition-colors group-hover:text-primary">
                    <FileText size={16} className="shrink-0 text-muted-foreground group-hover:text-primary" />
                    {articleId ? (
                      <Link to={`/articles/${articleId}`} className="min-w-0 truncate text-foreground no-underline hover:underline group-hover:text-primary">
                        {res.title}
                      </Link>
                    ) : (
                      <span className="min-w-0 truncate">{res.title}</span>
                    )}
                  </h3>

                  {/* Excerpt */}
                  <p className="whitespace-pre-wrap border-l-2 border-border pl-4 text-body leading-relaxed text-muted-foreground">
                    {res.chunk_text}
                  </p>

                  {/* Source link */}
                  {res.source_url && (sourceHref ? (
                    <a
                      href={sourceHref}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-body-sm font-semibold text-info hover:underline"
                    >
                      {t('search.openSource')}{res.page_number ? ` · page ${res.page_number}` : ''}
                    </a>
                  ) : (
                    <span className="mt-2 inline-flex text-body-sm font-semibold text-muted-foreground">
                      {t('search.openSource')}{res.page_number ? ` · page ${res.page_number}` : ''}
                    </span>
                  ))}
                </div>

                {/* Arrow indicator */}
                <div className="shrink-0 self-center rounded-xl bg-surface-muted p-2.5 text-muted transition-all group-hover:bg-primary group-hover:text-primary-foreground">
                  <ArrowRight size={16} />
                </div>
              </div>
            )
          })}
          {/* Honest truncation. The result set is capped server-side, so a full window must
              say so: a truncated list that looks complete is what made a partial answer
              read as "this is everything". */}
          {results.length >= limit && limit < SEARCH_LIMIT_MAX && (
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="w-full"
              onClick={() => void handleSearch(undefined, SEARCH_LIMIT_MAX)}
            >
              {t('search.loadMore')}
            </Button>
          )}
          {results.length >= SEARCH_LIMIT_MAX && (
            <p className="rounded-surface border border-info/25 bg-info/10 px-4 py-3 text-body-sm text-info">
              {t('search.capped', { count: results.length })}
            </p>
          )}
        </div>
      )}
    </PageTransition>
  )
}
