import type { ReactNode } from 'react'
import Link from 'next/link'

export interface PageShellProps {
  backHref: string
  backLabel: string
  title: string
  description?: string
  action?: ReactNode
  children: ReactNode
}

const MAIN_CLASS =
  'min-h-screen bg-neutral-950 text-white p-6 md:p-8 font-sans'
const TITLE_CLASS = 'text-4xl font-bold text-white tracking-tighter'

/**
 * Layout consistente de página: main, enlace de vuelta, título, descripción opcional, acción.
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
            className="inline-flex items-center gap-2 text-zinc-400 hover:text-white transition-colors"
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
