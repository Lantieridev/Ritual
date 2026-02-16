import Link from 'next/link'
import { getEvents } from '@/src/lib/events'
import { EventCardList } from '@/src/components/events'

/**
 * Página principal: listado de recitales.
 * Server Component: fetch en servidor, sin "use client".
 */
export default async function Home() {
  const events = await getEvents()

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6 md:p-8 font-sans">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
        <h1 className="text-4xl font-bold text-yellow-500 tracking-tighter">
          PRÓXIMOS RITUALES
        </h1>
        <Link
          href="/events/nuevo"
          className="inline-flex items-center justify-center rounded-lg font-medium bg-yellow-500 text-neutral-950 hover:bg-yellow-400 px-6 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-yellow-500/50"
        >
          + Agregar recital
        </Link>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <EventCardList events={events} />
      </div>
    </main>
  )
}
