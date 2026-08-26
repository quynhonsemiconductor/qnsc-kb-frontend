import React from 'react'

interface SkeletonProps {
  className?: string
  variant?: 'text' | 'circular' | 'rectangular'
  width?: string
  height?: string
  count?: number
}

export function Skeleton({ className = '', variant = 'text', width, height, count = 1 }: SkeletonProps) {
  const baseClasses = 'animate-pulse bg-muted/60 rounded'
  const variantClasses = {
    text: 'h-4 rounded',
    circular: 'rounded-full',
    rectangular: 'rounded-surface',
  }

  const style: React.CSSProperties = {}
  if (width) style.width = width
  if (height) style.height = height

  if (count > 1) {
    return (
      <div className={`space-y-3 ${className}`}>
        {Array.from({ length: count }, (_, i) => (
          <div
            key={i}
            className={`${baseClasses} ${variantClasses[variant]}`}
            style={{ ...style, width: i === count - 1 ? '75%' : width }}
          />
        ))}
      </div>
    )
  }

  return (
    <div
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
      style={style}
    />
  )
}

export function PageSkeleton() {
  return (
    <div className="page-shell-wide page-stack animate-in fade-in duration-300">
      <div className="rounded-panel border border-border bg-card p-6">
        <Skeleton variant="text" width="40%" height="2rem" className="mb-4" />
        <Skeleton variant="text" count={3} height="1rem" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-5">
            <Skeleton variant="text" width="60%" height="0.75rem" className="mb-3" />
            <Skeleton variant="text" width="40%" height="2rem" className="mb-2" />
            <Skeleton variant="text" width="80%" height="0.75rem" />
          </div>
        ))}
      </div>
    </div>
  )
}
