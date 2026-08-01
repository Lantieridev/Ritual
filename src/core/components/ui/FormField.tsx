import type { ReactNode } from 'react'

/** Clase base para inputs y selects en formularios (dark, focus sutil). */
export const inputClass =
  'w-full border border-ritual-border bg-ritual-surface px-4 py-2.5 font-body text-ritual-bone placeholder-ritual-gray-mid focus:border-ritual-red focus:outline-none focus:ring-1 focus:ring-ritual-red/40'

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
        className="block font-label text-[10px] tracking-[0.1em] uppercase text-ritual-gray-text mb-1.5"
      >
        {label}
        {required ? <span className="text-ritual-red-hover"> *</span> : null}
      </label>
      {children}
      {hint != null && hint !== '' ? (
        <p className="mt-1.5 font-body text-sm text-ritual-gray-text">{hint}</p>
      ) : null}
    </div>
  )
}
