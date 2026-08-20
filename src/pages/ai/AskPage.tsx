import React, { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  AlertCircle, ArrowUp, BookOpen, Bot, Check, ChevronDown, ChevronLeft, ChevronRight,
  Copy, ExternalLink, FileText, Layers, List, MessageSquare, Pencil, Search as SearchIcon,
  Plus, Sparkles, Square, ThumbsDown, ThumbsUp, Trash2, User as UserIcon, X,
} from 'lucide-react'
import {
  askAIStream, createConversation, deleteConversation, getConversationMessages,
  getConversations, renameConversation, submitAIFeedback,
  downloadArticleSource,
} from '../../api/ai'
import { createArticleEditRequest } from '../../api/articles'
import PdfViewer from '../../components/ai/PdfViewer'
import AnswerText from '../../components/ai/AnswerText'
import AnswerSections from '../../components/ai/AnswerSections'
import { useDialog } from '../../components/ui/DialogProvider'
import { useLanguage } from '../../i18n/LanguageProvider'

interface Citation {
  source_index?: number
  article_id: string
  title: string
  section_ref?: string
  source_ref: string
  excerpt?: string
  highlight_text?: string
  highlight_texts?: string[]
  page_number?: number
  source_url?: string
}

interface Message {
  id?: string
  sender: 'user' | 'ai'
  text: string
  citations?: Citation[]
  answerGrounded?: string
  answerExtended?: string
  hasExtended?: boolean
  logId?: string
  feedbackSubmitted?: boolean
  failed?: boolean
  retryQuestion?: string
  action?: string
  articleId?: string
  articleTitle?: string
  articlePreview?: string
  originalInformation?: string
  willUpdate?: string
  editInstruction?: string
}

interface PendingEditConfirmation {
  articleId: string
  articleTitle: string
  articlePreview: string
  originalInformation: string
  editInstruction: string
}

interface Conversation {
  id: string
  title: string
  updated_at: string
}

const PROMPT_CARDS = [
  { label: 'Operations', text: 'What is the SOP for database outage recovery?', tone: 'text-info bg-info/10 border-info/20' },
  { label: 'Policy', text: 'What is the corporate travel policy?', tone: 'text-primary bg-primary/10 border-primary/20' },
  { label: 'Learn', text: 'Explain what RAG means in QNSC.', tone: 'text-warning bg-warning/10 border-warning/20' },
]

function HighlightedSourceText({ text, highlights, highlight }: { text: string; highlights?: string[]; highlight?: string }) {
  const sourceText = text || 'Open the article to inspect the full source.'
  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const highlightValues = (highlights?.length ? highlights : [highlight || '']).map((value) => value.trim()).filter(Boolean)
  const ranges: Array<{ start: number; end: number }> = []

  for (const value of highlightValues) {
    const tokens = value.split(/\s+/).filter(Boolean).slice(0, 48)
    if (!tokens.length) continue
    const pattern = new RegExp(tokens.map(escapeRegExp).join('\\s+'), 'gi')
    let match: RegExpExecArray | null
    while ((match = pattern.exec(sourceText)) !== null) {
      ranges.push({ start: match.index, end: match.index + match[0].length })
      if (!match[0].length) pattern.lastIndex += 1
    }
  }

  if (!ranges.length) return <>{sourceText}</>
  ranges.sort((left, right) => left.start - right.start)
  const mergedRanges = ranges.reduce<Array<{ start: number; end: number }>>((merged, range) => {
    const previous = merged[merged.length - 1]
    if (previous && range.start <= previous.end) previous.end = Math.max(previous.end, range.end)
    else merged.push({ ...range })
    return merged
  }, [])

  return (
    <>
      {mergedRanges.map((range, index) => (
        <React.Fragment key={`${range.start}-${range.end}`}>
          {index === 0 && sourceText.slice(0, range.start)}
          {index > 0 && sourceText.slice(mergedRanges[index - 1].end, range.start)}
          <mark className="rounded bg-amber-300/25 px-0.5 text-amber-100 ring-1 ring-amber-300/30">{sourceText.slice(range.start, range.end)}</mark>
          {index === mergedRanges.length - 1 && sourceText.slice(range.end)}
        </React.Fragment>
      ))}
    </>
  )
}

// Lightweight, dependency-free motion primitives. Plain CSS keyframes so they
// work regardless of Tailwind config, and fully disabled under
// prefers-reduced-motion so the "quality floor" holds for anyone who needs it.
const MOTION_STYLES = `
@keyframes askFadeUp {
  from { opacity: 0; transform: translateY(8px); }
  to   { opacity: 1; transform: translateY(0); }
}
@keyframes askFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
@keyframes askSlideInRight {
  from { opacity: 0; transform: translateX(18px); }
  to   { opacity: 1; transform: translateX(0); }
}
@keyframes askPulseRing {
  0%, 100% { box-shadow: 0 0 0 0 rgba(217,119,87,0.30); }
  50%      { box-shadow: 0 0 0 5px rgba(217,119,87,0.14); }
}
@keyframes askShimmerDot {
  0%, 80%, 100% { transform: scale(0.85); opacity: 0.5; }
  40%           { transform: scale(1.15); opacity: 1; }
}
.ask-fade-up { animation: askFadeUp 0.34s cubic-bezier(0.16,1,0.3,1) both; }
.ask-fade-in { animation: askFadeIn 0.28s ease-out both; }
.ask-slide-in { animation: askSlideInRight 0.3s cubic-bezier(0.16,1,0.3,1) both; }
.ask-avatar-live { animation: askPulseRing 1.7s ease-in-out infinite; }
.ask-press { transition: transform 120ms ease, background-color 150ms ease, color 150ms ease, border-color 150ms ease, box-shadow 150ms ease; }
.ask-press:active { transform: scale(0.96); }
.ask-scroll { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.14) transparent; }
.ask-scroll::-webkit-scrollbar { width: 8px; height: 8px; }
.ask-scroll::-webkit-scrollbar-track { background: transparent; }
.ask-scroll::-webkit-scrollbar-thumb { background-color: rgba(255,255,255,0.14); border-radius: 999px; border: 2px solid transparent; background-clip: content-box; }
.ask-scroll::-webkit-scrollbar-thumb:hover { background-color: rgba(255,255,255,0.24); background-clip: content-box; }
@media (prefers-reduced-motion: reduce) {
  .ask-fade-up, .ask-fade-in, .ask-slide-in, .ask-avatar-live { animation: none !important; }
  .ask-press:active { transform: none; }
}
`

