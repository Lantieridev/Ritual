import type { ReactNode } from 'react'
import Link from 'next/link'

export interface PageShellProps {
  backHref?: string
  backLabel?: string
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}

const TITLE_CLASS = 'text-4xl font-bold text-white tracking-tighter'

/**
 * Wrapper de página: maneja márgenes, ancho máximo y estructura de título.
 * La navegación (Navbar/Footer) queda delegada al layout.tsx global.
 * El pt-20 compensa la altura del Navbar sticky (h-16).
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
    <main className="min-h-screen bg-neutral-950 text-white pt-20 pb-16">
      <div className="max-w-7xl mx-auto px-6 md:px-8">
        {backHref ? (
          <Link
            href={backHref}
            className="inline-block text-sm text-zinc-500 hover:text-zinc-300 transition-colors pt-8"
          >
            {backLabel ?? '← Volver'}
          </Link>
        ) : null}

        <div className={`flex flex-wrap items-start justify-between gap-4 mb-8 ${backHref ? 'pt-4' : 'pt-8'}`}>
          <div>
            <h1 className={description ? `${TITLE_CLASS} mb-2` : `${TITLE_CLASS}`}>
              {title}
            </h1>
            {description != null && description !== '' ? (
              <p className="text-zinc-400 mt-2 max-w-xl">{description}</p>
            ) : null}
          </div>
          {action != null ? (
            <div className="flex items-center shrink-0">{action}</div>
          ) : null}
        </div>

        {children}
      </div>
    </main>
  )
}
