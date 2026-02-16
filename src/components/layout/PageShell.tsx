import type { ReactNode } from 'react'
import Link from 'next/link'

export interface PageShellProps {
  /** Enlace de vuelta (ej. "/" o "/events/123") */
  backHref: string
  /** Texto del enlace (ej. "← Inicio", "← Volver al recital") */
  backLabel: string
  /** Título de la página (h1) */
  title: string
  /** Descripción opcional debajo del título */
  description?: string
  /** Acción principal en la cabecera (ej. botón "+ Nuevo artista"). Se alinea a la derecha en desktop. */
  action?: ReactNode
  children: ReactNode
}

const MAIN_CLASS =
  'min-h-screen bg-neutral-950 text-white p-6 md:p-8 font-sans'
const TITLE_CLASS = 'text-4xl font-bold text-yellow-500 tracking-tighter'

/**
 * Envuelve el contenido de una página con layout consistente: main, enlace de vuelta,
 * título, descripción opcional y slot para acción (CTA). Escalable para añadir más slots (breadcrumb, etc.).
 */
export function PageShell({
  backHref,
  backLabel,
  title,
  description,
  action,
  children,
}: PageShellProps) {
  return (
    <main className={MAIN_CLASS}>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        {backLabel ? (
          <Link
            href={backHref}
            className="inline-flex items-center gap-2 text-zinc-400 hover:text-yellow-500 transition-colors"
          >
            {backLabel}
          </Link>
        ) : (
          <span aria-hidden />
        )}
        {action != null ? <div className="flex items-center">{action}</div> : null}
      </div>

      <h1 className={description ? `${TITLE_CLASS} mb-2` : `${TITLE_CLASS} mb-8`}>
        {title}
      </h1>
      {description != null && description !== '' ? (
        <p className="text-zinc-400 mb-8">{description}</p>
      ) : null}

      {children}
    </main>
  )
}
