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

// Text uses the `-text` on-tint tokens, not the fill hues. A badge is a hue on its own 10%
// tint, which is the pair that fails contrast: measured on real pages, success was 3.04:1,
// info 2.83:1, destructive 3.69:1 and primary 4.22:1 at this 11px size. The tints and
// borders are unchanged, so the colour still carries the same meaning — it is now readable.
const variantStyles: Record<BadgeVariant, string> = {
  default: 'border-border bg-surface-muted text-muted-foreground',
  primary: 'border-primary/25 bg-primary/10 text-primary-text',
  success: 'border-success/25 bg-success/10 text-success-text',
  warning: 'border-warning/25 bg-warning/10 text-warning-text',
  danger: 'border-destructive/25 bg-destructive/10 text-destructive-text',
  info: 'border-info/25 bg-info/10 text-info-text',
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
