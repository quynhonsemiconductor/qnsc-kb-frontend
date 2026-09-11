import React, { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { useParams, Link, useNavigate } from 'react-router-dom'
import { 
  ArrowLeft, 
  Calendar, 
  User as UserIcon, 
  Edit, 
  Trash2, 
  Bookmark, 
  ThumbsUp, 
  ThumbsDown, 
  MessageSquare,
  History,
  GitCompare
  ,Bell
} from 'lucide-react'
import { 
  getArticle, 
  getRelatedArticles,
  deleteArticle, 
  getComments, 
  addComment, 
  deleteComment, 
  castVote, 
  getVotesSummary, 
  getUserVote, 
  bookmarkArticle, 
  unbookmarkArticle, 
  isBookmarked,
  getHistory,
  restoreArticleVersion
  ,getFollowStatus, followArticle, unfollowArticle
  ,updateStructuredMetadata, type StructuredMetadata
} from '../../api/articles'
import { downloadArticleSource } from '../../api/articles'
import { getArticles } from '../../api/articles'
import PdfViewer from '../../components/ai/PdfViewer'
import { useAuth } from '../../auth/useAuth'
import { usePermission } from '../../hooks/usePermission'
import { usePolling } from '../../hooks/usePolling'
import { useDialog } from '../../components/ui/DialogProvider'
import { useLanguage } from '../../i18n/LanguageProvider'
import { canEditArticleForUser } from '../../utils/articlePermissions'
import { diffWords } from '../../utils/textDiff'
import { userMessage } from '../../lib/error-handler'
import { Button } from '../../components/ui/Button'
import { Badge } from '../../components/ui/Badge'
import { Modal } from '../../components/ui/Modal'
import { Input } from '../../components/ui/Input'
import { formatDateTime, formatDay } from '../../lib/formatters'

function normalizeWikiTarget(value: string) {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase()
}

async function resolveWikiLinks(markdown: string, currentArticle: any, related: any[]) {
  const matches = [...markdown.matchAll(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g)]
  const targets = [...new Set(matches.map(match => normalizeWikiTarget(match[1])))]
  if (!targets.length) return markdown

  const known = new Map<string, any>()
  ;[currentArticle, ...related].forEach(item => {
    if (item?.title) known.set(normalizeWikiTarget(item.title), item)
  })

  await Promise.all(targets.filter(target => !known.has(target)).map(async target => {
    try {
      const candidates = await getArticles({ q: target, status: 'published', limit: 10 })
      const exact = candidates.find((candidate: any) => normalizeWikiTarget(candidate.title) === target)
      if (exact) known.set(target, exact)
    } catch (error) {
      // An unresolved wiki link should never make the document unreadable.
      console.warn('Could not resolve wiki link', target, error)
    }
  }))

  return markdown.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (raw, rawTarget, rawLabel) => {
    const target = normalizeWikiTarget(rawTarget)
    const article = known.get(target)
    if (!article) return rawLabel || rawTarget
    const label = String(rawLabel || article.title).replace(/[\[\]]/g, '')
    return `[${label}](/articles/${article.id})`
  })
}

function MarkdownLink({ href, children, ...props }: React.ComponentProps<'a'>) {
  if (href?.startsWith('/articles/')) return <Link to={href} {...props}>{children}</Link>
  if (href?.startsWith('article:')) return <Link to={`/articles/${href.slice('article:'.length)}`} {...props}>{children}</Link>
  return <a href={href} target={href?.startsWith('#') ? undefined : '_blank'} rel={href?.startsWith('#') ? undefined : 'noreferrer'} {...props}>{children}</a>
}

function VersionDiff({ oldText, newText }: { oldText: string; newText: string }) {
  const tokens = diffWords(oldText, newText)
  if (!tokens) {
    return (
      <p className="text-xs text-slate-400">
        These versions are too large to highlight word-by-word. Open each version separately to compare.
      </p>
    )
  }
  if (!tokens.some(token => token.type !== 'same')) {
    return <p className="text-xs text-slate-400">No wording differs between this version and the current one.</p>
  }
  return (
    <pre className="whitespace-pre-wrap break-words font-sans text-sm leading-6 text-slate-300">
      {tokens.map((token, index) => {
        if (token.type === 'same') return <span key={index}>{token.text}</span>
        if (token.type === 'del') return <span key={index} className="rounded bg-rose-500/15 text-rose-300 line-through">{token.text}</span>
        return <span key={index} className="rounded bg-emerald-500/15 text-emerald-300">{token.text}</span>
      })}
    </pre>
  )
}

