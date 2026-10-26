import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { KeyRound, LogOut, UserCog } from 'lucide-react'
import { useAuth } from '../../auth/useAuth'
import { ChangePasswordModal } from '../../auth/ChangePasswordModal'
import { useLanguage } from '../../i18n/LanguageProvider'
import { FloatingPanel } from '../ui/FloatingPanel'
import { initials } from '../../lib/account'

/**
 * Who is signed in, and the way out. The header had no sign-out at all on a desktop
 * viewport: the only one lived in the mobile drawer.
 */
export default function UserMenu() {
  const { user, logout } = useAuth()
  const { t } = useLanguage()
  const [open, setOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const anchor = useRef<HTMLButtonElement>(null)

  const item = 'flex min-h-10 w-full items-center gap-2.5 rounded-lg px-2.5 text-left text-body-sm font-semibold text-foreground no-underline transition hover:bg-surface-muted hover:no-underline'

  return <>
    <button
      ref={anchor}
      type="button"
      onClick={() => setOpen(value => !value)}
      aria-label={t('account.menu')}
      aria-haspopup="menu"
      aria-expanded={open}
      className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-caption font-bold text-primary-foreground transition hover:bg-primary-strong focus-visible:ring-2 focus-visible:ring-ring/40"
    >
      {initials(user?.name)}
    </button>
    <FloatingPanel anchorRef={anchor} open={open} onClose={() => setOpen(false)} widthRem={17} className="rounded-xl p-0">
      <div className="border-b border-border px-4 py-3">
        <p className="truncate text-body font-bold text-foreground">{user?.name || t('account.unnamed')}</p>
        <p className="truncate text-caption text-muted-foreground">{user?.email}</p>
        {user?.role && <p className="mt-1 text-caption font-semibold text-primary-text">{user.role}</p>}
      </div>
      <div className="p-1.5" role="menu">
        <Link to="/account" role="menuitem" onClick={() => setOpen(false)} className={item}><UserCog size={15} className="text-muted-foreground" />{t('account.open')}</Link>
        <button type="button" role="menuitem" onClick={() => { setOpen(false); setPasswordOpen(true) }} className={item}><KeyRound size={15} className="text-muted-foreground" />{t('auth.changePassword')}</button>
        <button type="button" role="menuitem" onClick={() => { setOpen(false); void logout() }} className={`${item} text-destructive-text`}><LogOut size={15} />{t('nav.logOut')}</button>
      </div>
    </FloatingPanel>
    <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />
  </>
}
