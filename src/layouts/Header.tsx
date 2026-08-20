import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Command, Globe, Menu, Monitor, Plus } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageProvider'
import { usePermission } from '../hooks/usePermission'
import { useTheme, type ThemePreference } from '../theme/ThemeProvider'
import { listNotifications, markNotificationRead, type InAppNotification } from '../api/notifications'
import { Select } from '../components/ui/Select'
import { Tooltip } from '../components/ui/Tooltip'
import { FloatingPanel } from '../components/ui/FloatingPanel'

export default function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const navigate = useNavigate()
  const { language, setLanguage, t } = useLanguage()
  const { has } = usePermission()
  const { theme, setTheme } = useTheme()
  const [notifications, setNotifications] = useState<InAppNotification[]>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const notificationAnchor = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const items = await listNotifications()
        if (active) setNotifications(items)
      } catch {
        // Notifications are supplementary; an unavailable endpoint must not
        // prevent primary navigation from rendering.
      }
    }
    void load()
    const timer = window.setInterval(() => void load(), 60_000)
    return () => { active = false; window.clearInterval(timer) }
  }, [])

  const unreadCount = notifications.filter((item) => !item.read_at).length
  const openNotification = async (item: InAppNotification) => {
    if (!item.read_at) {
      try { await markNotificationRead(item.id) } catch { /* navigation still works */ }
      setNotifications((items) => items.map((entry) => entry.id === item.id ? { ...entry, read_at: new Date().toISOString() } : entry))
    }
    setNotificationsOpen(false)
    if (item.payload.action_url) navigate(item.payload.action_url)
    else if (item.payload.article_id) navigate(`/articles/${item.payload.article_id}`)
    else if (item.payload.draft_id && has('governance.read')) navigate('/governance/pending-drafts')
  }

  return (
    <header className="ops-header relative z-10 flex min-h-[56px] items-center justify-between gap-3 border-b border-border px-3 py-2 backdrop-blur-xl md:min-h-[60px] md:px-5">
      <button type="button" onClick={onMenuClick} aria-label="Open navigation" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-border bg-surface text-steel transition hover:bg-surface-soft hover:text-ink md:hidden"><Menu size={16} /></button>
      <div className="hidden min-w-[150px] lg:block"><p className="text-[10px] font-bold uppercase tracking-[.16em] text-stone">QNSC / Workspace</p></div>
      <div className="ml-auto flex items-center gap-1.5 md:gap-2">
        {has('article.create') && <button type="button" onClick={() => navigate('/articles/new')} className="hidden items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-xs font-bold text-primary-foreground shadow-[0_5px_12px_rgb(var(--primary)/.18)] transition hover:bg-primary/90 sm:inline-flex"><Plus size={13} /> New article</button>}
        <div className="relative">
          <Tooltip content="Notifications"><button ref={notificationAnchor} type="button" onClick={() => setNotificationsOpen((open) => !open)} aria-label="Notifications" aria-expanded={notificationsOpen} className="relative grid h-8 w-8 place-items-center rounded-lg border border-border bg-surface text-steel transition hover:bg-surface-soft hover:text-ink">
            <Bell size={15} />
            {unreadCount > 0 && <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-rose-600 px-1 text-[9px] font-bold text-primary-foreground ring-2 ring-surface">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button></Tooltip>
          <FloatingPanel anchorRef={notificationAnchor} open={notificationsOpen} onClose={() => setNotificationsOpen(false)} width={320} className="rounded-2xl p-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-3"><span className="text-sm font-bold text-ink">Notifications</span>{unreadCount > 0 && <span className="rounded-full bg-primary/10 px-2 py-1 text-[10px] font-bold text-primary">{unreadCount} unread</span>}</div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? <p className="px-3 py-6 text-center text-sm text-stone">You’re all caught up.</p> : notifications.map((item) => <button type="button" key={item.id} onClick={() => void openNotification(item)} className={`block w-full border-b border-border px-3 py-3 text-left transition hover:bg-surface-soft ${item.read_at ? 'text-stone' : 'bg-primary/5 text-ink'}`}>
                <span className="block text-sm font-semibold">{item.payload.event === 'article_edit_request' ? `Edit requested: ${item.payload.article_title || 'article'}` : item.payload.event === 'draft_assigned' ? 'Draft assigned for review' : item.payload.event === 'draft_rejected' ? 'Draft needs changes' : 'Draft approved'}</span>
                {item.payload.event === 'article_edit_request' && item.payload.request_text && <span className="mt-1 block line-clamp-2 text-xs text-steel">{item.payload.request_text}</span>}
                <span className="mt-0.5 block text-xs">{new Date(item.created_at).toLocaleString()}</span>
              </button>)}
            </div>
          </FloatingPanel>
        </div>
        <label className="flex h-8 items-center gap-1 rounded-lg border border-border bg-surface px-2 text-[11px] font-semibold text-steel">
          <Globe size={12} />
          <Select
            value={language}
            onChange={(event) => setLanguage(event.target.value as 'en' | 'vi')}
            aria-label={t('language.switch')}
            className="cursor-pointer border-0 bg-transparent p-0 text-[11px] font-semibold text-ink outline-none"
          >
            <option value="en">EN</option>
            <option value="vi">VI</option>
          </Select>
        </label>
        <label className="hidden h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2 text-[11px] font-semibold text-steel md:flex"><Monitor size={12} /><Select value={theme} onChange={(event) => setTheme(event.target.value as ThemePreference)} aria-label="Appearance" className="theme-select text-[11px]"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></Select></label>
        <div className="hidden items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-[.12em] text-stone lg:flex"><Command size={11} /> Ops console</div>
      </div>
    </header>
  )
}
