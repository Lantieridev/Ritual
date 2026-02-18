import type { Metadata } from 'next'
import { ArtistForm } from '@/src/domains/artists/components'
import { createArtist } from '@/src/domains/artists/actions'
import { PageShell } from '@/src/core/components/layout'
import { routes } from '@/src/core/lib/routes'

export const metadata: Metadata = {
  title: 'Nuevo artista | RITUAL',
  description: 'Cargá el artista para poder sumarlo a los lineups de los recitales.',
}

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
