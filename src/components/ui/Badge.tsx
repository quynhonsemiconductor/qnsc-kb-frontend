import React from 'react'

type BadgeVariant = 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
type BadgeSize = 'sm' | 'md'

interface BadgeProps {
  children: React.ReactNode
  variant?: BadgeVariant
  size?: BadgeSize
  dot?: boolean
  className?: string
}

const variantStyles: Record<BadgeVariant, string> = {
  default: 'border-border bg-surface-muted text-muted-foreground',
  primary: 'border-primary/20 bg-primary/10 text-primary',
  success: 'border-success/20 bg-success/10 text-success',
  warning: 'border-warning/20 bg-warning/10 text-warning',
  danger: 'border-destructive/20 bg-destructive/10 text-destructive',
  info: 'border-info/20 bg-info/10 text-info',
}

const dotColors: Record<BadgeVariant, string> = {
  default: 'bg-muted-foreground',
  primary: 'bg-primary',
  success: 'bg-success',
  warning: 'bg-warning',
  danger: 'bg-destructive',
  info: 'bg-info',
}

const sizeStyles: Record<BadgeSize, string> = {
  sm: 'px-1.5 py-0.5 text-caption',
  md: 'px-2.5 py-1 text-body-sm',
}

export function Badge({ children, variant = 'default', size = 'sm', dot = false, className = '' }: BadgeProps) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}>
      {dot && <span className={`h-1.5 w-1.5 rounded-full ${dotColors[variant]}`} />}
      {children}
    </span>
  )
}
