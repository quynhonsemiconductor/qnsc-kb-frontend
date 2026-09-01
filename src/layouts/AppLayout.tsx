import React, { useCallback, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { SkipLink } from '../components/ui/SkipLink'

export default function AppLayout() {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), [])
  return (
    /* `workspace-atmosphere` (two radial gradient washes) dropped with the orb below it:
       both sat behind every authenticated route, and a knowledge workspace is read for
       hours at a time. */
    <div className="relative flex h-screen overflow-hidden bg-canvas text-ink">
      <SkipLink />
      <Sidebar mobileOpen={mobileNavOpen} onClose={closeMobileNav} />
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <Header onMenuClick={() => setMobileNavOpen(true)} />
        <main id="main-content" className="app-scroll relative min-h-0 min-w-0 flex-1 overflow-y-auto bg-canvas p-2 sm:p-3 lg:p-4">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
