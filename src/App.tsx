import React from 'react'
import { RouterProvider, createBrowserRouter } from 'react-router-dom'
import { routes } from './routes/AppRoutes'
import { AuthProvider } from './auth/AuthProvider'
import DialogProvider from './components/ui/DialogProvider'
import { LanguageProvider } from './i18n/LanguageProvider'
import { ThemeProvider } from './theme/ThemeProvider'
import { ToastProvider } from './components/ui/Toast'

// A data router rather than <BrowserRouter>, because useBlocker — the only way to stop an
// in-app navigation away from unsaved editor work — reads DataRouterContext, which only
// RouterProvider supplies. Created at module scope: createBrowserRouter owns the history
// and the navigation state, so rebuilding it on a render would discard both.
const router = createBrowserRouter(routes)

function App() {
  return (
    <ThemeProvider>
      <LanguageProvider><AuthProvider><ToastProvider><DialogProvider><RouterProvider router={router} /></DialogProvider></ToastProvider></AuthProvider></LanguageProvider>
    </ThemeProvider>
  )
}

export default App
