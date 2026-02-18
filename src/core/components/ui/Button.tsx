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
  const base = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-white/30 disabled:opacity-50'
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-white text-neutral-950 hover:bg-zinc-200',
    secondary: 'border border-zinc-500/50 text-white hover:border-zinc-400/50 hover:bg-white/5',
    ghost: 'text-zinc-300 hover:bg-white/5',
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
