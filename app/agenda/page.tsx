import { redirect } from 'next/navigation'
import { createClient } from '@/src/core/lib/supabase/server'
import { listMyEvents } from '@/src/domains/events/service'
import { AgendaView } from '@/src/domains/events/components'
import { PageShell } from '@/src/core/components/layout'

export const metadata = {
    title: 'Mi Agenda | RITUAL',
}

/**
 * Todos los shows propios (interested/going/went) en una sola vista con
 * tabs — issue #65. `listMyEvents()` ya trae sólo eso (parte de `attendance`
 * filtrada por usuario, no del catálogo entero), así que no hace falta
 * ningún filtrado nuevo del lado del server: el resto vive en `AgendaView`,
 * que reusa `buildHomeFeed` — la misma función que ya arma el archivo del
 * Home — con cada valor de `HomeFilter` que las tabs necesitan.
 */
export default async function AgendaPage() {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
        redirect('/login')
    }

    const events = await listMyEvents()

    return (
        <PageShell title="Mi Agenda">
            <AgendaView events={events} />
        </PageShell>
    )
}
