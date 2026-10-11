import React, { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  Activity, AlertTriangle, Bell, BookOpen, Bookmark, Bot, Building2, ChevronDown,
  ClipboardList, Compass, FileArchive, FileCheck2, FileText, FolderTree, Globe,
  Home, Menu, Monitor, Network, Plus, Search, Settings2, Shield, Sparkles, Tag, Users,
  type LucideIcon,
} from 'lucide-react'
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

type NavEntry = { to: string; label: string; icon: LucideIcon }

const directLink = ({ isActive }: { isActive: boolean }) =>
  `inline-flex min-h-8 items-center gap-1.5 rounded-control px-3 text-body-sm font-semibold no-underline transition hover:no-underline ${
    isActive ? 'bg-primary/10 text-primary-text' : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'
  }`

function NavDropdown({ label, items, active, onNavigate }: {
  label: string
  items: NavEntry[]
  active: boolean
  onNavigate: () => void
}) {
  const [open, setOpen] = useState(false)
  const anchorRef = useRef<HTMLButtonElement>(null)

  if (!items.length) return null

  return <div className="relative">
    <button
      ref={anchorRef}
      type="button"
      onClick={() => setOpen(value => !value)}
      aria-expanded={open}
      className={`inline-flex min-h-8 items-center gap-1.5 rounded-control px-3 text-body-sm font-semibold transition ${active ? 'bg-primary/10 text-primary-text' : 'text-muted-foreground hover:bg-surface-muted hover:text-foreground'}`}
    >
      {label}<ChevronDown size={13} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    <FloatingPanel anchorRef={anchorRef} open={open} onClose={() => setOpen(false)} widthRem={18} className="p-1.5">
      <div className="border-b border-border px-2.5 py-2">
        <p className="font-mono text-caption font-medium uppercase tracking-[.1em] text-muted">{label}</p>
      </div>
      <nav className="py-1" aria-label={label}>
        {items.map(({ to, label: itemLabel, icon: Icon }) => <Link
          key={to}
          to={to}
          onClick={() => { setOpen(false); onNavigate() }}
          className="flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-body-sm font-semibold text-foreground no-underline transition hover:bg-surface-muted hover:text-primary"
        >
          <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Icon size={14} /></span>
          <span className="min-w-0 flex-1">{itemLabel}</span>
        </Link>)}
      </nav>
    </FloatingPanel>
  </div>
}

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

  const knowledgeItems: NavEntry[] = [
    { to: '/articles', label: t('nav.articles'), icon: BookOpen },
    { to: '/search', label: t('nav.search'), icon: Search },
    { to: '/ai', label: t('nav.aiAssistant'), icon: Bot },
    { to: '/bookmarks', label: t('nav.saved'), icon: Bookmark },
  ]
  const governanceItems: NavEntry[] = has('governance.read') ? [
    { to: '/governance/pending-drafts', label: t('nav.pendingDrafts'), icon: FileText },
    { to: '/governance/gap-queue', label: t('nav.gapQueue'), icon: AlertTriangle },
    { to: '/governance/health', label: t('nav.healthDashboard'), icon: Activity },
    { to: '/governance/coverage', label: 'Coverage', icon: ClipboardList },
    ...(has('article.publish') ? [{ to: '/governance/approval-rules', label: t('nav.approvalRules'), icon: FileCheck2 }] : []),
    ...(has('role.manage') ? [{ to: '/governance/audit-log', label: t('nav.auditLogs'), icon: ClipboardList }] : []),
  ] : []
  const metadataItems: NavEntry[] = [
    { to: '/meta/tags', label: t('nav.tags'), icon: Tag },
    { to: '/meta/glossary', label: t('nav.glossary'), icon: Compass },
    { to: '/meta/graph', label: t('nav.graph'), icon: Network },
  ]
  const adminItems: NavEntry[] = [
    ...(has('user.manage') ? [
      { to: '/admin/users', label: t('nav.usersRoles'), icon: Users },
      { to: '/admin/departments', label: t('nav.departments'), icon: Building2 },
    ] : []),
    ...(has('role.manage') ? [
      { to: '/admin/roles', label: t('nav.rolesPermissions'), icon: Shield },
      { to: '/admin/features', label: t('nav.featureControls'), icon: Settings2 },
      { to: '/admin/llm', label: t('nav.aiProvider'), icon: Sparkles },
    ] : []),
    ...(has('connector.manage') ? [{ to: '/admin/connectors', label: t('nav.sourceConnectors'), icon: FolderTree }] : []),
    ...(has('article.create') ? [{ to: '/sources', label: t('nav.sourcesFiles'), icon: FileArchive }] : []),
  ]

  const path = location.pathname
  const knowledgeActive = path === '/browse' || path.startsWith('/articles') || path.startsWith('/search') || path.startsWith('/ai') || path.startsWith('/bookmarks')
  const governanceActive = path.startsWith('/governance')
  const metadataActive = path.startsWith('/meta')
  const adminActive = path.startsWith('/admin') || path === '/sources'

  return <>
    <header className="knowledge-header relative z-sticky shrink-0 border-b border-border bg-surface/95 backdrop-blur">
      <div className="flex min-h-[3.75rem] items-center gap-3 px-3 md:px-5">
        <Link to="/home" aria-label={t('nav.home')} className="group flex shrink-0 items-center gap-2.5 rounded-lg text-foreground no-underline transition hover:text-primary hover:no-underline focus-visible:ring-2 focus-visible:ring-ring/30">
          <BrandMarkGlyph className="h-8 w-8 transition-transform group-hover:scale-[1.04]" title="QNSC" />
          <span className="hidden font-display text-body font-bold tracking-tight lg:block">QNSC Knowledge</span>
        </Link>

        <form onSubmit={submitSearch} className="mx-auto flex min-w-0 max-w-2xl flex-1 items-center rounded-xl border border-border bg-background px-3 focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/10">
          <Search size={15} className="shrink-0 text-primary" />
          <input id="global-knowledge-search" value={query} onChange={event => setQuery(event.target.value)} placeholder={t('header.searchPlaceholder')} className="h-9 min-w-0 flex-1 bg-transparent px-2 text-body-sm text-foreground outline-none placeholder:text-muted" />
          <kbd className="hidden rounded border border-border bg-surface px-1.5 py-0.5 font-mono text-caption text-muted lg:block">Ctrl K</kbd>
        </form>

        <div className="flex shrink-0 items-center gap-1.5">
          {has('article.create') && <Button type="button" variant="primary" size="sm" onClick={() => navigate('/articles/new')} icon={<Plus size={13} />} className="hidden sm:inline-flex">New article</Button>}
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
          <Button type="button" variant="secondary" size="sm" onClick={onMenuClick} aria-label="Open mobile navigation" icon={<Menu size={16} />} className="md:hidden" />
        </div>
      </div>

      <nav aria-label="Workspace navigation" className="hidden min-h-10 items-center gap-1 overflow-x-auto border-t border-border px-4 md:flex lg:px-5">
        <NavDropdown label={t('nav.knowledge')} items={knowledgeItems} active={knowledgeActive} onNavigate={() => undefined} />
        <NavDropdown label={t('nav.governance')} items={governanceItems} active={governanceActive} onNavigate={() => undefined} />
        <NavDropdown label={t('nav.metadata')} items={metadataItems} active={metadataActive} onNavigate={() => undefined} />
        <NavDropdown label={t('nav.administration')} items={adminItems} active={adminActive} onNavigate={() => undefined} />
      </nav>
    </header>

    <nav aria-label="Mobile primary navigation" className="fixed inset-x-0 bottom-0 z-drawer grid h-14 grid-cols-5 border-t border-border bg-surface/95 px-1 backdrop-blur md:hidden">
      <NavLink to="/home" className={directLink}><Home size={16} /><span className="sr-only">{t('nav.home')}</span></NavLink>
      <NavLink to="/articles" className={() => directLink({ isActive: knowledgeActive && !path.startsWith('/ai') })}><BookOpen size={16} /><span className="sr-only">{t('nav.articles')}</span></NavLink>
      <NavLink to="/ai" className={() => directLink({ isActive: path.startsWith('/ai') })}><Bot size={16} /><span className="sr-only">{t('nav.aiAssistant')}</span></NavLink>
      {has('governance.read') ? <NavLink to="/governance/pending-drafts" className={() => directLink({ isActive: governanceActive })}><FileCheck2 size={16} /><span className="sr-only">{t('nav.pendingDrafts')}</span></NavLink> : <span />}
      <button type="button" onClick={onMenuClick} className="grid place-items-center rounded-control text-muted-foreground hover:bg-surface-muted hover:text-foreground"><Menu size={17} /><span className="sr-only">All navigation</span></button>
    </nav>
  </>
}
