'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: ButtonVariant
  className?: string
}

/**
 * Botón reutilizable con variantes. Paleta minimalista: blanco, negro, grises.
 * primary: CTA principal. secondary: borde. ghost: sin fondo.
 */
export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center font-label text-[10px] tracking-[0.14em] uppercase transition-colors focus:outline-none focus:ring-2 focus:ring-ritual-red/40 disabled:opacity-50'
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-ritual-red text-ritual-bone hover:bg-ritual-red-hover',
    secondary: 'border border-ritual-border text-ritual-bone hover:border-ritual-border-2 hover:bg-ritual-surface',
    ghost: 'text-ritual-gray-text hover:bg-ritual-surface',
  }
  return (
    <button
      type={props.type ?? 'button'}
      className={`${base} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  )
}
