import Link from 'next/link'
import { routes } from '@/src/core/lib/routes'

/**
 * Página 404 global cuando la ruta no existe.
 */
export default function NotFound() {
  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6 md:p-8 font-sans flex flex-col items-center justify-center gap-6">
      <h1 className="text-3xl font-bold text-zinc-400">Página no encontrada</h1>
      <p className="text-zinc-500 text-center max-w-sm">
        La ruta que buscás no existe o fue movida.
      </p>
      <Link
        href={routes.home}
        className="inline-flex items-center justify-center rounded-lg font-medium bg-white text-neutral-950 hover:bg-zinc-200 px-6 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-white/30"
      >
        Volver al inicio
      </Link>
    </main>
  )
}
