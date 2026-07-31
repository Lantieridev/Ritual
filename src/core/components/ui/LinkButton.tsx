import Link from 'next/link'
import type { ReactNode } from 'react'

type LinkButtonVariant = 'primary' | 'secondary'

interface LinkButtonProps {
  href: string
  children: ReactNode
  variant?: LinkButtonVariant
  className?: string
}

const base =
  'inline-flex items-center justify-center font-label text-[10px] tracking-[0.14em] uppercase transition-colors focus:outline-none focus:ring-2 focus:ring-ritual-red/40'
const variants: Record<LinkButtonVariant, string> = {
  primary: 'bg-ritual-red text-ritual-panel hover:bg-ritual-red-hover',
  secondary: 'border border-ritual-border text-ritual-bone hover:border-ritual-border-2 hover:bg-ritual-surface',
}

/**
 * Enlace que se ve como botón. Evita repetir clases en Links que actúan como CTA.
 */
export function LinkButton({
  href,
  children,
  variant = 'primary',
  className = '',
}: LinkButtonProps) {
  return (
    <Link href={href} className={`${base} ${variants[variant]} ${className}`}>
      {children}
    </Link>
  )
}
