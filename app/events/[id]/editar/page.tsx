import { notFound } from 'next/navigation'
import { getEventById } from '@/src/lib/events'
import { getVenues } from '@/src/lib/venues'
import { getArtists } from '@/src/lib/artists'
import { routes } from '@/src/lib/routes'
import { EventForm } from '@/src/components/events'
import { PageShell } from '@/src/components/layout/PageShell'
import { updateEvent } from '../../actions'

interface EditEventPageProps {
  params: Promise<{ id: string }>
}

/**
 * Página para editar un recital (datos + lineup).
 * Server Component: carga evento, sedes y artistas; el form llama a updateEvent.
 */
export default async function EditEventPage({ params }: EditEventPageProps) {
  const { id } = await params
  const [event, venues, artists] = await Promise.all([
    getEventById(id),
    getVenues(),
    getArtists(),
  ])

  if (!event) {
    notFound()
  }

  return (
    <PageShell
      backHref={routes.events.detail(id)}
      backLabel="← Volver al recital"
      title="Editar recital"
      description="Modificá nombre, fecha, sede o artistas del lineup."
    >
      <EventForm
        venues={venues}
        artists={artists}
        event={event}
        updateEvent={updateEvent}
      />
    </PageShell>
  )
}
