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
  'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500/50'
const variants: Record<LinkButtonVariant, string> = {
  primary: 'bg-yellow-500 text-neutral-950 hover:bg-yellow-400',
  secondary: 'border border-white/20 text-white hover:border-yellow-500/50 hover:bg-white/5',
}

/**
 * Enlace que se ve como botón. Evita repetir clases en Links que actúan como CTA.
 * Usar para navegación que debe parecer botón (ej. "+ Nueva sede", "Editar").
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
