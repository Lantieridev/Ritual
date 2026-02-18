import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { getArtistById } from '@/src/domains/artists/data'
import { routes } from '@/src/core/lib/routes'
import {
    searchSpotifyArtist,
    getBestSpotifyImage,
    isSpotifyConfigured,
} from '@/src/core/lib/spotify'
import {
    getLastFmArtistInfo,
    getLastFmTags,
    getBestLastFmImage,
    isLastFmConfigured,
    getArtistEvents,
} from '@/src/core/lib/lastfm'
import { WishlistButton } from '@/src/domains/artists/components/WishlistButton'
import { getWishlistArtistIds } from '@/src/domains/artists/wishlist-actions'

interface ArtistDetailPageProps {
    params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: ArtistDetailPageProps): Promise<Metadata> {
    const { id } = await params
    const artist = await getArtistById(id)
    if (!artist) return { title: 'Artista no encontrado | RITUAL' }
    return {
        title: `${artist.name} | RITUAL`,
        description: `Historial de shows de ${artist.name} en RITUAL.`,
    }
}

// ... imports unchanged
import { ArtistProfile } from '@/src/domains/artists/components/ArtistProfile'

// ... metadata unchanged

export default async function ArtistDetailPage({ params }: ArtistDetailPageProps) {
    const { id } = await params
    const artist = await getArtistById(id)

    if (!artist) notFound()

    // Fetch all external data + wishlist in parallel
    const [[spotifyResult, lastfmResult, lastfmEventsResult], wishlistIds] = await Promise.all([
        Promise.allSettled([
            isSpotifyConfigured() ? searchSpotifyArtist(artist.name) : Promise.resolve({ artist: null }),
            isLastFmConfigured() ? getLastFmArtistInfo(artist.name) : Promise.resolve({ artist: null }),
            isLastFmConfigured()
                ? getArtistEvents(artist.name)
                : Promise.resolve({ events: [] }),
        ]),
        getWishlistArtistIds(),
    ])

    const spotifyArtist = spotifyResult.status === 'fulfilled' ? spotifyResult.value.artist : null
    const lastfmArtist = lastfmResult.status === 'fulfilled' ? lastfmResult.value.artist : null
    const upcomingFromLastFm = lastfmEventsResult.status === 'fulfilled' ? lastfmEventsResult.value.events.slice(0, 5) : []

    const inWishlist = wishlistIds.includes(artist.id)

    const heroImage = spotifyArtist
        ? getBestSpotifyImage(spotifyArtist.images)
        : lastfmArtist
            ? getBestLastFmImage(lastfmArtist.image)
            : null

    const tags = lastfmArtist ? getLastFmTags(lastfmArtist, 5) : artist.genre ? [artist.genre] : []

    // Similar artists from Last.fm
    const similarArtists = lastfmArtist?.similar?.artist?.slice(0, 5) ?? []

    // Limpiar bio de Last.fm (viene con HTML y links)
    const rawBio = lastfmArtist?.bio?.summary ?? ''
    const bio = rawBio
        .replace(/<a[^>]*>.*?<\/a>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 500)

    const listeners = lastfmArtist?.stats?.listeners
        ? Number(lastfmArtist.stats.listeners).toLocaleString('es-AR')
        : null

    const spotifyFollowers = spotifyArtist?.followers?.total
        ? Number(spotifyArtist.followers.total).toLocaleString('es-AR')
        : null

    const spotifyUrl = spotifyArtist?.external_urls?.spotify ?? null

    const now = new Date()
    // Separate internal events
    const internalPast = artist.events.filter((e) => new Date(e.date) < now)
    const internalUpcoming = artist.events.filter((e) => new Date(e.date) >= now)

    return (
        <main className="min-h-screen bg-neutral-950 text-white font-sans">
            {/* Hero */}
            <div className="relative h-72 md:h-96 w-full overflow-hidden bg-neutral-900">
                {heroImage ? (
                    <Image
                        src={heroImage}
                        alt={artist.name}
                        fill
                        className="object-cover object-top"
                        priority
                        sizes="100vw"
                    />
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-neutral-800 to-neutral-950" />
                )}
                {/* Gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/60 to-transparent" />
                <div className="absolute inset-0 bg-gradient-to-r from-neutral-950/40 to-transparent" />

                {/* Back nav */}
                <div className="absolute top-0 left-0 right-0 p-6 z-10">
                    <Link
                        href={routes.artists.list}
                        className="inline-flex items-center gap-2 text-sm text-zinc-300 hover:text-white transition-colors bg-black/30 backdrop-blur-sm rounded-lg px-3 py-1.5"
                    >
                        ← Artistas
                    </Link>
                </div>

                {/* Nombre + metadata sobre la imagen */}
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 z-10">
                    <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-3 drop-shadow-lg">
                        {artist.name}
                    </h1>
                    <div className="flex flex-wrap items-center gap-3">
                        {tags.slice(0, 3).map((tag) => (
                            <span
                                key={tag}
                                className="text-[10px] uppercase tracking-widest text-zinc-300 border border-white/20 rounded-full px-2.5 py-0.5 bg-black/40 backdrop-blur-sm"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Contenido */}
            <div className="max-w-4xl mx-auto px-6 md:px-8 py-8 space-y-8">

                {/* Acciones Header */}
                <div className="flex items-center justify-between">
                    <WishlistButton artistId={artist.id} initialInWishlist={inWishlist} />

                    {spotifyUrl && (
                        <a
                            href={spotifyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-xs font-medium text-zinc-400 hover:text-white transition-colors"
                        >
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                            </svg>
                            Abrir en Spotify
                        </a>
                    )}
                </div>

                <ArtistProfile
                    artist={artist}
                    bio={bio}
                    tags={tags}
                    similarArtists={similarArtists}
                    upcomingEvents={upcomingFromLastFm}
                    internalUpcoming={internalUpcoming}
                    internalPast={internalPast}
                    stats={{ listeners, spotifyFollowers }}
                />
            </div>
        </main>
    )
}
