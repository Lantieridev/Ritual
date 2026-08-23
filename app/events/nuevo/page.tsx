import type { Metadata } from 'next'
import { getVenues } from '@/src/domains/venues/data'
import { getArtists } from '@/src/domains/artists/data'
import { insertEvent } from '@/src/domains/events/actions'
import { setAttendanceStatus, saveMemory } from '@/src/domains/events/attendance-actions'
import { insertExpense } from '@/src/domains/expenses/service'
import { findOrCreateVenue } from '@/src/domains/venues/actions'
import { findOrCreateArtist } from '@/src/domains/artists/actions'
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
import type { ExpenseCreateInput } from '@/src/core/types'

export default async function NewEventPage() {
  async function insertExpenseAction(data: ExpenseCreateInput) {
    'use server'
    return insertExpense(data)
  }
  const [venues, artists] = await Promise.all([getVenues(), getArtists()])

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
        findOrCreateVenue={findOrCreateVenue}
        findOrCreateArtist={findOrCreateArtist}
        setAttendanceStatus={setAttendanceStatus}
        saveMemory={saveMemory}
        insertExpense={insertExpenseAction}
      />
    </PageShell>
  )
}
