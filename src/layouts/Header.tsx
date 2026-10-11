import React, { useEffect, useRef, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { Bell, BookOpen, Bot, FileCheck2, Globe, Home, Menu, Monitor, Plus, Search } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageProvider'
import { usePermission } from '../hooks/usePermission'
import { usePolling } from '../hooks/usePolling'
import { useTheme, type ThemePreference } from '../theme/ThemeProvider'
import { listNotifications, markNotificationRead, type InAppNotification } from '../api/notifications'
import { Select } from '../components/ui/Select'
import { Button } from '../components/ui/Button'
import { FloatingPanel } from '../components/ui/FloatingPanel'
import { BrandMarkGlyph } from '../components/ui/BrandMark'
import { formatDateTime } from '../lib/formatters'

const primaryLink = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-8 items-center gap-1.5 rounded-control px-3 text-body-sm font-semibold no-underline transition hover:no-underline ${
    isActive ? 'bg-surface-elevated text-primary shadow-raised' : 'text-muted-foreground hover:bg-surface-elevated/70 hover:text-foreground'
  }`

export default function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const { language, setLanguage, t } = useLanguage()
  const { has } = usePermission()
  const { theme, setTheme } = useTheme()
  const [query, setQuery] = useState('')
  const [notifications, setNotifications] = useState<InAppNotification[]>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const notificationAnchor = useRef<HTMLButtonElement>(null)

  const loadNotifications = async () => {
    try { setNotifications(await listNotifications()) } catch { /* supplementary endpoint */ }
  }

  useEffect(() => { void loadNotifications() }, [])
  usePolling(loadNotifications, 60_000)

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        document.getElementById('global-knowledge-search')?.focus()
      }
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [])

  const unreadCount = notifications.filter(item => !item.read_at).length
  const openNotification = async (item: InAppNotification) => {
    if (!item.read_at) {
      try { await markNotificationRead(item.id) } catch { /* navigation still works */ }
      setNotifications(items => items.map(entry => entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry))
    }
    setNotificationsOpen(false)
    if (item.payload.action_url) navigate(item.payload.action_url)
    else if (item.payload.article_id) navigate(`/articles/${item.payload.article_id}`)
    else if (item.payload.draft_id && has('governance.read')) navigate('/governance/pending-drafts')
  }

  const submitSearch = (event: React.FormEvent) => {
    event.preventDefault()
    const value = query.trim()
    if (value) navigate(`/search?q=${encodeURIComponent(value)}`)
  }

  const inArticles = location.pathname === '/browse' || location.pathname.startsWith('/articles')
  const inAi = location.pathname.startsWith('/ai')
  const inReview = location.pathname.startsWith('/governance/pending-drafts')

  return <>
    <header className="knowledge-header relative z-sticky flex min-h-[3.875rem] shrink-0 items-center gap-3 border-b border-border bg-surface/95 px-3 md:px-5">
      <div className="flex shrink-0 items-center gap-2.5">
        <BrandMarkGlyph className="h-8 w-8" title="QNSC" />
        <span className="hidden font-display text-body font-bold tracking-tight text-foreground xl:block">QNSC Knowledge</span>
      </div>

      <nav aria-label="Primary navigation" className="hidden items-center rounded-xl bg-surface-muted p-1 md:flex">
        <NavLink to="/home" className={primaryLink}><Home size={14} />{t('nav.home')}</NavLink>
        <NavLink to="/articles" className={() => primaryLink({ isActive: inArticles })}><BookOpen size={14} />{t('nav.articles')}</NavLink>
        <NavLink to="/ai" className={() => primaryLink({ isActive: inAi })}><Bot size={14} />{t('nav.aiAssistant')}</NavLink>
        {has('governance.read') && <NavLink to="/governance/pending-drafts" className={() => primaryLink({ isActive: inReview })}><FileCheck2 size={14} />{t('nav.pendingDrafts')}</NavLink>}
      </nav>

      <form onSubmit={submitSearch} className="ml-auto flex min-w-0 max-w-xl flex-1 items-center rounded-xl border border-border bg-background px-3 focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/10">
        <Search size={15} className="shrink-0 text-primary" />
        <input id="global-knowledge-search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('header.searchPlaceholder')} className="h-9 min-w-0 flex-1 bg-transparent px-2 text-body-sm text-foreground outline-none placeholder:text-muted" />
        <kbd className="hidden rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-caption text-muted lg:block">Ctrl K</kbd>
      </form>

      <div className="flex shrink-0 items-center gap-1.5">
        {has('article.create') && <Button type="button" variant="primary" size="sm" onClick={() => navigate('/articles/new')} icon={<Plus size={13} />} className="hidden lg:inline-flex">New article</Button>}
        <div className="relative">
          <button ref={notificationAnchor} type="button" onClick={() => setNotificationsOpen(open => !open)} aria-label="Notifications" aria-expanded={notificationsOpen} className="ui-icon-button h-8 min-h-8 min-w-8 border border-border bg-surface text-foreground hover:bg-surface-soft">
            <Bell size={15} />
            {unreadCount > 0 && <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-caption font-bold text-destructive-foreground ring-2 ring-surface">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          <FloatingPanel anchorRef={notificationAnchor} open={notificationsOpen} onClose={() => setNotificationsOpen(false)} widthRem={20} className="rounded-xl p-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-3"><span className="text-body font-bold text-foreground">Notifications</span>{unreadCount > 0 && <span className="rounded-md bg-primary/10 px-2 py-1 text-caption font-bold text-primary-text">{unreadCount} unread</span>}</div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? <p className="px-3 py-6 text-center text-body-sm text-muted">You’re all caught up.</p> : notifications.map(item => <button type="button" key={item.id} onClick={() => void openNotification(item)} className={`block w-full border-b border-border px-3 py-3 text-left transition hover:bg-surface-soft ${item.read_at ? 'text-muted' : 'bg-primary/5 text-foreground'}`}>
                <span className="block text-body-sm font-semibold">{item.payload.event === 'article_edit_request' ? `Edit requested: ${item.payload.article_title || 'article'}` : item.payload.event === 'draft_assigned' ? 'Draft assigned for review' : item.payload.event === 'draft_rejected' ? 'Draft needs changes' : 'Draft approved'}</span>
                {item.payload.event === 'article_edit_request' && item.payload.request_text && <span className="mt-1 block line-clamp-2 text-caption text-muted-foreground">{item.payload.request_text}</span>}
                <span className="mt-1 block text-caption text-muted">{formatDateTime(item.created_at)}</span>
              </button>)}
            </div>
          </FloatingPanel>
        </div>
        <label className="hidden h-8 items-center gap-1 rounded-lg border border-border bg-surface px-2 text-caption font-semibold text-muted-foreground sm:flex"><Globe size={12} /><Select value={language} onChange={event => setLanguage(event.target.value as 'en' | 'vi')} aria-label={t('language.switch')} className="cursor-pointer border-0 bg-transparent p-0 text-caption font-semibold text-foreground"><option value="en">EN</option><option value="vi">VI</option></Select></label>
        <label className="hidden h-8 items-center gap-1 rounded-lg border border-border bg-surface px-2 text-caption font-semibold text-muted-foreground xl:flex"><Monitor size={12} /><Select value={theme} onChange={event => setTheme(event.target.value as ThemePreference)} aria-label="Appearance" className="theme-select border-0 bg-transparent p-0 text-caption"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></Select></label>
        <Button type="button" variant="secondary" size="sm" onClick={onMenuClick} aria-label="Open all navigation" icon={<Menu size={16} />}><span className="hidden xl:inline">More</span></Button>
      </div>
    </header>

    <nav aria-label="Mobile primary navigation" className="fixed inset-x-0 bottom-0 z-drawer grid h-14 grid-cols-4 border-t border-border bg-surface/95 px-1 backdrop-blur md:hidden">
      <NavLink to="/home" className={primaryLink}><Home size={16} /><span className="sr-only">{t('nav.home')}</span></NavLink>
      <NavLink to="/articles" className={() => primaryLink({ isActive: inArticles })}><BookOpen size={16} /><span className="sr-only">{t('nav.articles')}</span></NavLink>
      <NavLink to="/ai" className={() => primaryLink({ isActive: inAi })}><Bot size={16} /><span className="sr-only">{t('nav.aiAssistant')}</span></NavLink>
      {has('governance.read') ? <NavLink to="/governance/pending-drafts" className={() => primaryLink({ isActive: inReview })}><FileCheck2 size={16} /><span className="sr-only">{t('nav.pendingDrafts')}</span></NavLink> : <button type="button" onClick={onMenuClick} className="grid place-items-center text-muted-foreground"><Menu size={17} /><span className="sr-only">More</span></button>}
    </nav>
  </>
}
