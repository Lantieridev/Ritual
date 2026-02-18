import { getEvents } from '@/src/domains/events/data'
import { routes } from '@/src/core/lib/routes'
import { EventCardList } from '@/src/domains/events/components'
import { PageShell } from '@/src/core/components/layout'
import { LinkButton } from '@/src/core/components/ui'

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
          <LinkButton href={routes.events.search} variant="secondary" className="px-4 py-2.5 text-sm">
            Buscar recitales
          </LinkButton>
          <LinkButton href={routes.artists.list} variant="secondary" className="px-4 py-2.5 text-sm">
            Artistas
          </LinkButton>
          <LinkButton href={routes.venues.list} variant="secondary" className="px-4 py-2.5 text-sm">
            Sedes
          </LinkButton>
          <LinkButton href={routes.expenses.list} variant="secondary" className="px-4 py-2.5 text-sm">
            Mis gastos
          </LinkButton>
          <LinkButton href={routes.events.new} variant="primary" className="px-6 py-2.5">
            + Agregar recital
          </LinkButton>
        </nav>
      }
    >

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <EventCardList
          events={events}
          emptyAction={
            <LinkButton href={routes.events.new} variant="primary" className="px-6 py-2.5">
              Agregar primer recital
            </LinkButton>
          }
        />
      </div>
    </PageShell>
  )
}
