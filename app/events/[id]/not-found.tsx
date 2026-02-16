import Link from 'next/link'
import { routes } from '@/src/lib/routes'

/**
 * Página mostrada cuando el evento no existe (notFound() en [id]/page).
 */
export default function EventNotFound() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6 md:p-8 font-sans flex flex-col items-center justify-center gap-6">
      <h1 className="text-2xl font-bold text-zinc-400">
        Recital no encontrado
      </h1>
      <p className="text-zinc-500 text-center max-w-sm">
        El enlace puede estar roto o el recital ya no existe.
      </p>
      <Link
        href={routes.home}
        className="inline-flex items-center justify-center rounded-lg font-medium bg-yellow-500 text-neutral-950 hover:bg-yellow-400 px-6 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
      >
        Volver al listado
      </Link>
    </main>
  )
}
