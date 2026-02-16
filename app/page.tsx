import { getEvents } from '@/src/lib/events'
import { routes } from '@/src/lib/routes'
import { EventCardList } from '@/src/components/events'
import { PageShell } from '@/src/components/layout/PageShell'
import { LinkButton } from '@/src/components/ui'

/**
 * Página principal: listado de recitales.
 * Server Component: fetch en servidor, sin "use client".
 */
export default async function Home() {
  const events = await getEvents()

  return (
    <PageShell
      backHref="/"
      backLabel=""
      title="PRÓXIMOS RITUALES"
      action={
        <nav className="flex flex-wrap gap-2">
          <LinkButton href={routes.artists.list} variant="secondary" className="px-4 py-2.5 text-sm">
            Artistas
          </LinkButton>
          <LinkButton href={routes.venues.list} variant="secondary" className="px-4 py-2.5 text-sm">
            Sedes
          </LinkButton>
          <LinkButton href={routes.events.new} variant="primary" className="px-6 py-2.5">
            + Agregar recital
          </LinkButton>
        </nav>
      }
    >

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <EventCardList events={events} />
      </div>
    </PageShell>
  )
}
