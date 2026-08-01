import Link from 'next/link'
import { routes } from '@/src/core/lib/routes'

/**
 * Página 404 global cuando la ruta no existe.
 */
export default function NotFound() {
  return (
    <main className="min-h-screen bg-ritual-bg text-ritual-bone flex flex-col items-center justify-center gap-6 px-6">
      <div className="relative inline-block">
        <div className="border-2 border-ritual-border bg-ritual-surface px-10 py-8 text-center">
          <p className="font-label text-[9px] tracking-[0.2em] uppercase text-ritual-gray-text mb-2">Talón</p>
          <p className="font-display text-5xl text-ritual-bone">404</p>
        </div>
        <span
          className="absolute -top-3 -right-8 font-label text-xs font-bold uppercase tracking-[0.1em] text-ritual-red-hover border-2 border-ritual-red px-2 py-0.5 bg-ritual-bg"
          style={{ transform: 'rotate(-9deg)' }}
        >
          Cancelado
        </span>
      </div>
      <h1 className="font-display text-3xl uppercase text-ritual-bone text-center">Esta función se canceló</h1>
      <p className="font-body text-sm text-ritual-gray-text text-center max-w-sm">
        La ruta que buscás no existe o fue movida.
      </p>
      <Link
        href={routes.home}
        className="font-label text-[10px] tracking-[0.14em] uppercase bg-ritual-red text-ritual-bone hover:bg-ritual-red-hover px-6 py-3 transition-colors"
      >
        Volver al inicio
      </Link>
    </main>
  )
}