export default function AskPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const requestArticleId = searchParams.get('articleId') || ''
  const requestArticleTitle = searchParams.get('articleTitle') || 'this article'
  const [conversations, setConversations] = useState<Conversation[]>([])
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [question, setQuestion] = useState(() => searchParams.get('prompt') || '')
  const [loading, setLoading] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(true)
  const [error, setError] = useState('')
  const [requestStatus, setRequestStatus] = useState('')
  const [lastRequestText, setLastRequestText] = useState('')
  const [pendingEditConfirmation, setPendingEditConfirmation] = useState<PendingEditConfirmation | null>(null)
  const [selectedSource, setSelectedSource] = useState<Citation | null>(null)
  const [viewerSource, setViewerSource] = useState<{ citation: Citation; url: string } | null>(null)
  const [sourceUrl, setSourceUrl] = useState<string | null>(null)
  const [sourceLoading, setSourceLoading] = useState(false)
  const [sourceError, setSourceError] = useState('')
  const [sourceCollapsed, setSourceCollapsed] = useState(false)
  // Desktop gets a persistent readable history rail; mobile opens it as a
  // full-height drawer so the conversation never gets squeezed into a narrow
  // reading column.
  const [sidebarOpen, setSidebarOpen] = useState(() => typeof window !== 'undefined' && window.innerWidth >= 1024)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({})
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [historyQuery, setHistoryQuery] = useState('')
  const [showAllHistory, setShowAllHistory] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const sourceUrlRef = useRef<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const chatDesktopRef = useRef(typeof window !== 'undefined' && window.innerWidth >= 1024)
  const dialog = useDialog()
  const { language, t } = useLanguage()

  const activeConversation = useMemo(
    () => conversations.find((item) => item.id === conversationId),
    [conversations, conversationId],
  )
  const visibleConversations = useMemo(() => {
    const query = historyQuery.trim().toLowerCase()
    return query ? conversations.filter((item) => item.title.toLowerCase().includes(query)) : conversations
  }, [conversations, historyQuery])
  const displayedConversations = showAllHistory || historyQuery.trim()
    ? visibleConversations
    : visibleConversations.slice(0, 8)

  const loadConversation = async (id: string) => {
    setConversationId(id)
    setSelectedSource(null)
    setError('')
    if (window.innerWidth < 1024) setSidebarOpen(false)
    try {
      const history = await getConversationMessages(id)
      const mappedMessages: Message[] = history.map((item: any) => {
        const actionData = item.action_data || {}
        return {
        id: item.id,
        sender: item.role === 'user' ? ('user' as const) : ('ai' as const),
        text: item.content,
        citations: item.citations || [],
        answerGrounded: item.answer_grounded,
        answerExtended: item.answer_extended,
        hasExtended: item.has_extended,
        logId: item.usage_log_id,
        action: item.action || actionData.action,
        articleId: actionData.article_id,
        articleTitle: actionData.article_title,
        articlePreview: actionData.article_preview,
        originalInformation: actionData.original_information,
        willUpdate: actionData.will_update,
        editInstruction: actionData.edit_instruction,
      }
      })
      setMessages(mappedMessages)
      const pending = [...mappedMessages].reverse().find((message: Message) => message.action === 'edit_confirmation_required' && message.articleId && message.editInstruction)
      setPendingEditConfirmation(pending ? {
        articleId: pending.articleId as string,
        articleTitle: pending.articleTitle || 'Matching article',
        articlePreview: pending.articlePreview || '',
        originalInformation: pending.originalInformation || pending.articlePreview || '',
        editInstruction: pending.editInstruction as string,
      } : null)
    } catch {
      setError('Could not load this conversation.')
    }
  }

  const refreshConversations = async (selectFirst = false) => {
    const items = await getConversations()
    setConversations(items)
    if (selectFirst && items.length > 0) await loadConversation(items[0].id)
    return items
  }

  useEffect(() => {
    refreshConversations(true).catch(() => setError('Could not load chat history.')).finally(() => setHistoryLoading(false))
  }, [])

  useEffect(() => {
    const prompt = searchParams.get('prompt') || ''
    if (prompt) setQuestion(prompt)
    setRequestStatus('')
    setLastRequestText('')
  }, [searchParams])

  const handleCreateEditRequest = async () => {
    if (!requestArticleId) return
    const requestText = question.trim()
    const submittedText = requestText || lastRequestText.trim()
    if (submittedText.length < 5) {
      setRequestStatus('Please describe the correction in the message box first.')
      return
    }
    try {
      const result = await createArticleEditRequest(requestArticleId, submittedText)
      setRequestStatus(result.message || 'Edit request sent to authorized editors.')
      setQuestion('')
      setLastRequestText('')
    } catch (requestError: any) {
      const detail = requestError?.response?.data?.detail
      setRequestStatus(typeof detail === 'string' ? detail : 'The edit request could not be submitted.')
    }
  }

  useEffect(() => {
    const handleViewportChange = () => {
      const desktop = window.innerWidth >= 1024
      if (desktop !== chatDesktopRef.current) setSidebarOpen(desktop)
      chatDesktopRef.current = desktop
    }
    window.addEventListener('resize', handleViewportChange)
    return () => window.removeEventListener('resize', handleViewportChange)
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: loading ? 'auto' : 'smooth' })
  }, [messages, loading])

  // Abort any in-flight answer stream and release the active source blob URL
  // when the page unmounts.
  useEffect(() => {
    return () => {
      abortRef.current?.abort()
      if (sourceUrlRef.current) URL.revokeObjectURL(sourceUrlRef.current)
    }
  }, [])

  useEffect(() => {
    const element = textareaRef.current
    if (!element) return
    element.style.height = 'auto'
    element.style.height = `${Math.min(element.scrollHeight, 176)}px`
  }, [question])

  useEffect(() => {
    if (sourceUrlRef.current) {
      URL.revokeObjectURL(sourceUrlRef.current)
      sourceUrlRef.current = null
      setSourceUrl(null)
    }
    if (!selectedSource) {
      setSourceLoading(false)
      setSourceError('')
      return
    }

    let active = true
    setSourceLoading(true)
    setSourceError('')
    downloadArticleSource(selectedSource.article_id)
      .then((url) => {
        if (!active) {
          URL.revokeObjectURL(url)
          return
        }
        sourceUrlRef.current = url
        setSourceUrl(url)
      })
      .catch(() => {
        if (active) setSourceError('This original source could not be loaded.')
      })
      .finally(() => {
        if (active) setSourceLoading(false)
      })

    return () => { active = false }
  }, [selectedSource])

  const startNewChat = () => {
    setConversationId(null)
    setMessages([])
    setQuestion('')
    setLastRequestText('')
    setError('')
    setSelectedSource(null)
    setViewerSource(null)
    setSourceCollapsed(false)
    if (window.innerWidth < 1024) setSidebarOpen(false)
    textareaRef.current?.focus()
  }

  const openSourceViewer = (citation: Citation) => {
    if (sourceUrlRef.current) setViewerSource({ citation, url: sourceUrlRef.current })
  }

  const handleAsk = async (
    value = question,
    editOptions?: { confirmEdit?: boolean; articleId?: string; editInstruction?: string },
  ) => {
    const query = value.trim()
    if (!query || loading) return
    const confirmsPendingEdit = Boolean(
      pendingEditConfirmation
      && /^(yes|yeah|yep|ok|okay|confirm|đúng|có|co|xác nhận|đồng ý)(\s|[.!?]|$)/i.test(query),
    )
    const confirmEdit = editOptions?.confirmEdit ?? confirmsPendingEdit
    const confirmedArticleId = editOptions?.articleId || (confirmsPendingEdit ? pendingEditConfirmation?.articleId : undefined)
    const confirmedInstruction = editOptions?.editInstruction || (confirmsPendingEdit ? pendingEditConfirmation?.editInstruction : undefined)
    if (confirmsPendingEdit || editOptions?.confirmEdit) setPendingEditConfirmation(null)
    if (requestArticleId) setLastRequestText(query)
    const controller = new AbortController()
    abortRef.current = controller
    setLoading(true)
    setError('')
    setQuestion('')
    setMessages((previous) => [...previous, { sender: 'user', text: query }])
    let assistantMessageId = ''
    try {
      let activeId = conversationId
      if (!activeId) {
        const conversation = await createConversation(query.slice(0, 80))
        activeId = conversation.id
        setConversationId(activeId)
      }
      assistantMessageId = `ai-${Date.now()}`
      setMessages((previous) => [...previous, { id: assistantMessageId, sender: 'ai', text: '', citations: [] }])
      await askAIStream(
        query,
        activeId ?? undefined,
        language,
        (content) => setMessages((previous) => previous.map((message) => {
          if (message.id !== assistantMessageId) return message
          const replaceMarker = '\u0000REPLACE\u0000'
          return content.startsWith(replaceMarker)
            ? { ...message, text: content.slice(replaceMarker.length) }
            : { ...message, text: message.text + content }
        })),
        (citations) => setMessages((previous) => previous.map((message) => message.id === assistantMessageId ? { ...message, citations } : message)),
        (data) => {
          const actionData = data.action_data || {}
          const articleId = data.article_id || actionData.article_id
          const articleTitle = data.article_title || actionData.article_title
          const articlePreview = data.article_preview || actionData.article_preview
          const originalInformation = data.original_information || actionData.original_information
          const editInstruction = data.edit_instruction || actionData.edit_instruction
          if (data.action === 'edit_confirmation_required' && articleId && editInstruction) {
            setPendingEditConfirmation({
              articleId,
              articleTitle: articleTitle || 'this article',
              articlePreview: articlePreview || '',
              originalInformation: originalInformation || articlePreview || '',
              editInstruction,
            })
          } else if (data.action === 'article_updated' || data.action === 'edit_request_created') {
            setPendingEditConfirmation(null)
          }
          setMessages((previous) => previous.map((message) => message.id === assistantMessageId ? {
            ...message,
            logId: data.log_id,
            answerGrounded: data.answer_grounded,
            answerExtended: data.answer_extended,
            hasExtended: data.has_extended,
            action: data.action,
            articleId,
            articleTitle,
            articlePreview,
            originalInformation,
            willUpdate: data.will_update || actionData.will_update,
            editInstruction,
          } : message))
        },
        confirmedArticleId || requestArticleId,
        controller.signal,
        true,
        confirmEdit,
        confirmedInstruction,
      )
      await refreshConversations()
    } catch (requestError: any) {
      if (controller.signal.aborted || requestError?.name === 'AbortError') {
        // Stopped by the user — finalize the message with whatever streamed.
      } else {
        const errorDetail = requestError?.response?.data?.detail || requestError?.message || 'Could not reach the answer service. Try again.'
        setError(errorDetail)
        setMessages((previous) => {
          const failure = { text: errorDetail, failed: true, retryQuestion: query }
          return assistantMessageId
            ? previous.map((message) => message.id === assistantMessageId ? { ...message, ...failure } : message)
            : [...previous, { sender: 'ai' as const, ...failure }]
        })
      }
    } finally {
      if (abortRef.current === controller) abortRef.current = null
      setLoading(false)
    }
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault()
      void handleAsk()
    }
  }

  const cancelPendingEdit = () => {
    setPendingEditConfirmation(null)
    setRequestStatus('No changes were made. You can describe the correct article or correction whenever you are ready.')
  }

  const updatePendingEditInstruction = (value: string) => {
    setPendingEditConfirmation((current) => current ? { ...current, editInstruction: value } : current)
  }

  const handleDelete = async (id: string) => {
    const conversation = conversations.find((item) => item.id === id)
    if (!(await dialog.confirm(`Delete “${conversation?.title || 'this chat'}”? The conversation history will be removed.`, { title: 'Delete conversation', confirmLabel: 'Delete chat', tone: 'danger' }))) return
    await deleteConversation(id)
    const remaining = await refreshConversations()
    if (conversationId === id) {
      if (remaining.length > 0) await loadConversation(remaining[0].id)
      else startNewChat()
    }
  }

  const saveRename = async (id: string) => {
    const title = editTitle.trim()
    if (title) {
      const updated = await renameConversation(id, title)
      setConversations((items) => items.map((item) => item.id === id ? { ...item, title: updated.title } : item))
    }
    setEditingId(null)
  }

  const copyMessage = async (message: Message, index: number) => {
    const id = message.id || `${message.sender}-${index}`
    await navigator.clipboard.writeText(message.text)
    setCopiedId(id)
    window.setTimeout(() => setCopiedId(null), 1600)
  }

  const handleFeedback = async (index: number, rating: number) => {
    const message = messages[index]
    if (!message.logId || message.feedbackSubmitted) return
    await submitAIFeedback({ ai_usage_log_id: message.logId, rating })
    setMessages((items) => items.map((item, itemIndex) => itemIndex === index ? { ...item, feedbackSubmitted: true } : item))
  }

  const isEmpty = messages.length === 0

  return (
    <>
      <style>{MOTION_STYLES}</style>
      <div className="glass-panel ai-workspace-shell relative flex h-full max-h-full min-h-0 overflow-hidden rounded-[18px] border border-border/80 bg-canvas shadow-[0_16px_44px_rgb(var(--shadow)/.13)] lg:rounded-[20px]">
        {sidebarOpen && (
          <button
            className="ask-fade-in fixed inset-0 z-20 bg-black/35 lg:hidden"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close chat history"
          />
        )}

        <aside className={`absolute inset-y-0 left-0 z-30 flex w-[min(88vw,20rem)] shrink-0 flex-col overflow-hidden border-r border-hairline bg-surface/95 shadow-2xl backdrop-blur-xl transition-[width,transform] duration-300 ease-out lg:static lg:shadow-none ${sidebarOpen ? 'translate-x-0 lg:w-72' : '-translate-x-full lg:translate-x-0 lg:w-14'}`}>
          {sidebarOpen ? (
            <>
              <div className="flex shrink-0 items-center gap-2 border-b border-hairline p-4">
                <button
                  onClick={startNewChat}
                  className="ask-press flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-3 py-2.5 text-sm font-bold text-primary-foreground shadow-[0_8px_18px_rgb(var(--primary)/.2)] hover:bg-primary/90 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
                >
                  <Plus size={16} className="transition-transform duration-200 group-hover:rotate-90" /> {t('chat.new')}
                </button>
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="ask-press rounded-lg p-2 text-steel hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimaxBlue/40"
                  title="Close sidebar"
                >
                  <ChevronLeft size={16} />
                </button>
              </div>
              <div className="ask-scroll flex-1 space-y-1 overflow-y-auto p-2">
                <div className="mb-2 flex items-center justify-between px-3 pt-2">
                  <p className="text-[10px] font-semibold uppercase tracking-widest text-stone">{t('chat.history')}</p>
                  {conversations.length > 0 && <span className="text-[10px] tabular-nums text-stone">{conversations.length}</span>}
                </div>
                {conversations.length > 0 && (
                  <label className="relative mx-2 mb-2 block">
                    <SearchIcon size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-stone" />
                    <input
                      value={historyQuery}
                      onChange={(event) => setHistoryQuery(event.target.value)}
                      placeholder={t('chat.findChat')}
                      aria-label="Search chat history"
                      className="w-full rounded-lg border border-hairline bg-canvas py-2 pl-8 pr-2 text-[13px] text-ink outline-none placeholder:text-stone focus:border-minimaxBlue focus:ring-2 focus:ring-minimaxBlue/20"
                    />
                  </label>
                )}
                {historyLoading ? (
                  <p className="ask-fade-in px-3 py-3 text-xs text-steel">{t('common.loading')}</p>
                ) : visibleConversations.length === 0 ? (
                  <p className="ask-fade-in px-3 py-3 text-xs text-steel">{historyQuery ? 'No chats match your search.' : 'No saved chats yet.'}</p>
                ) : displayedConversations.map((conversation, conversationIndex) => {
                  const active = conversation.id === conversationId
                  const editing = editingId === conversation.id
                  return (
                    <div
                      key={conversation.id}
                      onClick={() => !editing && void loadConversation(conversation.id)}
                      style={{ animationDelay: `${Math.min(conversationIndex, 8) * 30}ms` }}
                      className={`ask-fade-up group relative flex cursor-pointer items-center gap-2 rounded-lg border-l-2 px-3 py-2.5 transition-colors duration-150 ${active ? 'border-minimaxBlue bg-surface text-ink shadow-sm' : 'border-transparent text-steel hover:border-hairline hover:bg-surface hover:text-ink'}`}
                    >
                      <MessageSquare size={15} className={`shrink-0 transition-colors duration-150 ${active ? 'text-minimaxBlue' : ''}`} />
                      {editing ? (
                        <input
                          autoFocus
                          value={editTitle}
                          onChange={(event) => setEditTitle(event.target.value)}
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => { if (event.key === 'Enter') void saveRename(conversation.id); if (event.key === 'Escape') setEditingId(null) }}
                          onBlur={() => void saveRename(conversation.id)}
                          className="min-w-0 flex-1 rounded border border-minimaxBlue bg-canvas px-1.5 py-0.5 text-xs text-ink outline-none ring-2 ring-minimaxBlue/20 transition-shadow"
                        />
                      ) : (
                        <span
                          className="min-w-0 flex-1 truncate text-[13px] leading-5"
                          onDoubleClick={(event) => { event.stopPropagation(); setEditingId(conversation.id); setEditTitle(conversation.title) }}
                        >
                          {conversation.title || t('chat.new')}
                        </span>
                      )}
                      {!editing && (
                        <span className="absolute right-2 hidden items-center gap-1 bg-inherit pl-1 opacity-0 transition-opacity duration-150 group-hover:flex group-hover:opacity-100">
                          <button
                            onClick={(event) => { event.stopPropagation(); setEditingId(conversation.id); setEditTitle(conversation.title) }}
                            className="ask-press rounded p-1 text-stone hover:bg-surface-soft hover:text-ink"
                            title="Rename chat"
                          >
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={(event) => { event.stopPropagation(); void handleDelete(conversation.id) }}
                            className="ask-press rounded p-1 text-stone hover:bg-rose-500/15 hover:text-rose-400"
                            title="Delete chat"
                          >
                            <Trash2 size={13} />
                          </button>
                        </span>
                      )}
                    </div>
                  )
                })}
                {!historyQuery.trim() && visibleConversations.length > 8 && (
                  <button
                    type="button"
                    onClick={() => setShowAllHistory((current) => !current)}
                    className="mt-1 w-full rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-minimaxBlue transition hover:bg-surface hover:text-ink"
                  >
                    {showAllHistory ? t('chat.showLess') : t('chat.showMore', { count: visibleConversations.length - 8 })}
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="flex h-full flex-col items-center gap-2 pt-3">
              <button
                onClick={startNewChat}
                className="ask-press rounded-lg p-2 text-steel hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimaxBlue/40"
                title="New chat"
                aria-label="New chat"
              >
                <Plus size={17} />
              </button>
              <button
                onClick={() => setSidebarOpen(true)}
                className="ask-press rounded-lg p-2 text-steel hover:bg-surface hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimaxBlue/40"
                title="Open chat history"
                aria-label="Open chat history"
              >
                <List size={17} />
              </button>
            </div>
          )}
        </aside>

        <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-canvas">
           <div className="signal-line flex shrink-0 items-center justify-between border-b border-hairline bg-surface/45 px-4 py-3.5 sm:px-5 sm:py-4 lg:px-8">
             <div className="flex min-w-0 items-center gap-3">
              <button onClick={() => setSidebarOpen(true)} className="ask-press grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-hairline bg-surface text-steel hover:bg-surface-soft hover:text-ink lg:hidden" title="Open chat history" aria-label="Open chat history"><List size={16} /></button>
              <div className={`grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_8px_18px_rgb(var(--primary)/.2)] transition-shadow ${loading ? 'ask-avatar-live' : ''}`}>
                <Bot size={19} />
              </div>
               <div className="min-w-0">
                 <h1 className="truncate font-display text-base font-extrabold text-ink transition-colors">{activeConversation?.title || 'QNSC Intelligence'}</h1>
               </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden items-center gap-2 sm:flex">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-info/20 bg-info/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.12em] text-info"><span className="h-1.5 w-1.5 rounded-full bg-info shadow-[0_0_8px_currentColor]" /> RAG online</span>
                <span className="rounded-full border border-hairline bg-canvas px-2.5 py-1 text-[10px] font-semibold text-stone">{messages.length ? `${messages.length} turns` : 'New session'}</span>
              </div>
              <span className="hidden items-center gap-1.5 text-[11px] text-stone sm:flex">
                <span className={`h-1.5 w-1.5 rounded-full transition-colors duration-300 ${loading ? 'animate-pulse bg-amber-300' : 'bg-emerald-400'}`} />
                {loading ? t('search.searching') : t('chat.ready')}
              </span>

            </div>
          </div>

          <div className="ask-scroll flex-1 overflow-y-auto overflow-x-hidden">
              <div className="mx-auto w-full max-w-none px-5 py-8 lg:px-8">
              {isEmpty ? (
                <div className="relative flex flex-col items-center pt-12 text-center lg:pt-16">
                  <div className="pointer-events-none absolute left-1/2 top-4 h-52 w-52 -translate-x-1/2 opacity-55"><div className="hero-orb h-full w-full"><div className="orbit-ring" /><div className="orbit-ring" style={{ inset: '8%', animationDuration: '21s' }} /><div className="orb-core text-2xl">Q</div></div></div>
                  <span className="ask-fade-up relative z-10 grid h-11 w-11 place-items-center rounded-xl border border-hairline bg-surface-soft text-minimaxBlue">
                    <Layers size={20} />
                  </span>
                  <div className="ask-fade-up relative z-10 mt-5 flex items-center gap-2 rounded-full border border-hairline bg-surface px-3 py-1.5 text-[11px] text-stone" style={{ animationDelay: '60ms' }}>
                    <Sparkles size={13} className="text-coral" /> Private workspace intelligence
                  </div>
                  <h2 className="ask-fade-up relative z-10 mt-4 font-display text-3xl font-extrabold tracking-tight text-ink" style={{ animationDelay: '120ms' }}>{t('chat.askKnowledge')}</h2>
                  <div className="mt-8 grid w-full max-w-2xl gap-3 md:grid-cols-3">
                    {PROMPT_CARDS.map((prompt, suggestionIndex) => (
                      <button
                        key={prompt.text}
                        onClick={() => void handleAsk(prompt.text)}
                        style={{ animationDelay: `${220 + suggestionIndex * 60}ms` }}
                        className="ask-fade-up ask-press group flex min-h-28 flex-col items-start justify-between rounded-2xl border border-hairline bg-canvas p-4 text-left transition-all duration-200 hover:-translate-y-1 hover:border-minimaxBlue hover:bg-surface hover:text-ink hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-minimaxBlue/40"
                      >
                        <span className={`rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[.14em] ${prompt.tone}`}>{prompt.label}</span>
                        <span className="mt-3 text-sm leading-5 text-steel transition group-hover:text-ink">{prompt.text}</span>
                        <ArrowUp size={14} className="mt-3 rotate-45 text-stone transition group-hover:text-minimaxBlue" />
                      </button>
                    ))}
                  </div>
                  <div className="mt-7 flex flex-wrap justify-center gap-2 text-[10px] font-semibold uppercase tracking-[.12em] text-stone"><span className="rounded-full border border-hairline bg-surface px-2.5 py-1.5">Authorized sources only</span><span className="rounded-full border border-hairline bg-surface px-2.5 py-1.5">Clickable citations</span><span className="rounded-full border border-hairline bg-surface px-2.5 py-1.5">Department aware</span></div>
                </div>
              ) : (
                <div className="flex flex-col gap-5">
                  {messages.map((message, index) => {
                    const messageId = message.id || `${message.sender}-${index}`
                    const isStreamingThis = loading && index === messages.length - 1 && message.sender === 'ai'
                    if (message.sender === 'user') return (
                      <div key={messageId} className="ask-fade-up group flex justify-end">
                        <div className="flex w-full max-w-[96%] flex-col items-end gap-1">
                          <p className="whitespace-pre-wrap rounded-2xl border border-hairline bg-surface px-4 py-2.5 text-[13px] leading-6 text-ink transition-shadow duration-200 group-hover:shadow-sm">{message.text}</p>
                          <button
                            onClick={() => void copyMessage(message, index)}
                            className="ask-press mr-2 p-1 text-stone opacity-0 transition-opacity duration-150 group-hover:opacity-100 hover:text-ink"
                            title="Copy question"
                          >
                            {copiedId === messageId ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                          </button>
                        </div>
                        <div className="ml-2 mt-1 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-surface-soft text-steel">
                          <UserIcon size={14} />
                        </div>
                      </div>
                    )
                    const isNoAnswer = !message.failed && !isStreamingThis &&
                      /not found in the knowledge base/i.test(message.text.trim()) && !(message.citations && message.citations.length > 0)
                    const isFailure = Boolean(message.failed)
                    const pendingForMessage = pendingEditConfirmation && pendingEditConfirmation.articleId === message.articleId
                      ? pendingEditConfirmation
                      : null
                    const editDraft = pendingForMessage?.editInstruction || message.editInstruction || ''
                    return (
                      <div
                        key={messageId}
                         className={`ask-fade-up group relative w-full rounded-xl border-0 p-5 shadow-none sm:p-6 transition-colors ${isFailure ? 'bg-rose-500/5' : 'bg-transparent'}`}
                      >
                        <div className="flex gap-3">
                          <div
                            className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg transition-shadow ${isFailure ? 'bg-rose-500/15 text-rose-300' : isNoAnswer ? 'bg-surface-soft text-stone' : 'bg-coral text-primary-foreground'} ${isStreamingThis ? 'ask-avatar-live' : ''}`}
                          >
                            {isFailure || isNoAnswer ? <AlertCircle size={14} /> : <Bot size={14} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            {message.failed ? (
                              <div className="rounded-xl border border-rose-400/25 bg-rose-500/10 px-3 py-2.5">
                                <div className="flex items-start gap-2 text-[13px] leading-6 text-rose-100">
                                  <AlertCircle size={15} className="mt-0.5 shrink-0 text-rose-300" />
                                  <span>{message.text}</span>
                                </div>
                                <button
                                  onClick={() => void handleAsk(message.retryQuestion || '')}
                                  className="ask-press mt-2 inline-flex items-center gap-1.5 rounded-md border border-rose-300/25 bg-rose-500/10 px-2 py-1 text-xs font-medium text-rose-100 hover:bg-rose-500/20"
                                >
                                  Try again <ArrowUp size={12} />
                                </button>
                              </div>
                            ) : isNoAnswer ? (
                              <p className="text-[13px] italic leading-6 text-stone">{message.text}</p>
                            ) : (
                              message.action === 'edit_confirmation_required' ? (
                                <div className="rounded-xl border border-amber-300/25 bg-amber-400/10 px-3 py-3 text-amber-50">
                                  <p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-amber-300">Article found</p>
                                  <p className="text-sm font-bold text-amber-50">{message.articleTitle || 'Matching article'}</p>
                                  <div className="mt-3 rounded-lg border border-amber-200/20 bg-black/10 px-3 py-2"><p className="text-[10px] font-bold uppercase tracking-widest text-amber-300">Original information</p><p className="mt-1 text-xs leading-5 text-amber-100/80">{message.originalInformation || message.articlePreview || 'The matched source passage is unavailable.'}</p></div>
                                  <div className="mt-3"><label className="text-[10px] font-bold uppercase tracking-widest text-amber-300" htmlFor={`edit-instruction-${messageId}`}>Will update</label><textarea id={`edit-instruction-${messageId}`} value={editDraft} onChange={(event) => updatePendingEditInstruction(event.target.value)} rows={4} className="mt-1 w-full resize-y rounded-lg border border-amber-200/20 bg-black/10 px-3 py-2 text-xs leading-5 text-amber-50 outline-none placeholder:text-amber-100/50 focus:border-amber-300/50" placeholder="Describe the corrected information" /></div>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      disabled={loading || !message.articleId || !editDraft.trim()}
                                      onClick={() => void handleAsk('Yes, update this article', { confirmEdit: true, articleId: message.articleId, editInstruction: editDraft })}
                                      className="ask-press rounded-lg bg-emerald-500 px-3 py-2 text-[11px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                      Yes, update this article
                                    </button>
                                    <button
                                      type="button"
                                      disabled={loading}
                                      onClick={cancelPendingEdit}
                                      className="ask-press rounded-lg border border-amber-200/25 px-3 py-2 text-[11px] font-bold text-amber-100 hover:bg-amber-300/10 disabled:opacity-50"
                                    >
                                      No
                                    </button>
                                  </div>
                                </div>
                              ) : message.action === 'edit_target_required' ? (
                                <div className="rounded-xl border border-amber-300/20 bg-amber-400/10 px-3 py-3 text-amber-100"><p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-amber-300">Article not found</p><AnswerText content={message.text} citations={[]} onCitationClick={setSelectedSource} /></div>
                              ) : message.action ? (
                                <div className="rounded-xl border border-emerald-300/20 bg-emerald-400/10 px-3 py-3 text-emerald-100"><p className="mb-2 text-[10px] font-bold uppercase tracking-widest text-emerald-300">AI action completed</p><AnswerText content={message.text} citations={[]} onCitationClick={setSelectedSource} /></div>
                              ) : message.answerGrounded !== undefined ? (
                                <AnswerSections grounded={message.answerGrounded} extended={message.answerExtended} citations={message.citations} onCitationClick={setSelectedSource} />
                              ) : (
                                <AnswerText content={message.text} citations={message.citations} onCitationClick={setSelectedSource} />
                              )
                            )}
                            {isStreamingThis && <span className="ml-1 inline-block h-4 w-0.5 animate-pulse bg-coral align-text-bottom" />}
                          </div>
                        </div>
                        {message.citations && message.citations.length > 0 && (
                          <div className="mt-4 border-t border-hairline pt-4 pl-10">
                            <button
                              type="button"
                              aria-expanded={expandedSources[messageId] ?? true}
                              onClick={() => setExpandedSources((items) => ({ ...items, [messageId]: !(items[messageId] ?? true) }))}
                              className="ask-press mb-2 flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-[10px] font-semibold uppercase tracking-widest text-stone hover:bg-surface hover:text-ink"
                            >
                              <span>{message.citations.length} source{message.citations.length > 1 ? 's' : ''}</span>
                              <ChevronDown size={14} className={`transition-transform duration-200 ${expandedSources[messageId] ?? true ? 'rotate-0' : '-rotate-90'}`} />
                            </button>
                            {(expandedSources[messageId] ?? true) && (
                              <div className="flex flex-col gap-1">
                                {message.citations.map((citation, citationIndex) => (
                                  <button
                                    key={`${citation.article_id}-${citationIndex}`}
                                    onClick={() => setSelectedSource(citation)}
                                    style={{ animationDelay: `${citationIndex * 40}ms` }}
                                    className="ask-fade-up flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-all duration-150 hover:translate-x-0.5 hover:bg-surface hover:shadow-sm"
                                  >
                                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-blue-500/20 text-[11px] font-semibold text-blue-300 transition-transform duration-150 group-hover:scale-105">{citation.source_index ?? citationIndex + 1}</span>
                                    <FileText size={14} className="shrink-0 text-stone" />
                                    <span className="truncate text-[13px] text-steel">{citation.title}</span>
                                    <span className="ml-auto shrink-0 text-[11px] text-stone">{citation.section_ref || 'General'}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        <div className="mt-4 flex items-center gap-2 border-t border-hairline/70 pt-3 pl-10">
                          <button
                            onClick={() => void copyMessage(message, index)}
                            className="ask-press flex items-center gap-1.5 rounded-md border border-hairline bg-canvas px-2 py-1 text-xs text-steel transition-[background-color,color,border-color] duration-150 hover:border-[#50627a] hover:bg-surface-soft hover:text-ink"
                            title="Copy answer"
                          >
                            {copiedId === messageId ? <><Check size={13} className="text-success" /> Copied</> : <><Copy size={13} /> Copy answer</>}
                          </button>
                          {message.logId && !message.feedbackSubmitted && (
                            <>
                              <span className="ml-2 text-xs text-stone">Helpful?</span>
                              <button onClick={() => void handleFeedback(index, 1)} className="ask-press rounded-full p-1 text-stone hover:bg-emerald-500/10 hover:text-success"><ThumbsUp size={13} /></button>
                              <button onClick={() => void handleFeedback(index, -1)} className="ask-press rounded-full p-1 text-stone hover:bg-rose-500/10 hover:text-rose-400"><ThumbsDown size={13} /></button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                  {loading && (
                    <div className="ask-fade-in flex items-center gap-2 pl-10 text-sm text-steel">
                      <span className="flex gap-1">
                        <i className="inline-block h-1.5 w-1.5 rounded-full bg-coral/70" style={{ animation: 'askShimmerDot 1.1s ease-in-out infinite' }} />
                        <i className="inline-block h-1.5 w-1.5 rounded-full bg-coral/70" style={{ animation: 'askShimmerDot 1.1s ease-in-out infinite', animationDelay: '150ms' }} />
                        <i className="inline-block h-1.5 w-1.5 rounded-full bg-coral/70" style={{ animation: 'askShimmerDot 1.1s ease-in-out infinite', animationDelay: '300ms' }} />
                      </span>
                      {t('search.searching')}
                    </div>
                  )}
                  <div ref={bottomRef} />
                </div>
              )}
            </div>
          </div>

          <div className="shrink-0 border-t border-hairline bg-canvas">
              <div className="mx-auto w-full max-w-none px-5 py-4 lg:px-8">
              {error && (
                <div className="ask-fade-up mb-3 flex items-start gap-2 rounded-lg border border-rose-400/30 bg-rose-500/10 px-3 py-2.5 text-xs text-rose-200">
                  <AlertCircle size={15} className="mt-0.5 shrink-0" />
                  <span className="flex-1">{error}</span>
                  <button onClick={() => setError('')} className="ask-press underline hover:text-rose-100">Dismiss</button>
                </div>
              )}
               {requestArticleId && <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-info/20 bg-info/10 px-3 py-2.5 text-xs text-info"><span className="min-w-0 flex-1">Requesting a correction for <strong>{requestArticleTitle}</strong>. Type the exact change, then submit it to an authorized editor.</span><button type="button" onClick={() => void handleCreateEditRequest()} disabled={loading || (question.trim().length < 5 && lastRequestText.trim().length < 5)} className="rounded-lg bg-info px-3 py-2 text-[11px] font-bold text-[#07131a] disabled:cursor-not-allowed disabled:opacity-50">Create edit request</button></div>}
               {requestStatus && <div role="status" className="mb-3 rounded-lg border border-emerald-300/20 bg-emerald-400/10 px-3 py-2 text-xs text-emerald-200">{requestStatus}</div>}
               <div className="mb-2 flex items-center gap-1.5 text-[11px] text-stone">
                 <span className="inline-flex items-center gap-1.5 rounded-full border border-info/20 bg-info/10 px-2 py-1 text-[10px] font-bold text-info"><span className="h-1.5 w-1.5 rounded-full bg-info" /> Grounded mode</span><span className="hidden sm:inline">Press <kbd className="rounded border border-hairline bg-surface px-1.5 py-0.5 font-mono text-[10px] text-steel">Enter</kbd> to send · <kbd className="rounded border border-hairline bg-surface px-1.5 py-0.5 font-mono text-[10px] text-steel">Shift+Enter</kbd> for a new line</span>
                <span className="ml-auto tabular-nums">{question.length}/4000</span>
              </div>
               <div className="gradient-border flex items-end gap-2 rounded-2xl border bg-surface p-2 transition-all duration-200 focus-within:shadow-lg focus-within:ring-2 focus-within:ring-minimaxBlue/20">
                <textarea
                  ref={textareaRef}
                  rows={1}
                  value={question}
                  onChange={(event) => setQuestion(event.target.value)}
                  onKeyDown={handleKeyDown}
                  disabled={loading}
                  maxLength={4000}
                  placeholder={t('chat.askPlaceholder')}
                  className="max-h-44 min-h-[28px] flex-1 resize-none overflow-hidden bg-transparent px-2 py-1.5 text-[13px] leading-6 text-ink outline-none placeholder:text-stone"
                />
                {loading && (
                  <button
                    type="button"
                    onClick={() => abortRef.current?.abort()}
                    aria-label="Stop generating"
                    title="Stop generating"
                    className="ask-press grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-hairline bg-surface text-steel transition hover:bg-surface-soft hover:text-ink"
                  >
                    <Square size={14} />
                  </button>
                )}
                <button
                  onClick={() => void handleAsk()}
                  disabled={!question.trim() || loading}
                  aria-label="Send question"
                   className="ask-press grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-[0_8px_18px_rgb(var(--primary)/.24)] transition-all hover:scale-105 hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100"
                >
                  <ArrowUp size={17} />
                </button>
              </div>
            </div>
          </div>
        </main>

        {selectedSource && (
          <>
            <button aria-label="Close source" onClick={() => setSelectedSource(null)} className="ask-fade-in fixed inset-0 z-40 bg-black/40 lg:hidden" />
            <aside className={`${sourceCollapsed ? 'w-12' : 'w-full max-w-sm lg:w-80'} ask-slide-in fixed inset-y-0 right-0 z-50 flex flex-col border-l border-hairline bg-surface transition-[width] duration-300 ease-out lg:static lg:shrink-0`}>
              <header className="signal-line flex h-14 shrink-0 items-center gap-2 border-b border-hairline px-3">
                <span className={`${sourceCollapsed ? 'hidden' : 'flex'} flex-1 items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-info`}><span className="h-1.5 w-1.5 rounded-full bg-info" /> Source evidence</span>
                <button
                  onClick={() => setSourceCollapsed((value) => !value)}
                  className="ask-press rounded-lg p-2 text-steel hover:bg-surface-soft hover:text-ink"
                  title={sourceCollapsed ? 'Expand source' : 'Collapse source'}
                >
                  {sourceCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
                </button>
                <button onClick={() => setSelectedSource(null)} className="ask-press rounded-lg p-2 text-steel hover:bg-surface-soft hover:text-ink">
                  <X size={16} />
                </button>
              </header>
              {!sourceCollapsed && (
                <>
                  <div className="ask-scroll ask-fade-in flex-1 overflow-y-auto p-5">
                     <div className="gradient-border rounded-2xl border p-3">
                     <div className="flex items-start gap-2.5">
                      <BookOpen size={16} className="mt-0.5 shrink-0 text-minimaxBlue" />
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink">{selectedSource.title}</p>
                        <p className="mt-0.5 text-[11px] text-stone">{selectedSource.section_ref || 'General section'}{selectedSource.page_number ? ` · Page ${selectedSource.page_number}` : ''}</p>
                     </div></div>
                    </div>
                    <div className="mt-5">
                       <p className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-stone"><span className="h-1.5 w-1.5 rounded-full bg-warning" /> Highlighted passage</p>
                      <blockquote className="rounded-r-md border-l-2 border-minimaxBlue bg-canvas px-4 py-3 text-xs leading-relaxed text-steel transition-colors">
                        <HighlightedSourceText text={selectedSource.excerpt || ''} highlights={selectedSource.highlight_texts} highlight={selectedSource.highlight_text} />
                      </blockquote>
                    </div>
                    {sourceError && <p className="ask-fade-up mt-3 text-xs text-rose-300">{sourceError}</p>}
                  </div>
                  <footer className="space-y-2 border-t border-hairline p-4">
                    <button
                      disabled={sourceLoading || !sourceUrl}
                      onClick={() => openSourceViewer(selectedSource)}
                      className="ask-press flex w-full items-center justify-center gap-2 rounded-lg bg-ink px-3 py-2 text-xs font-semibold text-primary-foreground transition-all hover:bg-charcoal hover:shadow-md disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-none"
                    >
                      {sourceLoading ? 'Loading source…' : selectedSource.page_number ? `View PDF · page ${selectedSource.page_number}` : 'View original source'} <BookOpen size={13} />
                    </button>
                    <button
                      onClick={() => navigate(`/articles/${selectedSource.article_id}`)}
                      className="ask-press flex w-full items-center justify-center gap-2 rounded-lg border border-hairline bg-canvas px-3 py-2 text-xs font-semibold text-ink transition-all hover:bg-surface-soft hover:shadow-sm"
                    >
                      Open article <ExternalLink size={13} />
                    </button>
                  </footer>
                </>
              )}
            </aside>
          </>
        )}

        {viewerSource && <PdfViewer open fileName={viewerSource.citation.title} url={viewerSource.url} page={viewerSource.citation.page_number} onClose={() => setViewerSource(null)} />}
      </div>
    </>
  )
}
