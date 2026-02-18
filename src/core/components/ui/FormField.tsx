import type { ReactNode } from 'react'

/** Clase base para inputs y selects en formularios (dark, focus sutil). */
export const inputClass =
  'w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-white/40 focus:outline-none focus:ring-1 focus:ring-white/20'

export interface FormFieldProps {
  label: string
  id: string
  required?: boolean
  hint?: ReactNode
  children: ReactNode
}

/**
 * Envuelve un control de formulario con label consistente y slot para hint.
 */
export function FormField({
  label,
  id,
  required = false,
  hint,
  children,
}: FormFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="block text-sm font-medium text-zinc-400 mb-1.5"
      >
        {label}
        {required ? <span className="text-red-400"> *</span> : null}
      </label>
      {children}
      {hint != null && hint !== '' ? (
        <p className="mt-1.5 text-sm text-zinc-500">{hint}</p>
      ) : null}
    </div>
  )
}
