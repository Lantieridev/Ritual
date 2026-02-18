import type { Metadata } from 'next'
import { VenueForm } from '@/src/domains/venues/components'
import { createVenue } from '@/src/domains/venues/actions'
import { PageShell } from '@/src/core/components/layout'
import { routes } from '@/src/core/lib/routes'

export const metadata: Metadata = {
  title: 'Nueva sede | RITUAL',
  description: 'Cargá el lugar donde se hace el recital. Solo el nombre es obligatorio.',
}

/**
 * Página para agregar una sede.
 * Server Component; el form (Client) llama a createVenue.
 */
export default function NewVenuePage() {
  return (
    <PageShell
      backHref={routes.venues.list}
      backLabel="← Volver a sedes"
      title="Nueva sede"
      description="Cargá el lugar donde se hace el recital. Solo el nombre es obligatorio."
    >
      <VenueForm createVenue={createVenue} />
    </PageShell>
  )
}
