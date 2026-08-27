import React, { useCallback, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { SkipLink } from '../components/ui/SkipLink'

export default function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), [])
  return (
    <div className="workspace-atmosphere relative flex h-screen overflow-hidden bg-canvas text-ink">
      <SkipLink />
      <Sidebar mobileOpen={mobileNavOpen} onClose={closeMobileNav} />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <div className="ops-shell-glow pointer-events-none absolute inset-x-0 top-0 h-64" />
        <div className="pointer-events-none absolute -right-28 top-24 hidden h-80 w-80 opacity-20 xl:block"><div className="hero-orb h-full w-full"><div className="orbit-ring" /><div className="orbit-ring" style={{ inset: '10%', animationDuration: '23s' }} /><div className="orb-core text-xl">Q</div></div></div>
        <Header onMenuClick={() => setMobileNavOpen(true)} />
        <main id="main-content" className="app-scroll relative min-h-0 min-w-0 flex-1 overflow-y-auto bg-canvas p-2 sm:p-3 lg:p-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