export default function ArticleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { user: currentUser } = useAuth()
  const { has } = usePermission()
  const navigate = useNavigate()
  const dialog = useDialog()
  const { t } = useLanguage()

  const [article, setArticle] = useState<any>(null)
  const [renderedBody, setRenderedBody] = useState('')
  const [relatedArticles, setRelatedArticles] = useState<any[]>([])
  const [comments, setComments] = useState<any[]>([])
  const [newComment, setNewComment] = useState('')
  const [votes, setVotes] = useState({ upvotes: 0, downvotes: 0 })
  const [userVote, setUserVote] = useState(0)
  const [bookmarked, setBookmarked] = useState(false)
  const [following, setFollowing] = useState(false)
  const [history, setHistory] = useState<any[]>([])
  const [showHistory, setShowHistory] = useState(false)
  const [viewingVersion, setViewingVersion] = useState<any>(null)
  const [compareWithCurrent, setCompareWithCurrent] = useState(false)
  const [editingMetadata, setEditingMetadata] = useState(false)
  const [metadataDraft, setMetadataDraft] = useState<StructuredMetadata>({ document_number: '', issue_date: '', expiry_date: '', signed_by: '' })
  const [savingMetadata, setSavingMetadata] = useState(false)
  const [sourceViewer, setSourceViewer] = useState<{ url: string; name: string; type: string } | null>(null)
  const [sourceLoading, setSourceLoading] = useState(false)
  const sourceUrlRef = useRef<string | null>(null)

  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [submittingComment, setSubmittingComment] = useState(false)

  // Incremented on every load. A response only writes state if its sequence is still the
  // current one, so navigating A->B can never land A's comments and votes on B's page.
  const loadSequenceRef = useRef(0)

  const loadArticleDetails = async () => {
    if (!id) return
    const sequence = ++loadSequenceRef.current
    const isCurrent = () => loadSequenceRef.current === sequence
    setLoading(true)
    setLoadError(false)
    try {
      // Only the article itself decides whether this page can render. It is awaited first
      // and separately: a failure here is a real load error, and there is nothing to show.
      const art = await getArticle(id)
      if (!isCurrent()) return
      setArticle(art)
      setRenderedBody(art.body_md)
    } catch (err) {
      console.error(err)
      if (isCurrent()) {
        setLoadError(true)
        setLoading(false)
      }
      return
    }
    setLoading(false)

    // Everything below is secondary: it decorates the article rather than constituting it.
    // These run concurrently instead of in a chain of eight awaits, and each one absorbs
    // its own failure, because a comment or vote endpoint being down must never blank an
    // article the reader can already be shown.
    await Promise.all([
      getRelatedArticles(id).then(related => { if (isCurrent()) setRelatedArticles(related) }).catch(() => undefined),
      getComments(id).then(comm => { if (isCurrent()) setComments(comm) }).catch(() => undefined),
      getVotesSummary(id).then(vt => { if (isCurrent()) setVotes(vt) }).catch(() => undefined),
      getUserVote(id).then(uVt => { if (isCurrent()) setUserVote(uVt.vote) }).catch(() => undefined),
      getHistory(id).then(hist => { if (isCurrent()) setHistory(hist) }).catch(() => undefined),
      getFollowStatus(id).then(follow => { if (isCurrent()) setFollowing(Boolean(follow.following)) }).catch(() => undefined),
      currentUser?.id
        ? isBookmarked(id).then(book => { if (isCurrent()) setBookmarked(book) }).catch(() => undefined)
        : Promise.resolve(),
    ])
  }

  useEffect(() => {
    void loadArticleDetails()
  }, [id])

  // The banner below reports an indexing job running in a background worker, so it is
  // stale the moment it is rendered. Poll the article alone rather than calling
  // loadArticleDetails: that reloads eight endpoints and flips the page into its
  // full-page loading state, which would blank the article every few seconds.
  const indexing =
    article?.status === 'published' &&
    !!article.index_status &&
    !['ready', 'failed'].includes(article.index_status)
  usePolling(async () => {
    if (!id) return
    const fresh = await getArticle(id)
    // Replace only on a real change, so a poll never re-renders the body mid-read.
    setArticle((current: any) => (current && current.index_status === fresh.index_status ? current : fresh))
  }, 5_000, indexing)

  // Keyed on the related ids rather than the array, because every load and every poll
  // hands back a fresh array with the same contents. Depending on that identity re-ran
  // this on each cycle, firing one search request per wiki target every few seconds.
  const relatedKey = relatedArticles.map((item: { id?: string }) => item?.id).join(',')
  // Read through a ref so the resolver still sees the current list without the effect
  // taking the array identity as a dependency.
  const relatedArticlesRef = useRef(relatedArticles)
  relatedArticlesRef.current = relatedArticles

  useEffect(() => {
    if (!article?.body_md) return
    let active = true
    void resolveWikiLinks(article.body_md, article, relatedArticlesRef.current).then(body => {
      if (active) setRenderedBody(body)
    })
    return () => { active = false }
  }, [article?.body_md, article?.id, relatedKey])

  // Release the active source blob URL when leaving the page.
  useEffect(() => {
    return () => {
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current)
    }
  }, [])

  const handleDelete = async () => {
    if (!id) return
    if (await dialog.confirm('Are you sure you want to soft-delete this article?', { title: 'Delete article', confirmLabel: 'Delete article', tone: 'danger' })) {
      try {
        await deleteArticle(id)
        navigate('/articles')
      } catch (err) {
        console.error(err)
        await dialog.alert(userMessage(err, t), { title: 'Delete failed' })
      }
    }
  }

  const handleOpenSource = async () => {
    if (!id || sourceLoading) return
    setSourceLoading(true)
    try {
      const { url, type } = await downloadArticleSource(id)
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current)
      sourceUrlRef.current = url
      setSourceViewer({ url, type, name: article?.title || 'Original source' })
    } catch {
      await dialog.alert('The original source is not available for this article.', { title: 'Source unavailable', tone: 'info' })
    } finally {
      setSourceLoading(false)
    }
  }

  const handleRestoreVersion = async (hist: any) => {
    if (!id || !article || hist.version === article.version) return
    const confirmed = await dialog.confirm(
      t('articles.restoreConfirm', { version: hist.version }),
      { title: `${t('articles.restoreTitle')} ${hist.version}`, confirmLabel: t('articles.restoreButton'), tone: 'info' },
    )
    if (!confirmed) return
    try {
      await restoreArticleVersion(id, hist.version)
      await dialog.alert(`Version ${hist.version} was submitted for independent approval.`, { title: 'Restore submitted', tone: 'success' })
      navigate('/governance/pending-drafts')
    } catch (err: any) {
      await dialog.alert(err?.response?.data?.detail || 'Could not restore this version.', { title: 'Restore failed', tone: 'danger' })
    }
  }

  const openMetadataEditor = () => {
    setMetadataDraft({
      document_number: article?.structured_metadata?.document_number || '',
      issue_date: article?.structured_metadata?.issue_date || '',
      expiry_date: article?.structured_metadata?.expiry_date || '',
      signed_by: article?.structured_metadata?.signed_by || '',
    })
    setEditingMetadata(true)
  }

  const saveMetadata = async () => {
    if (!id) return
    setSavingMetadata(true)
    try {
      const saved = await updateStructuredMetadata(id, metadataDraft)
      setArticle((current: any) => current ? { ...current, structured_metadata: saved } : current)
      setEditingMetadata(false)
    } catch (err: any) {
      await dialog.alert(err?.response?.data?.detail || 'Could not save document details.', { title: 'Save failed', tone: 'danger' })
    } finally {
      setSavingMetadata(false)
    }
  }

  const handleVote = async (value: number) => {
    if (!id) return
    try {
      // Toggle vote
      const nextVoteVal = userVote === value ? 0 : value
      const summary = await castVote(id, nextVoteVal)
      setVotes(summary)
      setUserVote(nextVoteVal)
    } catch (err) {
      console.error(err)
    }
  }

  const handleBookmarkToggle = async () => {
    if (!id) return
    try {
      if (bookmarked) {
        await unbookmarkArticle(id)
        setBookmarked(false)
      } else {
        await bookmarkArticle(id)
        setBookmarked(true)
      }
    } catch (err) {
      console.error(err)
    }
  }

  const handleFollowToggle = async () => {
    if (!id) return
    try {
      if (following) await unfollowArticle(id)
      else await followArticle(id)
      setFollowing(!following)
    } catch (err) { console.error(err) }
  }

  const handleCommentSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!id || !newComment.trim()) return
    setSubmittingComment(true)
    try {
      const comm = await addComment(id, newComment)
      setComments(current => [...current, comm])
      setNewComment('')
    } catch (err) {
      console.error(err)
    } finally {
      setSubmittingComment(false)
    }
  }

  const handleCommentDelete = async (commId: string) => {
    try {
      await deleteComment(commId)
      setComments(current => current.filter(c => c.id !== commId))
    } catch (err) {
      console.error(err)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64 text-slate-400">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-brand-500 mr-3" />
        <span>Loading article...</span>
      </div>
    )
  }

  if (!article) {
    if (loadError) {
      return (
        <div className="page-shell page-stack">
          <div role="alert" className="flex items-center justify-between gap-3 rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <span>Failed to load. Please retry.</span>
            <Button type="button" variant="danger" size="sm" onClick={() => void loadArticleDetails()}>Retry</Button>
          </div>
        </div>
      )
    }
    return (
      <div className="text-center p-12">
        <h3 className="text-xl font-bold text-rose-500">Article not found</h3>
        <p className="text-slate-400 mt-2">This document does not exist or has been deleted.</p>
        <Link to="/articles" className="mt-4 inline-block text-brand-400 underline">Back to Articles</Link>
      </div>
    )
  }

  const canEdit = canEditArticleForUser(currentUser, article)
  const requestEditPrompt = `I need help identifying who is allowed to change the knowledge-base article "${article.title}" (article ID: ${article.id}). I cannot change it directly. Please explain which role or person owns this responsibility and help me prepare a clear request for them.`

  return (
    <div className="page-shell page-stack">
      {/* Navigation & Controls */}
      <div className="page-hero glass-panel soft-grid signal-line relative flex items-center justify-between overflow-hidden rounded-panel border border-border px-4 py-4 sm:px-6">
        <Link to="/articles" className="mm-secondary flex items-center gap-1.5 px-3 py-2 text-sm">
          <ArrowLeft size={16} />
          <span>{t('articles.back')}</span>
        </Link>
        
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleBookmarkToggle}
            aria-label={bookmarked ? "Bookmarked" : "Bookmark article"}
            className={`rounded-xl border p-2 ${
              bookmarked 
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-400' 
                : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-foreground'
            }`}
            icon={<Bookmark size={18} fill={bookmarked ? "currentColor" : "none"} />}
          />
        
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void handleFollowToggle()}
            aria-label={following ? "Unfollow article" : "Follow article"}
            className={`rounded-xl border p-2 ${following ? 'border-info/30 bg-info/10 text-info' : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-foreground'}`}
            icon={<Bell size={18} fill={following ? 'currentColor' : 'none'} />}
          />
        
          
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowHistory(!showHistory)}
            aria-label="Version History"
            className={`rounded-xl border p-2 ${
              showHistory 
                ? 'bg-brand-500/10 border-brand-500/30 text-brand-400' 
                : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-foreground'
            }`}
            icon={<History size={18} />}
          />
        

          {canEdit && (
            <>
              <Link
                to={`/articles/${article.id}/edit`}
                aria-label="Edit article"
                className="rounded-xl border border-border bg-surface px-3 py-2 text-muted-foreground transition-all hover:bg-surface-soft hover:text-foreground"
              >
                <Edit size={18} />
              </Link>
            
              <Button
                variant="ghost"
                size="sm"
                onClick={handleDelete}
                aria-label="Soft Delete"
                className="rounded-xl border border-destructive/20 bg-surface px-3 py-2 text-destructive hover:bg-destructive/10"
                icon={<Trash2 size={18} />}
              />
            
            </>
          )}
          {!canEdit && has('ai.ask') && (
            <Link to={`/ai?articleId=${encodeURIComponent(article.id)}&articleTitle=${encodeURIComponent(article.title)}&prompt=${encodeURIComponent(requestEditPrompt)}`} className="inline-flex items-center gap-1.5 rounded-xl border border-info/30 bg-info/10 px-3 py-2 text-xs font-semibold text-info transition hover:bg-info/15" title="Ask who can update this article">
              <MessageSquare size={16} /> <span className="hidden sm:inline">Request edit</span>
            </Link>
          )}
          {article.source_available && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => void handleOpenSource()}
              disabled={sourceLoading}
              loading={sourceLoading}
            >
              {sourceLoading ? 'Loading source…' : 'Review source'}
            </Button>
          )}
        </div>
      </div>

      {/* Main Grid split: Content & Sidebar metadata */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Content body */}
        <div className="lg:col-span-3 space-y-5">
           <div className="glass-panel rounded-panel border border-border p-5 shadow-[0_16px_42px_rgb(var(--shadow)/.1)] md:p-6 space-y-5">
            <div>
              {/* Title & metadata */}
               <h1 className="font-display text-3xl font-extrabold leading-tight tracking-[-.04em] text-foreground md:text-4xl">
                {article.title}
              </h1>
              
              <div className="flex flex-wrap items-center gap-4 text-slate-500 text-xs mt-4">
                <span className="flex items-center gap-1">
                  <UserIcon size={14} />
                  <span>{article.owner?.name || 'Owner'}</span>
                </span>
                <span className="flex items-center gap-1">
                  <Calendar size={14} />
                  <span>Created {formatDay(article.created_at)}</span>
                </span>
                <Badge variant="default" size="sm" className="uppercase">
                  v{article.version}
                </Badge>
                {article.self_approved && <Badge variant="warning" size="sm">Self-approved</Badge>}
                {article.source_changed && <Badge variant="danger" size="sm">Source changed</Badge>}
                {article.legal_hold && <Badge variant="danger" size="sm">Legal hold</Badge>}
                {!article.legal_hold && article.retention_until && new Date(article.retention_until) >= new Date(new Date().toDateString()) && (
                  <Badge variant="warning" size="sm">Retained until {formatDay(article.retention_until)}</Badge>
                )}
              </div>

              {(article.structured_metadata?.document_number || article.structured_metadata?.issue_date || article.structured_metadata?.expiry_date || article.structured_metadata?.signed_by || canEdit) && (
                <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 rounded-xl border border-slate-800 bg-slate-950/40 px-4 py-3 text-xs text-slate-400">
                  {article.structured_metadata?.document_number && <span><span className="text-slate-500">No.</span> <span className="font-semibold text-slate-200">{article.structured_metadata.document_number}</span></span>}
                  {article.structured_metadata?.issue_date && <span><span className="text-slate-500">Issued</span> <span className="font-semibold text-slate-200">{article.structured_metadata.issue_date}</span></span>}
                  {article.structured_metadata?.expiry_date && <span><span className="text-slate-500">Expires</span> <span className="font-semibold text-slate-200">{article.structured_metadata.expiry_date}</span></span>}
                  {article.structured_metadata?.signed_by && <span><span className="text-slate-500">Signed by</span> <span className="font-semibold text-slate-200">{article.structured_metadata.signed_by}</span></span>}
                  {canEdit && <Button variant="ghost" size="sm" onClick={openMetadataEditor} icon={<Edit size={12} />} className="ml-auto text-slate-500">Edit details</Button>}
                </div>
              )}
            </div>

            {/* Render Markdown text (simple fallback renderer for preview logic) */}
            <div className="markdown-surface max-w-none border-t border-border pt-xl">
              <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ a: MarkdownLink }}>{renderedBody || article.body_md}</ReactMarkdown>
            </div>

            {/* Voting Bar */}
            <div className="flex items-center gap-4 border-t border-slate-800/40 pt-5">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Was this helpful?</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleVote(1)}
                  aria-label="Vote up"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs ${
                    userVote === 1
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-md'
                      : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-foreground'
                  }`}
                  icon={<ThumbsUp size={14} />}
                >
                  {votes.upvotes}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleVote(-1)}
                  aria-label="Vote down"
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs ${
                    userVote === -1
                      ? 'bg-rose-500/10 border-rose-500/30 text-rose-400 shadow-md'
                      : 'border-slate-800 bg-slate-900/40 text-slate-400 hover:text-foreground'
                  }`}
                  icon={<ThumbsDown size={14} />}
                >
                  {votes.downvotes}
                </Button>
              </div>
            </div>
          </div>

          {/* Comments section */}
          <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-5 space-y-5">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <MessageSquare size={18} />
              <span>Comments ({comments.length})</span>
            </h3>

            {/* Comments Thread list */}
            <div className="space-y-4">
              {comments.map((comm) => (
                <div key={comm.id} className="border-b border-border pb-4 last:border-0 last:pb-0">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-slate-800 flex items-center justify-center font-bold text-slate-300 text-xs">
                        {comm.user?.name?.substring(0,2).toUpperCase() || 'US'}
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-foreground">{comm.user?.name}</span>
                        <span className="text-caption text-slate-500 ml-2">
                          {formatDateTime(comm.created_at)}
                        </span>
                      </div>
                    </div>
                    {currentUser && currentUser.id === comm.user_id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCommentDelete(comm.id)}
                        className="text-xs text-rose-400 hover:underline hover:text-rose-300"
                      >
                        Delete
                      </Button>
                    )}
                  </div>
                  <p className="text-slate-300 text-sm mt-2 pl-9 whitespace-pre-wrap leading-relaxed">
                    {comm.text}
                  </p>
                </div>
              ))}
            </div>

            {/* Comment Form */}
            <form onSubmit={handleCommentSubmit} className="pt-4 border-t border-border/60">
              <textarea
                placeholder="Share your thoughts or suggest corrections..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className="w-full rounded-lg border border-slate-800 bg-slate-950/60 p-3 text-sm text-foreground placeholder-slate-500 outline-none focus:border-brand-500 h-24 resize-none"
                required
              />
              <div className="flex justify-end mt-2">
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  disabled={submittingComment}
                  loading={submittingComment}
                >
                  {submittingComment ? 'Posting...' : 'Post Comment'}
                </Button>
              </div>
            </form>
          </div>

          {relatedArticles.length > 0 && (
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-6 space-y-4">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">Related articles</h3>
              <div className="grid gap-2 sm:grid-cols-2">
                {relatedArticles.map((related) => (
                  <Link key={related.id} to={`/articles/${related.id}`} className="rounded-lg border border-slate-800 bg-slate-950/30 p-3 transition hover:border-brand-500/50 hover:bg-slate-900">
                    <p className="truncate text-sm font-semibold text-foreground">{related.title}</p>
                    <p className="mt-1 truncate text-xs text-slate-500">{related.dept}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Metadata */}
        <div className="lg:col-span-1 space-y-5">
          {/* Attributes card */}
          <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-5 space-y-4">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2">
              Attributes
            </h3>
            
            <div className="space-y-3.5 text-sm">
              {article.needs_update && (
                <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-xs font-semibold text-rose-300">
                  Review overdue — content needs update
                </div>
              )}
              {article.self_approved && (
                <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300">
                  Self-approved by Admin/CEO
                </div>
              )}
              {article.status === 'published' && article.index_status && article.index_status !== 'ready' && (
                <div className={`rounded-lg border px-3 py-2 text-xs font-semibold ${article.index_status === 'failed' ? 'border-rose-500/30 bg-rose-500/10 text-rose-300' : 'border-amber-500/30 bg-amber-500/10 text-amber-300'}`}>
                  Search index: {article.index_status === 'processing' ? 'processing in background…' : article.index_status}
                </div>
              )}
              <div>
                <label className="text-slate-500 text-xs block mb-0.5">Department</label>
                <span className="text-foreground font-semibold">{article.dept}</span>
              </div>
              <div>
                <label className="text-slate-500 text-xs block mb-0.5">Next Review Schedule</label>
                <span className="text-foreground font-semibold">
                  {formatDay(article.next_review, 'No schedule set')}
                </span>
              </div>
            </div>
          </div>

          {/* Version History Sidebar list if toggled */}
          {showHistory && (
            <div className="bg-slate-900/30 border border-slate-800/80 rounded-xl p-5 space-y-4 animate-fadeIn">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider border-b border-slate-800 pb-2">
                {t('articles.versionHistory')}
              </h3>
              <div className="space-y-3.5 max-h-64 overflow-y-auto pr-1">
                {history.map((hist) => (
                  <div 
                    key={hist.id} 
                    onClick={() => { setCompareWithCurrent(false); setViewingVersion(hist) }}
                    className="cursor-pointer hover:bg-slate-800/40 p-2 rounded transition-all text-xs border border-transparent hover:border-slate-800"
                  >
                    <div className="flex justify-between items-center text-foreground font-bold mb-1">
                      <span>Version {hist.version}</span>
                      <span className="text-caption text-slate-500 font-normal">
                        {formatDay(hist.created_at)}
                      </span>
                    </div>
                    <div className="text-slate-400 line-clamp-1">{hist.snapshot.title}</div>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="text-caption text-slate-500">Edited by: {hist.editor?.name || 'Owner'}</span>
                      {hist.version === article.version ? (
                        <Badge variant="success" size="sm">{t('articles.active')}</Badge>
                      ) : canEdit ? (
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={(event) => { event.stopPropagation(); void handleRestoreVersion(hist) }}
                          className="rounded-md border border-cyan/30 px-2 py-1 text-caption font-semibold text-cyan hover:bg-cyan/10"
                        >
                          {t('articles.restoreActive')}
                        </Button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

      </div>
      {sourceViewer && (
        <PdfViewer
          open
          fileName={sourceViewer.name}
          url={sourceViewer.url}
          mimeType={sourceViewer.type}
          onClose={() => {
            if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current)
            sourceUrlRef.current = null
            setSourceViewer(null)
          }}
        />
      )}
      {viewingVersion && (
        <Modal
          open
          onClose={() => setViewingVersion(null)}
          title={`${t('articles.versionHistory')} · Version ${viewingVersion.version}`}
          size="lg"
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
              <span>{formatDateTime(viewingVersion.created_at)} · Edited by {viewingVersion.editor?.name || 'Owner'}</span>
              {viewingVersion.version !== article?.version && (
                <Button
                  variant={compareWithCurrent ? 'primary' : 'secondary'}
                  size="sm"
                  icon={<GitCompare size={14} />}
                  onClick={() => setCompareWithCurrent(current => !current)}
                >
                  {compareWithCurrent ? 'Showing differences' : 'Compare with current'}
                </Button>
              )}
            </div>
            <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-slate-800 bg-slate-950/40 p-4">
              {compareWithCurrent ? (
                <VersionDiff oldText={viewingVersion.snapshot.body_md} newText={article?.body_md || ''} />
              ) : (
                <div className="markdown-surface max-w-none text-sm">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{viewingVersion.snapshot.body_md}</ReactMarkdown>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
              <Button variant="ghost" size="sm" onClick={() => setViewingVersion(null)}>Close</Button>
              {canEdit && viewingVersion.version !== article?.version && (
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => { void handleRestoreVersion(viewingVersion); setViewingVersion(null) }}
                >
                  {t('articles.restoreActive')}
                </Button>
              )}
            </div>
          </div>
        </Modal>
      )}
      {editingMetadata && (
        <Modal open onClose={() => setEditingMetadata(false)} title="Document details" size="sm">
          <div className="space-y-4">
            <Input label="Document number" value={metadataDraft.document_number || ''} onChange={e => setMetadataDraft(current => ({ ...current, document_number: e.target.value }))} placeholder="e.g. SOP-114" />
            <Input label="Issue date" type="date" value={metadataDraft.issue_date || ''} onChange={e => setMetadataDraft(current => ({ ...current, issue_date: e.target.value }))} />
            <Input label="Expiry date" type="date" value={metadataDraft.expiry_date || ''} onChange={e => setMetadataDraft(current => ({ ...current, expiry_date: e.target.value }))} />
            <Input label="Signed by" value={metadataDraft.signed_by || ''} onChange={e => setMetadataDraft(current => ({ ...current, signed_by: e.target.value }))} placeholder="Name or title" />
            <div className="flex justify-end gap-2 border-t border-slate-800 pt-4">
              <Button variant="ghost" size="sm" onClick={() => setEditingMetadata(false)}>Cancel</Button>
              <Button variant="primary" size="sm" disabled={savingMetadata} loading={savingMetadata} onClick={() => void saveMetadata()}>Save</Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
