import React from 'react'

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
}

const positionClasses = {
  top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
  bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
  left: 'right-full top-1/2 -translate-y-1/2 mr-2',
  right: 'left-full top-1/2 -translate-y-1/2 ml-2',
}

// The tooltip is an INVERTED chip: it paints `--foreground` and must therefore write in
// `--background`. It used to write in `text-primary-foreground`, which index.css rewrites
// to `--foreground` with `!important` inside `@layer utilities` — unscoped, so in BOTH
// themes. Background and text resolved to the identical colour and the tooltip rendered
// as a solid block with invisible text: a dark box in light mode, the white box people
// reported in dark mode.
//
// `text-background` is the inverse of `bg-foreground` by construction and is not in that
// override list, so it stays correct in both themes.
export function Tooltip({ content, children, position = 'top' }: TooltipProps) {
  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={`pointer-events-none absolute z-[90] w-max max-w-56 rounded-control bg-foreground px-sm py-xxs text-caption font-medium text-background shadow-lg opacity-0 transition-all duration-200 scale-95 group-hover:opacity-100 group-hover:scale-100 group-focus-within:opacity-100 group-focus-within:scale-100 ${positionClasses[position]}`}
      >
        {content}
      </span>
    </span>
  )
}
