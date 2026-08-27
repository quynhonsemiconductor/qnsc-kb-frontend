import React, { forwardRef, useId } from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  hint?: string
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, hint, leftIcon, rightIcon, className = '', id: propId, ...props }, ref) => {
    const generatedId = useId()
    const id = propId || generatedId
    const errorId = `${id}-error`
    const hintId = `${id}-hint`

    return (
      <div className="space-y-1.5">
        {label && (
          <label htmlFor={id} className="block text-body font-medium text-foreground">
            {label}
          </label>
        )}
        <div className="relative">
          {leftIcon && (
            <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true">
              {leftIcon}
            </span>
          )}
          <input
            ref={ref}
            id={id}
            className={`ui-control ui-control-md w-full transition-all duration-200 focus:ring-2 focus:ring-primary/30 focus:border-primary ${leftIcon ? 'pl-10' : ''} ${rightIcon ? 'pr-10' : ''} ${error ? 'border-destructive focus:ring-destructive/30 focus:border-destructive' : ''} ${className}`}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? errorId : hint ? hintId : undefined}
            {...props}
          />
          {rightIcon && (
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true">
              {rightIcon}
            </span>
          )}
        </div>
        {error && (
          <p id={errorId} role="alert" className="text-body-sm text-destructive animate-in fade-in slide-in-from-top duration-200">
            {error}
          </p>
        )}
        {!error && hint && (
          <p id={hintId} className="text-body-sm text-muted-foreground">
            {hint}
          </p>
        )}
      </div>
    )
  }
)

Input.displayName = 'Input'
