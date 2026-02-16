import type { ReactNode } from 'react'

/**
 * Contenedor reutilizable tipo tarjeta.
 * Usado para eventos, detalle y futuros bloques (feed, gastos).
 * Mobile-first; bordes y hover pensados para dark mode.
 */
interface CardProps {
  children: ReactNode
  className?: string
  /** Si true, la tarjeta es clickeable (navegación). Mejora accesibilidad. */
  asChild?: boolean
}

export function Card({ children, className = '' }: CardProps) {
  return (
    <div
      className={`border border-white/10 bg-white/5 rounded-xl p-6 transition-all hover:border-yellow-500/50 ${className}`}
    >
      {children}
    </div>
  )
}
