import { getVenues } from '@/src/lib/venues'
import { getArtists } from '@/src/lib/artists'
import { routes } from '@/src/lib/routes'
import { EventForm } from '@/src/components/events'
import { PageShell } from '@/src/components/layout/PageShell'
import { createEvent } from '../actions'

/**
 * Página para agregar un recital manualmente (incl. lineup).
 * Server Component: obtiene sedes y artistas; el form llama a createEvent.
 */
export default async function NewEventPage() {
  const [venues, artists] = await Promise.all([getVenues(), getArtists()])

  return (
    <PageShell
      backHref={routes.home}
      backLabel="← Volver al listado"
      title="Nuevo recital"
      description="Cargá datos y elegí los artistas del lineup."
    >
      <EventForm venues={venues} artists={artists} createEvent={createEvent} />
    </PageShell>
  )
}
