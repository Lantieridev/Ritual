import type { ReactNode } from 'react'

/**
 * Contenedor reutilizable tipo tarjeta.
 * Usado para eventos, detalle y futuros bloques (feed, gastos).
 * Mobile-first; bordes y hover pensados para dark mode.
 */
interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`border border-ritual-border bg-ritual-surface p-6 transition-all hover:border-ritual-border-2 ${className}`}
    >
      {children}
    </div>
  )
}
