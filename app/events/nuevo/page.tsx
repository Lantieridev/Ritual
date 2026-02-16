import Link from 'next/link'
import { getVenues } from '@/src/lib/events'
import { EventForm } from '@/src/components/events'
import { createEvent } from '../actions'

/**
 * Página para agregar un recital manualmente.
 * Server Component: obtiene sedes y pasa la Server Action al formulario (Client).
 */
export default async function NewEventPage() {
  const venues = await getVenues()

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-6 md:p-8 font-sans">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-zinc-400 hover:text-yellow-500 mb-8 transition-colors"
      >
        ← Volver al listado
      </Link>

      <header className="mb-8">
        <h1 className="text-4xl font-bold text-yellow-500 tracking-tighter">
          Nuevo recital
        </h1>
        <p className="text-zinc-400 mt-2">
          Cargá los datos del recital. El lineup de artistas se podrá agregar en una próxima versión.
        </p>
      </header>

      <EventForm venues={venues} createEvent={createEvent} />
    </main>
  )
}
