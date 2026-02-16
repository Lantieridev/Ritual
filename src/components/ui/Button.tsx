'use client'

import type { ButtonHTMLAttributes, ReactNode } from 'react'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: ButtonVariant
  className?: string
}

/**
 * Botón reutilizable con variantes.
 * primary: CTA principal (amarillo). secondary: borde. ghost: sin fondo.
 */
export function Button({
  children,
  variant = 'primary',
  className = '',
  ...props
}: ButtonProps) {
  const base = 'inline-flex items-center justify-center rounded-lg font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500/50 disabled:opacity-50'
  const variants: Record<ButtonVariant, string> = {
    primary: 'bg-yellow-500 text-neutral-950 hover:bg-yellow-400',
    secondary: 'border border-white/20 text-white hover:border-yellow-500/50 hover:bg-white/5',
    ghost: 'text-yellow-500 hover:bg-white/5',
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
