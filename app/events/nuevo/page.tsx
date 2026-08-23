import type { Metadata } from 'next'
import { gql } from 'urql'
import { getClient } from '@/src/graphql/client'
import { insertEvent } from '@/src/domains/events/actions'
import { setAttendanceStatus, saveMemory } from '@/src/domains/events/attendance-actions'
import { insertExpense } from '@/src/domains/expenses/service'
import { routes } from '@/src/core/lib/routes'
import { EventForm } from '@/src/domains/events/components'
import { PageShell } from '@/src/core/components/layout'

export const metadata: Metadata = {
  title: 'Cargar show | RITUAL',
  description: 'Una sola pantalla: datos del show, y si ya fuiste, puntaje y gasto también.',
}

/**
 * Página para cargar un recital manualmente — una sola acción, no un wizard:
 * datos + lineup + (si ya fue) puntaje/reseña + gasto, todo en el mismo submit.
 */
import type { Artist, ExpenseCreateInput, GraphQLArtist, GraphQLVenue, Venue } from '@/src/core/types'

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

export default async function NewEventPage() {
  async function insertExpenseAction(data: ExpenseCreateInput) {
    'use server'
    return insertExpense(data)
  }
  const { venues, artists } = await fetchPickers()

  return (
    <PageShell
      backHref={routes.home}
      backLabel="← Volver al listado"
      title="Cargar show"
      description="Datos del recital y, si ya fuiste, puntaje y gasto — todo en una sola acción."
    >
      <EventForm
        venues={venues}
        artists={artists}
        insertEvent={insertEvent}
        setAttendanceStatus={setAttendanceStatus}
        saveMemory={saveMemory}
        insertExpense={insertExpenseAction}
      />
    </PageShell>
  )
}
