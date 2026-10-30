import React, { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  Activity, AlertTriangle, BookOpen, Bookmark, Bot, ClipboardList, Compass,
  FileText, FolderTree, KeyRound, LogOut, Search, UserCog,
  Settings2, Tag, Users, Shield, Sparkles, X, Building2, Home, Globe, Monitor, ThumbsDown,
  type LucideIcon,
} from 'lucide-react'
import { BrandMarkGlyph } from '../components/ui/BrandMark'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Select'
import { useAuth } from '../auth/useAuth'
import { useLanguage } from '../i18n/LanguageProvider'
import { usePermission } from '../hooks/usePermission'
import { useTheme, type ThemePreference } from '../theme/ThemeProvider'
import { ChangePasswordModal } from '../auth/ChangePasswordModal'
import { useBodyScrollLock } from '../hooks/useBodyScrollLock'
import { FocusTrap } from '../components/ui/FocusTrap'

type IconType = LucideIcon

function DrawerLink({ to, icon: Icon, children }: { to: string; icon: IconType; children: React.ReactNode }) {
  return <NavLink to={to} className={({ isActive }) => `flex min-h-9 items-center gap-2.5 rounded-lg px-3 text-body-sm font-semibold no-underline transition hover:no-underline ${isActive ? 'bg-primary/10 text-primary-text' : 'text-muted-foreground hover:bg-surface-soft hover:text-foreground'}`}><Icon size={15} className="shrink-0" /><span className="min-w-0 break-words">{children}</span></NavLink>
}

