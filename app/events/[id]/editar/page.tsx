import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { gql } from 'urql'
import { getClient } from '@/src/graphql/client'
import { getEventById } from '@/src/domains/events/data'
import { updateEvent } from '@/src/domains/events/actions'
import { routes } from '@/src/core/lib/routes'
import type { Artist, GraphQLArtist, GraphQLVenue, Venue } from '@/src/core/types'

const EventFormPickersQuery = gql`
  query EventFormPickers {
    venues { id name city country address }
    artists { id name genre imageUrl spotifyId }
  }
`

/** El form consume la forma snake_case del dominio para sedes y artistas. */
async function fetchPickers() {
  const { data } = await getClient().query<{
    venues: GraphQLVenue[]
    artists: GraphQLArtist[]
  }>(EventFormPickersQuery, {})
  const venues: Venue[] = data?.venues ?? []
  const artists: Artist[] = (data?.artists ?? []).map((a) => ({
    id: a.id,
    name: a.name,
    genre: a.genre,
    image_url: a.imageUrl,
    spotify_id: a.spotifyId,
  }))
  return { venues, artists }
}
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
  const [event, { venues, artists }] = await Promise.all([getEventById(id), fetchPickers()])

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
