import React, { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'

type Option = { value: string; label: React.ReactNode; disabled?: boolean }
type SelectProps = {
  children: React.ReactNode
  value?: string | number | readonly string[]
  defaultValue?: string | number | readonly string[]
  onChange?: React.ChangeEventHandler<HTMLSelectElement>
  className?: string
  disabled?: boolean
  id?: string
  'aria-label'?: string
  'aria-labelledby'?: string
  size?: 'sm' | 'md' | 'lg'
}

function getOptions(children: React.ReactNode): Option[] {
  return React.Children.toArray(children).flatMap((child): Option[] => {
    if (!React.isValidElement<{ value?: string | number; disabled?: boolean; children?: React.ReactNode }>(child) || child.type !== 'option') return []
    return [{ value: String(child.props.value ?? ''), label: child.props.children, disabled: child.props.disabled }]
  })
}

export function Select({ children, value, defaultValue, onChange, disabled = false, className = '', size = 'md', id, 'aria-label': ariaLabel, 'aria-labelledby': ariaLabelledBy }: SelectProps) {
  const options = useMemo(() => getOptions(children), [children])
  const generatedId = useId()
  const listboxId = id || generatedId
  const selectedValue = String(value ?? defaultValue ?? options.find(option => !option.disabled)?.value ?? '')
  const selectedIndex = Math.max(0, options.findIndex(option => option.value === selectedValue))
  const selected = options[selectedIndex]
  const [open, setOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(selectedIndex)
  const root = useRef<HTMLDivElement>(null)
  const listbox = useRef<HTMLDivElement>(null)
  const typeAhead = useRef('')
  const resetTypeAhead = useRef<number>()
  const [position, setPosition] = useState({ top: 0, left: 0, width: 0, maxHeight: 240 })

  useEffect(() => setActiveIndex(selectedIndex), [selectedIndex])
  useEffect(() => {
    const closeOnOutside = (event: MouseEvent) => {
      const target = event.target as Node
      if (root.current?.contains(target) || listbox.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', closeOnOutside)
    return () => document.removeEventListener('mousedown', closeOnOutside)
  }, [])
  useEffect(() => () => window.clearTimeout(resetTypeAhead.current), [])

  useEffect(() => {
    if (!open) return
    const updatePosition = () => {
      const anchor = root.current?.querySelector('button')
      if (!anchor) return
      const rect = anchor.getBoundingClientRect()
      const gap = 4
      const viewportPadding = 8
      const roomBelow = window.innerHeight - rect.bottom - gap - viewportPadding
      const roomAbove = rect.top - gap - viewportPadding
      const openAbove = roomBelow < 180 && roomAbove > roomBelow
      const maxHeight = Math.max(96, Math.min(320, openAbove ? roomAbove : roomBelow))
      setPosition({
        top: openAbove ? Math.max(viewportPadding, rect.top - gap - maxHeight) : rect.bottom + gap,
        left: Math.min(Math.max(viewportPadding, rect.left), Math.max(viewportPadding, window.innerWidth - rect.width - viewportPadding)),
        width: rect.width,
        maxHeight,
      })
    }
    updatePosition()
    window.addEventListener('resize', updatePosition)
    window.addEventListener('scroll', updatePosition, true)
    return () => {
      window.removeEventListener('resize', updatePosition)
      window.removeEventListener('scroll', updatePosition, true)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', closeOnEscape)
    return () => document.removeEventListener('keydown', closeOnEscape)
  }, [open])

  const emit = (next: string) => {
    if (next === selectedValue) return
    onChange?.({ target: { value: next }, currentTarget: { value: next } } as React.ChangeEvent<HTMLSelectElement>)
  }
  const move = (delta: number) => {
    if (!options.length) return activeIndex
    let next = activeIndex
    for (let attempts = 0; attempts < options.length; attempts += 1) {
      next = (next + delta + options.length) % options.length
      if (!options[next]?.disabled) { setActiveIndex(next); return next }
    }
    return activeIndex
  }
  const handleKeyDown = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return
    if (event.key === 'ArrowDown') { event.preventDefault(); if (!open) setOpen(true); move(1); return }
    if (event.key === 'ArrowUp') { event.preventDefault(); if (!open) setOpen(true); move(-1); return }
    if (event.key === 'Home') { event.preventDefault(); const next = options.findIndex(option => !option.disabled); setActiveIndex(Math.max(0, next)); return }
    if (event.key === 'End') { event.preventDefault(); const next = options.map(option => !option.disabled).lastIndexOf(true); setActiveIndex(Math.max(0, next)); return }
    if (event.key === 'Escape') { setOpen(false); return }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (open) { const option = options[activeIndex]; if (option && !option.disabled) emit(option.value); setOpen(false) } else setOpen(true)
      return
    }
    if (event.key.length === 1) {
      typeAhead.current += event.key.toLocaleLowerCase()
      window.clearTimeout(resetTypeAhead.current)
      resetTypeAhead.current = window.setTimeout(() => { typeAhead.current = '' }, 550)
      const next = options.findIndex(option => !option.disabled && String(option.label).toLocaleLowerCase().startsWith(typeAhead.current))
      if (next >= 0) { setActiveIndex(next); if (!open) emit(options[next].value) }
    }
  }
  const selectClass = `ui-control ui-control-${size} flex items-center justify-between gap-xs text-left ${className}`
  return <div ref={root} className="relative">
    <button type="button" id={id} role="combobox" aria-controls={`${listboxId}-listbox`} aria-expanded={open} aria-haspopup="listbox" aria-label={ariaLabel} aria-labelledby={ariaLabelledBy} disabled={disabled} onClick={() => setOpen(current => !current)} onKeyDown={handleKeyDown} className={selectClass}>
      <span className="min-w-0 flex-1 truncate">{selected?.label}</span><ChevronDown size={16} aria-hidden="true" className={`shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
    {open && typeof document !== 'undefined' && createPortal(
      <div
        ref={listbox}
        id={`${listboxId}-listbox`}
        role="listbox"
        aria-labelledby={id}
        className="fixed z-[1000] overflow-y-auto rounded-surface border border-border bg-surface-elevated p-xxs shadow-[0_16px_35px_rgb(var(--shadow)/.25)]"
        style={{ top: position.top, left: position.left, width: position.width, maxHeight: position.maxHeight }}
      >
        {options.map((option, index) => <button key={option.value} type="button" role="option" aria-selected={option.value === selectedValue} disabled={option.disabled} onMouseEnter={() => setActiveIndex(index)} onClick={() => { emit(option.value); setOpen(false) }} className={`flex w-full min-h-controlSm items-center gap-xs rounded-control px-sm text-left text-body-sm transition ${index === activeIndex ? 'bg-surface-muted text-foreground' : 'text-foreground hover:bg-surface-muted'} disabled:cursor-not-allowed disabled:opacity-50`}><span className="min-w-0 flex-1 truncate">{option.label}</span>{option.value === selectedValue && <Check size={14} className="shrink-0 text-primary" />}</button>)}
      </div>,
      document.body,
    )}
  </div>
}
