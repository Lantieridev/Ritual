import { ArtistForm } from '@/src/components/artists/ArtistForm'
import { PageShell } from '@/src/components/layout/PageShell'
import { routes } from '@/src/lib/routes'
import { createArtist } from '../actions'

/**
 * Página para agregar un artista.
 * Server Component; el form (Client) llama a createArtist.
 */
export default function NewArtistPage() {
  return (
    <PageShell
      backHref={routes.artists.list}
      backLabel="← Volver a artistas"
      title="Nuevo artista"
      description="Cargá el artista para poder sumarlo a los lineups de los recitales."
    >
      <ArtistForm createArtist={createArtist} />
    </PageShell>
  )
}
