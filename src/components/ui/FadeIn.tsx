import React, { useEffect, useRef, useState } from 'react'

interface FadeInProps {
  children: React.ReactNode
  className?: string
  delay?: number
  duration?: number
  direction?: 'up' | 'down' | 'left' | 'right' | 'none'
}

export function FadeIn({ children, className = '', delay = 0, duration = 300, direction = 'up' }: FadeInProps) {
  const [isVisible, setIsVisible] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setTimeout(() => setIsVisible(true), delay)
          observer.disconnect()
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    )

    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [delay])

  const directionStyles = {
    up: 'translate-y-2',
    down: '-translate-y-2',
    left: 'translate-x-2',
    right: '-translate-x-2',
    none: '',
  }

  // Respect prefers-reduced-motion
  const motionSafe = typeof window !== 'undefined'
    ? !window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : true

  return (
    <div
      ref={ref}
      className={`${motionSafe ? `transition-all ease-out ${isVisible ? 'opacity-100 translate-x-0 translate-y-0' : `opacity-0 ${directionStyles[direction]}`}` : ''} ${className}`}
      style={{ transitionDuration: motionSafe ? `${duration}ms` : '0ms' }}
    >
      {children}
    </div>
  )
}

export function StaggerChildren({ children, className = '', staggerMs = 75 }: { children: React.ReactNode; className?: string; staggerMs?: number }) {
  return (
    <div className={className}>
      {React.Children.map(children, (child, index) => (
        <FadeIn delay={index * staggerMs} direction="up">
          {child}
        </FadeIn>
      ))}
    </div>
  )
}
