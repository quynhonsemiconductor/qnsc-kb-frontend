import React, { useCallback, useRef, useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import Header from './Header'
import { SkipLink } from '../components/ui/SkipLink'
import { useRouteScroll } from '../hooks/useRouteScroll'

export default function AppLayout() {
  const [navigationOpen, setNavigationOpen] = useState(false)
  const mainRef = useRef<HTMLElement>(null)
  const closeNavigation = useCallback(() => setNavigationOpen(false), [])
  useRouteScroll(mainRef)

  return (
    <div className="flex h-dvh min-w-0 flex-col overflow-hidden bg-canvas text-ink">
      <SkipLink />
      <Header onMenuClick={() => setNavigationOpen(true)} />
      <Sidebar mobileOpen={navigationOpen} onClose={closeNavigation} />
      <main ref={mainRef} id="main-content" tabIndex={-1} className="app-scroll relative min-h-0 min-w-0 flex-1 overflow-y-auto bg-canvas px-3 py-4 pb-20 outline-none sm:px-5 lg:px-7 lg:pb-5">
        <Outlet />
      </main>
    </div>
  )
}
