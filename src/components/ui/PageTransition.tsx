import React from 'react'

interface PageTransitionProps {
  children: React.ReactNode
  className?: string
}

/**
 * Lightweight page-level entrance animation. Wraps page content with a fade+slide
 * that plays once on mount. Uses CSS animation utilities — no JS runtime cost.
 */
export function PageTransition({ children, className = '' }: PageTransitionProps) {
  return (
    <div className={`animate-in fade-in slide-in-from-bottom duration-300 ${className}`}>
      {children}
    </div>
  )
}
