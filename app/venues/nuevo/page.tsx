import { VenueForm } from '@/src/components/venues/VenueForm'
import { PageShell } from '@/src/components/layout/PageShell'
import { routes } from '@/src/lib/routes'
import { createVenue } from '../actions'

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
