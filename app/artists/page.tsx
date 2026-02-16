import { getArtists } from '@/src/lib/artists'
import { routes } from '@/src/lib/routes'
import { Card, LinkButton } from '@/src/components/ui'
import { PageShell } from '@/src/components/layout/PageShell'

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
        <p className="text-zinc-500 mb-4">
          No hay artistas cargados. Agregá uno para poder armar lineups en los recitales.
        </p>
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
