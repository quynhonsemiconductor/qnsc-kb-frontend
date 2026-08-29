import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, Command, Globe, Menu, Monitor, Plus } from 'lucide-react'
import { useLanguage } from '../i18n/LanguageProvider'
import { usePermission } from '../hooks/usePermission'
import { usePolling } from '../hooks/usePolling'
import { useTheme, type ThemePreference } from '../theme/ThemeProvider'
import { listNotifications, markNotificationRead, type InAppNotification } from '../api/notifications'
import { Select } from '../components/ui/Select'
import { Button } from '../components/ui/Button'
import { FloatingPanel } from '../components/ui/FloatingPanel'

export default function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const navigate = useNavigate()
  const { language, setLanguage, t } = useLanguage()
  const { has } = usePermission()
  const { theme, setTheme } = useTheme()
  const [notifications, setNotifications] = useState<InAppNotification[]>([])
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const notificationAnchor = useRef<HTMLButtonElement>(null)

  const loadNotifications = async () => {
    try {
      setNotifications(await listNotifications())
    } catch {
      // Notifications are supplementary; an unavailable endpoint must not
      // prevent primary navigation from rendering.
    }
  }

  useEffect(() => { void loadNotifications() }, [])
  // The bell is on every screen, so this is the one poll that always runs. Kept slow
  // deliberately: usePolling pauses it in a background tab and refreshes the moment the
  // tab is looked at again, which is what actually makes the count feel current.
  usePolling(loadNotifications, 60_000)

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

  // min-h in rem, not px: the contents (h-8 controls, py-2) are rem-based and grow with
  // the workspace scale, so a frozen 56px box stopped matching them and the controls
  // pressed into each other. flex-wrap is the guarantee — a row of non-shrinking controls
  // that cannot wrap has nowhere to go but on top of itself.
  return (
    <header className="ops-header relative z-10 flex min-h-[3.5rem] flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border px-3 py-2 md:min-h-[3.75rem] md:px-5">
      <Button type="button" variant="secondary" size="sm" onClick={onMenuClick} aria-label="Open navigation" icon={<Menu size={16} />} className="shrink-0 md:hidden" />
      <div className="hidden min-w-[9.375rem] lg:block"><p className="text-caption font-bold uppercase tracking-[.16em] text-stone">QNSC / Workspace</p></div>
      <div className="ml-auto flex items-center gap-1.5 md:gap-2">
        {has('article.create') && <Button type="button" variant="primary" size="sm" onClick={() => navigate('/articles/new')} icon={<Plus size={13} />} className="hidden shadow-[0_5px_12px_rgb(var(--primary)/.18)] sm:inline-flex">New article</Button>}
        <div className="relative">
          <button ref={notificationAnchor} type="button" onClick={() => setNotificationsOpen((open) => !open)} aria-label="Notifications" aria-expanded={notificationsOpen} className="ui-button relative inline-flex h-8 items-center justify-center rounded-control border border-border bg-surface px-3 text-body-sm font-semibold text-foreground transition-all duration-200 hover:bg-surface-soft hover:border-primary/30 active:scale-[0.97]">
            <Bell size={15} />
            {unreadCount > 0 && <span className="absolute -right-1 -top-1 grid min-h-4 min-w-4 place-items-center rounded-full bg-destructive px-1 text-caption font-bold text-primary-foreground ring-2 ring-surface">{unreadCount > 9 ? '9+' : unreadCount}</span>}
          </button>
          <FloatingPanel anchorRef={notificationAnchor} open={notificationsOpen} onClose={() => setNotificationsOpen(false)} widthRem={20} className="rounded-2xl p-0">
            <div className="flex items-center justify-between border-b border-border px-4 py-3"><span className="text-sm font-bold text-ink">Notifications</span>{unreadCount > 0 && <span className="rounded-full bg-primary/10 px-2 py-1 text-caption font-bold text-primary">{unreadCount} unread</span>}</div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? <p className="px-3 py-6 text-center text-sm text-stone">You’re all caught up.</p> : notifications.map((item) => <button type="button" key={item.id} onClick={() => void openNotification(item)} className={`block w-full border-b border-border px-3 py-3 text-left transition hover:bg-surface-soft ${item.read_at ? 'text-stone' : 'bg-primary/5 text-ink'}`}>
                <span className="block text-sm font-semibold">{item.payload.event === 'article_edit_request' ? `Edit requested: ${item.payload.article_title || 'article'}` : item.payload.event === 'draft_assigned' ? 'Draft assigned for review' : item.payload.event === 'draft_rejected' ? 'Draft needs changes' : 'Draft approved'}</span>
                {item.payload.event === 'article_edit_request' && item.payload.request_text && <span className="mt-1 block line-clamp-2 text-xs text-steel">{item.payload.request_text}</span>}
                <span className="mt-0.5 block text-xs">{new Date(item.created_at).toLocaleString()}</span>
              </button>)}
            </div>
          </FloatingPanel>
        </div>
        <label className="flex h-8 items-center gap-1 rounded-lg border border-border bg-surface px-2 text-body-sm font-semibold text-steel">
          <Globe size={12} />
          <Select
            value={language}
            onChange={(event) => setLanguage(event.target.value as 'en' | 'vi')}
            aria-label={t('language.switch')}
            className="cursor-pointer border-0 bg-transparent p-0 text-body-sm font-semibold text-ink outline-none"
          >
            <option value="en">EN</option>
            <option value="vi">VI</option>
          </Select>
        </label>
        <label className="hidden h-8 items-center gap-1.5 rounded-lg border border-border bg-surface px-2 text-body-sm font-semibold text-steel md:flex"><Monitor size={12} /><Select value={theme} onChange={(event) => setTheme(event.target.value as ThemePreference)} aria-label="Appearance" className="theme-select text-body-sm"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></Select></label>
        <div className="hidden items-center gap-1.5 px-1 text-caption font-semibold uppercase tracking-[.12em] text-stone lg:flex"><Command size={11} /> Ops console</div>
      </div>
    </header>
  )
}
