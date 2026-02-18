import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { getArtists } from '@/src/domains/artists/data'
import { routes } from '@/src/core/lib/routes'
import { LinkButton } from '@/src/core/components/ui'
import { PageShell } from '@/src/core/components/layout'
import { searchSpotifyArtist, getBestSpotifyImage, isSpotifyConfigured } from '@/src/core/lib/spotify'
import { getLastFmArtistInfo, getLastFmTags, isLastFmConfigured } from '@/src/core/lib/lastfm'
import type { Artist } from '@/src/core/types'

export const metadata: Metadata = {
  title: 'Artistas | RITUAL',
  description: 'Artistas para armar lineups en tus recitales.',
}

interface EnrichedArtist extends Artist {
  spotifyImage?: string | null
  tags?: string[]
}

/**
 * Enriquece un artista con imagen de Spotify y géneros de Last.fm en paralelo.
 */
async function enrichArtist(artist: Artist): Promise<EnrichedArtist> {
  const [spotifyResult, lastfmResult] = await Promise.allSettled([
    isSpotifyConfigured() ? searchSpotifyArtist(artist.name) : Promise.resolve({ artist: null }),
    isLastFmConfigured() ? getLastFmArtistInfo(artist.name) : Promise.resolve({ artist: null }),
  ])

  const spotifyArtist =
    spotifyResult.status === 'fulfilled' ? spotifyResult.value.artist : null
  const lastfmArtist =
    lastfmResult.status === 'fulfilled' ? lastfmResult.value.artist : null

  return {
    ...artist,
    spotifyImage: spotifyArtist ? getBestSpotifyImage(spotifyArtist.images) : null,
    tags: lastfmArtist ? getLastFmTags(lastfmArtist, 3) : [],
  }
}

/**
 * Listado de artistas enriquecido con imágenes de Spotify y géneros de Last.fm.
 * Server Component — fetch en paralelo por artista.
 */
export default async function ArtistsPage() {
  const artists = await getArtists()

  // Enriquecer todos en paralelo (máx. concurrencia de Next.js)
  const enriched: EnrichedArtist[] = await Promise.all(artists.map(enrichArtist))

  return (
    <PageShell
      title="Artistas"
      action={
        <LinkButton href={routes.artists.new} variant="primary" className="px-4 py-2 text-sm">
          + Nuevo artista
        </LinkButton>
      }
    >
      {enriched.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-24 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-white/10 bg-white/5">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
            </svg>
          </div>
          <div>
            <p className="text-base font-semibold text-zinc-300 mb-1">No hay artistas cargados</p>
            <p className="text-sm text-zinc-600">Agregá un artista para poder armar lineups en los recitales.</p>
          </div>
          <LinkButton href={routes.artists.new} variant="primary" className="px-6 py-2.5 text-sm">
            + Nuevo artista
          </LinkButton>
        </div>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {enriched.map((artist) => (
            <li key={artist.id}>
              <Link href={routes.artists.detail(artist.id)} className="group relative overflow-hidden rounded-xl border border-white/[0.08] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06] transition-all block">
                {/* Imagen de Spotify */}
                <div className="relative aspect-square w-full overflow-hidden bg-neutral-900">
                  {artist.spotifyImage ? (
                    <Image
                      src={artist.spotifyImage}
                      alt={artist.name}
                      fill
                      className="object-cover transition-transform duration-500 group-hover:scale-105"
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <span className="text-4xl text-zinc-700 select-none">♪</span>
                    </div>
                  )}
                  {/* Gradiente overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-neutral-950/80 via-transparent to-transparent" />
                </div>

                {/* Info */}
                <div className="p-4">
                  <p className="font-bold text-white truncate">{artist.name}</p>
                  {/* Géneros de Last.fm o genre de DB */}
                  {(artist.tags && artist.tags.length > 0) ? (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {artist.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-[10px] uppercase tracking-widest text-zinc-600 border border-white/[0.08] rounded px-1.5 py-0.5"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  ) : artist.genre ? (
                    <p className="text-sm text-zinc-500 mt-1">{artist.genre}</p>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </PageShell>
  )
}
