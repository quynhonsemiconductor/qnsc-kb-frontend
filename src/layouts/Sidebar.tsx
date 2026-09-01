import React, { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Activity, AlertTriangle, BookOpen, Bookmark, Bot, ChevronDown, ClipboardList,
  Compass, FileArchive, FileText, FolderTree, Home, KeyRound, LogOut,
  Search, Settings2, Tag, Users, Shield, ShieldCheck, Sparkles, X, Building2, PanelLeftClose, PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react'
import { BrandMarkGlyph } from '../components/ui/BrandMark'
import { Button } from '../components/ui/Button'
import { useAuth } from '../auth/useAuth'
import { useLanguage } from '../i18n/LanguageProvider'
import { usePermission } from '../hooks/usePermission'
import { ChangePasswordModal } from '../auth/ChangePasswordModal'

type SectionKey = 'knowledge' | 'governance' | 'admin' | 'metadata'
type IconType = LucideIcon

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `group flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-body font-semibold no-underline transition-all hover:no-underline visited:no-underline ${
    isActive ? 'ops-sidebar-active text-foreground shadow-[inset_3px_0_0_rgb(var(--info)),0_8px_20px_rgb(var(--shadow)/.12)]' : 'text-steel ops-sidebar-hover hover:text-ink'
  }`

function NavItem({ to, icon: Icon, children, collapsed }: { to: string; icon: IconType; children: React.ReactNode; collapsed: boolean }) {
  // The label WRAPS rather than truncating: a nav item that silently loses its text is
  // worse than one that takes two lines, and `truncate` here was cutting the longer
  // entries at roughly fourteen characters. `title` is set unconditionally so the full
  // label is recoverable even when something does clip.
  return <NavLink to={to} title={String(children)} className={({ isActive }) => `${linkClass({ isActive })} ${collapsed ? 'justify-center px-2' : ''}`}><Icon size={15} className="shrink-0" /><span className={collapsed ? 'sr-only' : 'min-w-0 break-words'}>{children}</span></NavLink>
}

function NavSection({ title, open, onToggle, children, collapsed }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode; collapsed: boolean }) {
  return <section>
    {/* `text-muted-foreground`, not `text-stone` (which resolves to --muted). These are the
        group labels that structure the whole navigation, and --muted on --sidebar measured
        4.44:1 at 11px uppercase — under the floor for the smallest, most letter-spaced text
        in the shell. --muted-foreground clears it comfortably on the same surface. */}
    <button type="button" onClick={onToggle} aria-expanded={open} title={collapsed ? title : undefined} className={`ops-sidebar-hover flex w-full items-center rounded-lg py-2 text-caption font-bold uppercase tracking-[0.18em] text-muted-foreground ${collapsed ? 'justify-center px-2' : 'justify-between px-3'}`}>
      {collapsed ? <span className="h-px w-5 bg-border" /> : <><span className="min-w-0 break-words">{title}</span><ChevronDown size={14} className={`shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} /></>}
    </button>
    {open && <div className="mt-0.5 space-y-0.5">{children}</div>}
  </section>
}

export default function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const { logout, user } = useAuth()
  const location = useLocation()
  const { t } = useLanguage()
  const { has } = usePermission()
  const isReviewerOrAbove = has('governance.read')
  const isAdmin = has('role.manage')
  const [expanded, setExpanded] = useState<Record<SectionKey, boolean>>(() => {
    try {
      const stored = localStorage.getItem('qnsc-sidebar-sections')
      return stored ? JSON.parse(stored) : { knowledge: true, governance: true, admin: false, metadata: false }
    } catch { return { knowledge: true, governance: true, admin: false, metadata: false } }
  })
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem('qnsc-sidebar-collapsed') === 'true' } catch { return false }
  })
  const [passwordOpen, setPasswordOpen] = useState(false)
  // Tracks the breakpoint the drawer behaves differently at. Below `md` the sidebar is an
  // off-canvas overlay; at `md` and up it is permanent page furniture that must always be
  // reachable. `inert` has to follow that distinction, and a media query cannot express it
  // because `inert` is an attribute, not a style.
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia('(min-width: 768px)').matches)
  useEffect(() => {
    const media = window.matchMedia('(min-width: 768px)')
    const onChange = (event: MediaQueryListEvent) => setIsDesktop(event.matches)
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])
  // True only for the state that was the bug: translated off-screen, still in the tab order.
  const drawerHidden = !isDesktop && !mobileOpen

  useEffect(() => { localStorage.setItem('qnsc-sidebar-sections', JSON.stringify(expanded)) }, [expanded])
  useEffect(() => { localStorage.setItem('qnsc-sidebar-collapsed', String(collapsed)) }, [collapsed])
  useEffect(() => { onClose() }, [location.pathname, onClose])
  // Escape closes the overlay drawer. Without it the only way out was finding the backdrop
  // or a Close button that a keyboard user could not see.
  useEffect(() => {
    if (!mobileOpen) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [mobileOpen, onClose])
  const toggle = (key: SectionKey) => setExpanded((current) => ({ ...current, [key]: !current[key] }))

  return <>
    {mobileOpen && <button type="button" aria-label="Close navigation" onClick={onClose} className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[1px] md:hidden" />}
    {/* `inert` while the drawer is closed on a narrow viewport.

        The panel is hidden by `-translate-x-full`, which moves it off-screen but leaves it
        visible, focusable and in the accessibility tree. Measured at 320px: after the skip
        link, the next nine Tab stops all landed at x=-228 — 17 focusable controls a keyboard
        user had to walk through, blind, before reaching the page. `inert` removes the whole
        subtree from focus and from AT in one attribute, which is why it beats hanging
        tabIndex={-1} on every descendant.

        Deliberately NOT applied at md and up: there the sidebar is permanent navigation. */}
    <aside inert={drawerHidden} className={`ops-sidebar fixed inset-y-0 left-0 z-40 flex h-[100dvh] min-h-0 w-[min(88vw,15rem)] shrink-0 flex-col overflow-hidden border-r border-border shadow-2xl transition-[width,transform] duration-200 md:relative md:z-20 md:h-full md:translate-x-0 md:shadow-none ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'md:w-[3.6875rem]' : 'md:w-[15rem]'}`}>
      <div className={`border-b border-border px-4 py-5 ${collapsed ? 'md:px-3' : ''}`}>
        <div className={`flex items-center gap-3 ${collapsed ? 'md:justify-center' : 'justify-between'}`}><div className={`flex min-w-0 items-center gap-3 text-base font-semibold tracking-tight text-ink ${collapsed ? 'md:justify-center' : ''}`}><BrandMarkGlyph className="h-10 w-10 shrink-0" title="QNSC" /><span className={collapsed ? 'md:hidden' : 'min-w-0'}><span className="block truncate font-display text-body-lg leading-4">QNSC</span><span className="mt-0.5 block truncate text-caption font-semibold uppercase tracking-[.24em] text-muted-foreground">Semiconductor</span></span></div><div className="flex items-center gap-1"><Button type="button" variant="ghost" size="sm" onClick={() => setCollapsed(value => !value)} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} icon={collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />} className="hidden md:inline-flex" /><Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close navigation" icon={<X size={17} />} className="md:hidden" /></div></div>
        {/* The "Workspace is healthy · LIVE" badge that sat here is gone. Nothing computed
            it — it was a hardcoded green dot and the word Live on every page, so it could
            not have gone amber if the workspace were unhealthy. A status indicator that
            cannot report bad news trains people to ignore status, and the real signal
            already exists on the health dashboard. The brand block above is also no longer
            an <h1>: it was the shell's own heading competing with each page's real title,
            which gave every authenticated screen two h1s and no clear document outline. */}
      </div>

      {/* Named landmark. A screen reader lists regions by role plus name, so an unnamed
          <nav> announces as just "navigation" — no help when the header also has one. */}
      <nav aria-label={t('nav.mainLandmark')} className="sidebar-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4">
        <NavSection title={t('nav.knowledge')} open={expanded.knowledge} onToggle={() => toggle('knowledge')} collapsed={collapsed}>
          <NavItem to="/home" icon={Home} collapsed={collapsed}>{t('nav.home')}</NavItem><NavItem to="/articles" icon={BookOpen} collapsed={collapsed}>{t('nav.articles')}</NavItem><NavItem to="/search" icon={Search} collapsed={collapsed}>{t('nav.search')}</NavItem><NavItem to="/ai" icon={Bot} collapsed={collapsed}>{t('nav.aiAssistant')}</NavItem><NavItem to="/bookmarks" icon={Bookmark} collapsed={collapsed}>{t('nav.saved')}</NavItem>
        </NavSection>
        {isReviewerOrAbove && <NavSection title={t('nav.governance')} open={expanded.governance} onToggle={() => toggle('governance')} collapsed={collapsed}>
          <NavItem to="/governance/pending-drafts" icon={FileText} collapsed={collapsed}>{t('nav.pendingDrafts')}</NavItem><NavItem to="/governance/gap-queue" icon={AlertTriangle} collapsed={collapsed}>{t('nav.gapQueue')}</NavItem><NavItem to="/governance/health" icon={Activity} collapsed={collapsed}>{t('nav.healthDashboard')}</NavItem>{isAdmin && <NavItem to="/governance/audit-log" icon={ClipboardList} collapsed={collapsed}>{t('nav.auditLogs')}</NavItem>}
        </NavSection>}
        <NavSection title={t('nav.administration')} open={expanded.admin} onToggle={() => toggle('admin')} collapsed={collapsed}>
          {has('user.manage') && <NavItem to="/admin/users" icon={Users} collapsed={collapsed}>{t('nav.usersRoles')}</NavItem>}{has('user.manage') && <NavItem to="/admin/access-groups" icon={ShieldCheck} collapsed={collapsed}>{t('nav.accessGroups')}</NavItem>}{has('user.manage') && <NavItem to="/admin/departments" icon={Building2} collapsed={collapsed}>{t('nav.departments')}</NavItem>}{has('role.manage') && <NavItem to="/admin/roles" icon={Shield} collapsed={collapsed}>{t('nav.rolesPermissions')}</NavItem>}{has('connector.manage') && <NavItem to="/admin/connectors" icon={FolderTree} collapsed={collapsed}>{t('nav.sourceConnectors')}</NavItem>}{has('role.manage') && <NavItem to="/admin/features" icon={Settings2} collapsed={collapsed}>{t('nav.featureControls')}</NavItem>}{has('role.manage') && <NavItem to="/admin/llm" icon={Sparkles} collapsed={collapsed}>{t('nav.aiProvider')}</NavItem>}{has('article.create') && <NavItem to="/sources" icon={FileArchive} collapsed={collapsed}>{t('nav.sourcesFiles')}</NavItem>}
        </NavSection>
        <NavSection title={t('nav.metadata')} open={expanded.metadata} onToggle={() => toggle('metadata')} collapsed={collapsed}>
          <NavItem to="/meta/tags" icon={Tag} collapsed={collapsed}>{t('nav.tags')}</NavItem><NavItem to="/meta/glossary" icon={Compass} collapsed={collapsed}>{t('nav.glossary')}</NavItem>
        </NavSection>
      </nav>

      <div className={`border-t border-border p-3 ${collapsed ? 'md:p-2' : ''}`}><div className={`mb-2 flex items-center gap-2.5 rounded-2xl border border-border bg-gradient-to-br from-surface-elevated to-surface px-3 py-3 shadow-[0_10px_24px_rgb(var(--shadow)/.12)] ${collapsed ? 'md:justify-center md:px-1' : ''}`} title={collapsed ? `${user?.name || 'User'} · ${user?.role || 'Staff'}` : undefined}><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary-muted to-primary text-body-sm font-extrabold text-primary-foreground">{user?.name?.substring(0, 2).toUpperCase() || 'US'}</div><div className={collapsed ? 'md:hidden' : 'min-w-0'}><div className="truncate text-xs font-bold text-ink">{user?.name || 'User'}</div><div className="mt-0.5 flex items-center gap-1.5 text-caption font-medium text-stone"><span className="h-1.5 w-1.5 rounded-full bg-success" />{user?.role || 'Staff'}</div></div></div><Button onClick={() => setPasswordOpen(true)} variant="ghost" size="sm" icon={<KeyRound size={14} />} title={collapsed ? t('auth.changePassword') : undefined} className={`w-full justify-start ${collapsed ? 'md:justify-center' : ''}`}><span className={collapsed ? 'md:hidden' : ''}>{t('auth.changePassword')}</span></Button><Button onClick={logout} variant="ghost" size="sm" icon={<LogOut size={14} />} title={collapsed ? t('nav.logOut') : undefined} className={`w-full justify-start text-destructive-text hover:bg-destructive/10 ${collapsed ? 'md:justify-center' : ''}`}><span className={collapsed ? 'md:hidden' : ''}>{t('nav.logOut')}</span></Button></div>
    </aside>
    <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
  </>
}
