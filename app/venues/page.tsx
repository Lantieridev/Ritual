import type { Metadata } from 'next'
import { getVenues } from '@/src/domains/venues/data'
import { routes } from '@/src/core/lib/routes'
import { Card, LinkButton } from '@/src/core/components/ui'
import { PageShell } from '@/src/core/components/layout'

export const metadata: Metadata = {
  title: 'Sedes | RITUAL',
  description: 'Sedes y venues para tus recitales.',
}

/**
 * Listado de sedes. Permite agregar una nueva y evita bloqueo al crear recitales.
 * Server Component.
 */
export default async function VenuesPage() {
  const venues = await getVenues()

  return (
    <PageShell
      backHref={routes.home}
      backLabel="← Inicio"
      title="Sedes"
      action={
        <LinkButton href={routes.venues.new} variant="primary" className="px-4 py-2 text-sm">
          + Nueva sede
        </LinkButton>
      }
    >
      {venues.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="text-zinc-500 max-w-sm">
            No hay sedes cargadas. Agregá una para poder crear recitales.
          </p>
          <LinkButton href={routes.venues.new} variant="primary" className="px-6 py-2.5">
            + Nueva sede
          </LinkButton>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {venues.map((v) => (
            <li key={v.id}>
              <Card>
                <p className="font-bold text-white">{v.name}</p>
                {(v.city || v.country) && (
                  <p className="text-sm text-zinc-400 mt-1">
                    {[v.city, v.country].filter(Boolean).join(', ')}
                  </p>
                )}
                {v.address && (
                  <p className="text-sm text-zinc-500 mt-0.5">{v.address}</p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  )
}
