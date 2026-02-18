import type { Metadata } from 'next'
import { getVenues } from '@/src/domains/venues/data'
import { getArtists } from '@/src/domains/artists/data'
import { createEvent } from '@/src/domains/events/actions'
import { routes } from '@/src/core/lib/routes'
import { EventForm } from '@/src/domains/events/components'
import { PageShell } from '@/src/core/components/layout'

export const metadata: Metadata = {
  title: 'Nuevo recital | RITUAL',
  description: 'Cargá datos y elegí los artistas del lineup.',
}

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
