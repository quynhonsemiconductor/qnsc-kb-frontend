import React, { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Activity, AlertTriangle, BookOpen, Bookmark, Bot, ChevronDown, ClipboardList,
  Compass, FileArchive, FileText, FolderTree, Home, LogOut,
  Search, Settings2, Tag, Users, Shield, ShieldCheck, Sparkles, X, Building2, PanelLeftClose, PanelLeftOpen,
  type LucideIcon,
} from 'lucide-react'
import { useAuth } from '../auth/useAuth'
import { useLanguage } from '../i18n/LanguageProvider'
import { usePermission } from '../hooks/usePermission'

type SectionKey = 'knowledge' | 'governance' | 'admin' | 'metadata'
type IconType = LucideIcon

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `group flex min-w-0 items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-semibold no-underline transition-all hover:no-underline visited:no-underline ${
    isActive ? 'ops-sidebar-active text-foreground shadow-[inset_3px_0_0_rgb(var(--info)),0_8px_20px_rgb(var(--shadow)/.12)]' : 'text-steel ops-sidebar-hover hover:text-ink'
  }`

function NavItem({ to, icon: Icon, children, collapsed }: { to: string; icon: IconType; children: React.ReactNode; collapsed: boolean }) {
  return <NavLink to={to} title={collapsed ? String(children) : undefined} className={({ isActive }) => `${linkClass({ isActive })} ${collapsed ? 'justify-center px-2' : ''}`}><Icon size={15} className="shrink-0" /><span className={collapsed ? 'sr-only' : 'truncate'}>{children}</span></NavLink>
}

