import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { getEventById } from '@/src/domains/events/data'
import { getVenues } from '@/src/domains/venues/data'
import { getArtists } from '@/src/domains/artists/data'
import { updateEvent } from '@/src/domains/events/actions'
import { routes } from '@/src/core/lib/routes'
import { EventForm } from '@/src/domains/events/components'
import { PageShell } from '@/src/core/components/layout'

interface EditEventPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: EditEventPageProps): Promise<Metadata> {
  const { id } = await params
  const event = await getEventById(id)
  if (!event) return { title: 'Recital no encontrado | RITUAL' }
  return { title: `Editar ${event.name || 'recital'} | RITUAL` }
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