function DrawerSection({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="space-y-1"><h2 className="px-3 pb-1 pt-3 font-mono text-caption font-medium uppercase tracking-[.12em] text-muted">{title}</h2>{children}</section>
}

export default function Sidebar({ mobileOpen, onClose }: { mobileOpen: boolean; onClose: () => void }) {
  const { logout, user } = useAuth()
  const location = useLocation()
  const { language, setLanguage, t } = useLanguage()
  const { has } = usePermission()
  const { theme, setTheme } = useTheme()
  const [passwordOpen, setPasswordOpen] = useState(false)

  useEffect(() => { onClose() }, [location.pathname, onClose])
  useBodyScrollLock(mobileOpen)
  useEffect(() => {
    if (!mobileOpen) return
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [mobileOpen, onClose])

  return <>
    {mobileOpen && <button type="button" aria-label="Close navigation" onClick={onClose} className="fixed inset-0 z-overlay bg-scrim/35 backdrop-blur-[2px]" />}
    <FocusTrap active={mobileOpen} className="contents">
    <aside inert={!mobileOpen} aria-hidden={!mobileOpen} role="dialog" aria-modal={mobileOpen ? 'true' : undefined} aria-label="All navigation" className={`fixed inset-y-0 right-0 z-modal flex w-[min(92vw,22rem)] flex-col border-l border-border bg-surface shadow-modal transition-transform duration-base ease-standard ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}`}>
      <header className="flex min-h-[3.875rem] items-center gap-3 border-b border-border px-4">
        <BrandMarkGlyph className="h-8 w-8" title="QNSC" />
        <div className="min-w-0"><p className="font-display text-body font-bold text-foreground">All navigation</p><p className="text-caption text-muted">Knowledge, governance and administration</p></div>
        <Button type="button" variant="ghost" size="sm" onClick={onClose} aria-label="Close navigation" icon={<X size={17} />} className="ml-auto" />
      </header>

      <nav aria-label={t('nav.mainLandmark')} className="app-scroll min-h-0 flex-1 space-y-3 overflow-y-auto px-3 py-3">
        <DrawerSection title={t('nav.knowledge')}>
          <DrawerLink to="/home" icon={Home}>{t('nav.home')}</DrawerLink>
          <DrawerLink to="/articles" icon={BookOpen}>{t('nav.articles')}</DrawerLink>
          <DrawerLink to="/search" icon={Search}>{t('nav.search')}</DrawerLink>
          <DrawerLink to="/ai" icon={Bot}>{t('nav.aiAssistant')}</DrawerLink>
          <DrawerLink to="/bookmarks" icon={Bookmark}>{t('nav.saved')}</DrawerLink>
        </DrawerSection>

        {has('governance.read') && <DrawerSection title={t('nav.governance')}>
          <DrawerLink to="/governance/pending-drafts" icon={FileText}>{t('nav.pendingDrafts')}</DrawerLink>
          <DrawerLink to="/governance/gap-queue" icon={AlertTriangle}>{t('nav.gapQueue')}</DrawerLink>
          <DrawerLink to="/governance/health" icon={Activity}>{t('nav.healthDashboard')}</DrawerLink>
          <DrawerLink to="/governance/coverage" icon={ClipboardList}>Coverage</DrawerLink>
          <DrawerLink to="/governance/feedback" icon={ThumbsDown}>{t('nav.feedbackReview')}</DrawerLink>
          {has('article.publish') && <DrawerLink to="/governance/approval-rules" icon={Bot}>{t('nav.approvalRules')}</DrawerLink>}
          {has('role.manage') && <DrawerLink to="/governance/audit-log" icon={ClipboardList}>{t('nav.auditLogs')}</DrawerLink>}
        </DrawerSection>}

        <DrawerSection title={t('nav.metadata')}>
          <DrawerLink to="/meta/tags" icon={Tag}>{t('nav.tags')}</DrawerLink>
          <DrawerLink to="/meta/glossary" icon={Compass}>{t('nav.glossary')}</DrawerLink>
        </DrawerSection>

        {(has('user.manage') || has('role.manage') || has('connector.manage')) && <DrawerSection title={t('nav.administration')}>
          {has('user.manage') && <DrawerLink to="/admin/users" icon={Users}>{t('nav.usersRoles')}</DrawerLink>}
          {has('user.manage') && <DrawerLink to="/admin/departments" icon={Building2}>{t('nav.departments')}</DrawerLink>}
          {has('role.manage') && <DrawerLink to="/admin/roles" icon={Shield}>{t('nav.rolesPermissions')}</DrawerLink>}
          {has('connector.manage') && <DrawerLink to="/admin/connectors" icon={FolderTree}>{t('nav.sourceConnectors')}</DrawerLink>}
          {has('role.manage') && <DrawerLink to="/admin/features" icon={Settings2}>{t('nav.featureControls')}</DrawerLink>}
          {has('role.manage') && <DrawerLink to="/admin/llm" icon={Sparkles}>{t('nav.aiProvider')}</DrawerLink>}
          {has('role.manage') && <DrawerLink to="/admin/mcp-config" icon={Bot}>{t('nav.mcpConfig')}</DrawerLink>}
        </DrawerSection>}
      </nav>

      <footer className="border-t border-border p-3">
        <div className="mb-2 grid grid-cols-2 gap-2 lg:hidden">
          <label className="min-w-0 rounded-lg border border-border bg-surface px-2 py-1.5">
            <span className="mb-1 flex items-center gap-1.5 text-caption font-semibold text-muted"><Globe size={12} />{t('language.switch')}</span>
            <Select value={language} onChange={event => setLanguage(event.target.value as 'en' | 'vi')} size="sm" className="w-full min-w-0 border-0 bg-transparent px-0 text-body-sm font-semibold text-foreground" aria-label={t('language.switch')}><option value="en">English</option><option value="vi">Tiếng Việt</option></Select>
          </label>
          <label className="min-w-0 rounded-lg border border-border bg-surface px-2 py-1.5">
            <span className="mb-1 flex items-center gap-1.5 text-caption font-semibold text-muted"><Monitor size={12} />Appearance</span>
            <Select value={theme} onChange={event => setTheme(event.target.value as ThemePreference)} size="sm" className="w-full min-w-0 border-0 bg-transparent px-0 text-body-sm font-semibold text-foreground" aria-label="Appearance"><option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option></Select>
          </label>
        </div>
        <NavLink to="/account" className="mb-2 flex items-center gap-2.5 rounded-xl bg-surface-muted px-3 py-3 no-underline transition hover:bg-surface-soft hover:no-underline" aria-label={t('account.open')}>
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary text-caption font-bold text-primary-foreground">{user?.name?.substring(0, 2).toUpperCase() || 'US'}</div>
          <div className="min-w-0 flex-1"><p className="truncate text-body-sm font-bold text-foreground">{user?.name || 'User'}</p><p className="truncate text-caption text-muted">{user?.role || 'Staff'}</p></div>
          <UserCog size={15} className="shrink-0 text-muted-foreground" />
        </NavLink>
        <div className="grid grid-cols-2 gap-2">
          <Button onClick={() => { onClose(); setPasswordOpen(true) }} variant="secondary" size="sm" icon={<KeyRound size={14} />}>{t('auth.changePassword')}</Button>
          <Button onClick={logout} variant="ghost" size="sm" icon={<LogOut size={14} />} className="text-destructive-text">{t('nav.logOut')}</Button>
        </div>
      </footer>
    </aside>
    </FocusTrap>
    <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
  </>
}