function NavSection({ title, open, onToggle, children, collapsed }: { title: string; open: boolean; onToggle: () => void; children: React.ReactNode; collapsed: boolean }) {
  return <section>
    <button type="button" onClick={onToggle} aria-expanded={open} title={collapsed ? title : undefined} className={`ops-sidebar-hover flex w-full items-center rounded-lg py-2 text-[10px] font-bold uppercase tracking-[0.18em] text-stone ${collapsed ? 'justify-center px-2' : 'justify-between px-3'}`}>
      {collapsed ? <span className="h-px w-5 bg-border" /> : <><span className="truncate">{title}</span><ChevronDown size={14} className={`shrink-0 transition-transform ${open ? '' : '-rotate-90'}`} /></>}
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

  useEffect(() => { localStorage.setItem('qnsc-sidebar-sections', JSON.stringify(expanded)) }, [expanded])
  useEffect(() => { localStorage.setItem('qnsc-sidebar-collapsed', String(collapsed)) }, [collapsed])
  useEffect(() => { onClose() }, [location.pathname, onClose])
  const toggle = (key: SectionKey) => setExpanded((current) => ({ ...current, [key]: !current[key] }))

  return <>
    {mobileOpen && <button type="button" aria-label="Close navigation" onClick={onClose} className="fixed inset-0 z-30 bg-black/40 backdrop-blur-[1px] md:hidden" />}
    <aside className={`ops-sidebar fixed inset-y-0 left-0 z-40 flex h-[100dvh] min-h-0 w-[min(88vw,218px)] shrink-0 flex-col overflow-hidden border-r border-border shadow-2xl transition-[width,transform] duration-200 md:relative md:z-20 md:h-full md:translate-x-0 md:shadow-none ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} ${collapsed ? 'md:w-[59px]' : 'md:w-[200px]'}`}>
      <div className={`border-b border-border px-4 py-5 ${collapsed ? 'md:px-3' : ''}`}>
        <div className={`flex items-center gap-3 ${collapsed ? 'md:justify-center' : 'justify-between'}`}><h1 className={`flex min-w-0 items-center gap-3 text-base font-semibold tracking-tight text-ink ${collapsed ? 'md:justify-center' : ''}`}><span className="relative grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-info via-primary to-primary-strong text-sm font-extrabold text-primary-foreground shadow-[0_10px_24px_rgb(var(--primary)/.28)]"><span className="absolute -right-2 -top-2 h-7 w-7 rounded-full bg-white/25 blur-md" />Q</span><span className={collapsed ? 'md:hidden' : 'min-w-0'}><span className="block truncate font-display text-[15px] leading-4">QNSC</span></span></h1><div className="flex items-center gap-1"><button type="button" onClick={() => setCollapsed(value => !value)} aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'} title={collapsed ? 'Expand navigation' : 'Collapse navigation'} className="hidden h-8 w-8 place-items-center rounded-lg text-stone transition hover:bg-surface-soft hover:text-ink md:grid">{collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}</button><button type="button" onClick={onClose} aria-label="Close navigation" className="grid h-8 w-8 place-items-center rounded-lg text-stone transition hover:bg-surface-soft hover:text-ink md:hidden"><X size={17} /></button></div></div>
        <div className={`mt-5 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/10 px-3 py-2 text-[11px] font-semibold text-primary-muted ${collapsed ? 'md:mx-auto md:h-8 md:w-8 md:justify-center md:p-0' : ''}`} title={collapsed ? 'Workspace is healthy' : undefined}><span className="h-2 w-2 shrink-0 rounded-full bg-success shadow-[0_0_12px_rgb(var(--success)/.8)]" /><span className={collapsed ? 'md:hidden' : ''}>Workspace is healthy</span><span className={`ml-auto font-mono text-[9px] uppercase tracking-widest opacity-70 ${collapsed ? 'md:hidden' : ''}`}>Live</span></div>
      </div>

      <nav className="sidebar-scroll min-h-0 flex-1 space-y-4 overflow-y-auto px-3 py-4">
        <NavSection title={t('nav.knowledge')} open={expanded.knowledge} onToggle={() => toggle('knowledge')} collapsed={collapsed}>
          <NavItem to="/home" icon={Home} collapsed={collapsed}>Home</NavItem><NavItem to="/articles" icon={BookOpen} collapsed={collapsed}>{t('nav.articles')}</NavItem><NavItem to="/search" icon={Search} collapsed={collapsed}>{t('nav.search')}</NavItem><NavItem to="/ai" icon={Bot} collapsed={collapsed}>{t('nav.aiAssistant')}</NavItem><NavItem to="/bookmarks" icon={Bookmark} collapsed={collapsed}>Saved</NavItem>
        </NavSection>
        {isReviewerOrAbove && <NavSection title={t('nav.governance')} open={expanded.governance} onToggle={() => toggle('governance')} collapsed={collapsed}>
          <NavItem to="/governance/pending-drafts" icon={FileText} collapsed={collapsed}>{t('nav.pendingDrafts')}</NavItem><NavItem to="/governance/gap-queue" icon={AlertTriangle} collapsed={collapsed}>{t('nav.gapQueue')}</NavItem><NavItem to="/governance/health" icon={Activity} collapsed={collapsed}>{t('nav.healthDashboard')}</NavItem>{isAdmin && <NavItem to="/governance/audit-log" icon={ClipboardList} collapsed={collapsed}>{t('nav.auditLogs')}</NavItem>}
        </NavSection>}
        <NavSection title="Administration" open={expanded.admin} onToggle={() => toggle('admin')} collapsed={collapsed}>
          {has('user.manage') && <NavItem to="/admin/users" icon={Users} collapsed={collapsed}>{t('nav.usersRoles')}</NavItem>}{has('user.manage') && <NavItem to="/admin/access-groups" icon={ShieldCheck} collapsed={collapsed}>Access groups</NavItem>}{has('user.manage') && <NavItem to="/admin/departments" icon={Building2} collapsed={collapsed}>Departments</NavItem>}{has('role.manage') && <NavItem to="/admin/roles" icon={Shield} collapsed={collapsed}>Roles &amp; permissions</NavItem>}{has('connector.manage') && <NavItem to="/admin/connectors" icon={FolderTree} collapsed={collapsed}>{t('nav.sourceConnectors')}</NavItem>}{has('role.manage') && <NavItem to="/admin/features" icon={Settings2} collapsed={collapsed}>{t('nav.featureControls')}</NavItem>}{has('role.manage') && <NavItem to="/admin/llm" icon={Sparkles} collapsed={collapsed}>AI provider</NavItem>}{has('article.create') && <NavItem to="/sources" icon={FileArchive} collapsed={collapsed}>Sources &amp; files</NavItem>}
        </NavSection>
        <NavSection title={t('nav.metadata')} open={expanded.metadata} onToggle={() => toggle('metadata')} collapsed={collapsed}>
          <NavItem to="/meta/tags" icon={Tag} collapsed={collapsed}>{t('nav.tags')}</NavItem><NavItem to="/meta/glossary" icon={Compass} collapsed={collapsed}>{t('nav.glossary')}</NavItem>
        </NavSection>
      </nav>

      <div className={`border-t border-border p-3 ${collapsed ? 'md:p-2' : ''}`}><div className={`mb-2 flex items-center gap-2.5 rounded-2xl border border-border bg-gradient-to-br from-surface-elevated to-surface px-3 py-3 shadow-[0_10px_24px_rgb(var(--shadow)/.12)] ${collapsed ? 'md:justify-center md:px-1' : ''}`} title={collapsed ? `${user?.name || 'User'} · ${user?.role || 'Staff'}` : undefined}><div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary-muted to-primary text-[11px] font-extrabold text-primary-foreground">{user?.name?.substring(0, 2).toUpperCase() || 'US'}</div><div className={collapsed ? 'md:hidden' : 'min-w-0'}><div className="truncate text-xs font-bold text-ink">{user?.name || 'User'}</div><div className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium text-stone"><span className="h-1.5 w-1.5 rounded-full bg-success" />{user?.role || 'Staff'}</div></div></div><button onClick={logout} title={collapsed ? t('nav.logOut') : undefined} className={`flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-rose-300 transition hover:bg-rose-400/10 ${collapsed ? 'md:justify-center md:px-2' : ''}`}><LogOut size={14} /><span className={collapsed ? 'md:hidden' : ''}>{t('nav.logOut')}</span></button></div>
    </aside>
  </>
}
