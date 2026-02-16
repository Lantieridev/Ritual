import type { ReactNode } from 'react'

/** Clase base para inputs y selects en formularios (dark, focus amarillo). */
export const inputClass =
  'w-full rounded-lg border border-white/20 bg-white/5 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-yellow-500/50 focus:outline-none focus:ring-1 focus:ring-yellow-500/50'

export interface FormFieldProps {
  /** Texto del label; se asocia al id del control. */
  label: string
  /** id del input/select (y htmlFor del label). */
  id: string
  /** Si true, muestra asterisco rojo de obligatorio. */
  required?: boolean
  /** Texto o nodo debajo del control (ej. "No hay sedes cargadas"). */
  hint?: ReactNode
  children: ReactNode
}

/**
 * Envuelve un control de formulario con label consistente y slot para hint.
 * Reduce duplicación y centraliza estilos de labels en todos los forms.
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
