import type { Metadata } from 'next'
import { getArtists } from '@/src/domains/artists/data'
import { routes } from '@/src/core/lib/routes'
import { Card, LinkButton } from '@/src/core/components/ui'
import { PageShell } from '@/src/core/components/layout'

export const metadata: Metadata = {
  title: 'Artistas | RITUAL',
  description: 'Artistas para armar lineups en tus recitales.',
}

/**
 * Listado de artistas. Permite agregar uno nuevo y armar lineups en recitales.
 * Server Component.
 */
export default async function ArtistsPage() {
  const artists = await getArtists()

  return (
    <PageShell
      backHref={routes.home}
      backLabel="← Inicio"
      title="Artistas"
      action={
        <LinkButton href={routes.artists.new} variant="primary" className="px-4 py-2 text-sm">
          + Nuevo artista
        </LinkButton>
      }
    >
      {artists.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-12 text-center">
          <p className="text-zinc-500 max-w-sm">
            No hay artistas cargados. Agregá uno para poder armar lineups en los recitales.
          </p>
          <LinkButton href={routes.artists.new} variant="primary" className="px-6 py-2.5">
            + Nuevo artista
          </LinkButton>
        </div>
      ) : (
        <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {artists.map((a) => (
            <li key={a.id}>
              <Card>
                <p className="font-bold text-white">{a.name}</p>
                {a.genre && (
                  <p className="text-sm text-zinc-400 mt-1">{a.genre}</p>
                )}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  )
}
