import React from 'react'
import { BrowserRouter } from 'react-router-dom'
import AppRoutes from './routes/AppRoutes'
import { AuthProvider } from './auth/AuthProvider'
import DialogProvider from './components/ui/DialogProvider'
import { LanguageProvider } from './i18n/LanguageProvider'
import { ThemeProvider } from './theme/ThemeProvider'
import { ToastProvider } from './components/ui/Toast'

function App() {
  return (
    <ThemeProvider><BrowserRouter>
      <LanguageProvider><AuthProvider><ToastProvider><DialogProvider><AppRoutes /></DialogProvider></ToastProvider></AuthProvider></LanguageProvider>
    </BrowserRouter></ThemeProvider>
  )
}

export default App
