import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import type { Metadata } from 'next'
import { getArtistById } from '@/src/domains/artists/data'
import { routes } from '@/src/core/lib/routes'
import { searchSpotifyArtist, isSpotifyConfigured } from '@/src/core/lib/spotify'
import { getLastFmArtistInfo, isLastFmConfigured } from '@/src/core/lib/lastfm'
import { isTicketmasterConfigured, searchTicketmasterEvents } from '@/src/core/lib/ticketmaster'
import { WishlistButton } from '@/src/domains/artists/components/WishlistButton'
import { getWishlistArtistIds } from '@/src/domains/artists/wishlist-actions'
import { ArtistProfile } from '@/src/domains/artists/components/ArtistProfile'
import { buildArtistEnrichment } from '@/src/domains/artists/enrichment'

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

export default async function ArtistDetailPage({ params }: ArtistDetailPageProps) {
    const { id } = await params
    const artist = await getArtistById(id)

    if (!artist) notFound()

    // Fetch all external data + wishlist in parallel
    const [[spotifyResult, lastfmResult, tmEventsResult], wishlistIds] = await Promise.all([
        Promise.allSettled([
            isSpotifyConfigured() ? searchSpotifyArtist(artist.name) : Promise.resolve({ artist: null }),
            isLastFmConfigured() ? getLastFmArtistInfo(artist.name) : Promise.resolve({ artist: null }),
            isTicketmasterConfigured()
                ? searchTicketmasterEvents({ keyword: artist.name })
                : Promise.resolve({ events: [] }),
        ]),
        getWishlistArtistIds(),
    ])

    const spotifyArtist = spotifyResult.status === 'fulfilled' ? spotifyResult.value.artist : null
    const lastfmArtist = lastfmResult.status === 'fulfilled' ? lastfmResult.value.artist : null
    const upcomingEvents = tmEventsResult.status === 'fulfilled' ? tmEventsResult.value.events.slice(0, 5) : []

    const inWishlist = wishlistIds.includes(artist.id)

    const {
        heroImage,
        tags,
        similarArtists,
        bio,
        listeners,
        spotifyFollowers,
        spotifyUrl,
        internalPast,
        internalUpcoming,
        timesSeen,
        averageRating,
        bestNight,
    } = buildArtistEnrichment(artist, spotifyArtist, lastfmArtist)

    return (
        <main className="min-h-screen bg-ritual-bg text-ritual-bone">
            {/* Hero */}
            <div className="relative h-80 md:h-[30rem] w-full overflow-hidden bg-ritual-panel">
                {heroImage ? (
                    <div className="absolute inset-0 ritual-photo">
                        <Image src={heroImage} alt={artist.name} fill className="object-cover object-top" priority sizes="100vw" />
                    </div>
                ) : (
                    <div className="absolute inset-0 bg-gradient-to-br from-ritual-panel-2 to-ritual-bg" />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-ritual-bg via-ritual-bg/60 to-transparent" />

                <div className="absolute top-0 left-0 right-0 p-6 z-10">
                    <Link
                        href={routes.artists.list}
                        className="font-label text-[10px] tracking-[0.14em] uppercase text-ritual-gray-light-3 hover:text-ritual-bone transition-colors bg-ritual-bg/40 backdrop-blur-sm px-3 py-1.5"
                    >
                        ← Artistas
                    </Link>
                </div>

                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 z-10">
                    <h1 className="font-display text-5xl md:text-8xl leading-[0.85] uppercase text-ritual-bone">
                        {artist.name}
                    </h1>
                    <div className="flex flex-wrap items-center gap-4 mt-3">
                        {timesSeen > 0 && (
                            <span className="font-label text-[10px] tracking-[0.14em] uppercase text-ritual-red">
                                {timesSeen} {timesSeen === 1 ? 'vez' : 'veces'}{averageRating != null && ` · ${averageRating.toFixed(1)} promedio`}
                            </span>
                        )}
                        {tags.slice(0, 3).map((tag) => (
                            <span key={tag} className="font-label text-[10px] uppercase tracking-[0.1em] text-ritual-gray-light-2 border border-ritual-border-2 px-2.5 py-0.5">
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Contenido */}
            <div className="max-w-4xl mx-auto px-6 md:px-8 py-10 space-y-8">
                <div className="flex items-center justify-between">
                    <WishlistButton artistId={artist.id} initialInWishlist={inWishlist} />

                    {spotifyUrl && (
                        <a
                            href={spotifyUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-label text-[10px] tracking-[0.1em] uppercase text-ritual-gray-mid hover:text-ritual-gray-text transition-colors"
                        >
                            Abrir en Spotify →
                        </a>
                    )}
                </div>

                <ArtistProfile
                    artist={artist}
                    bio={bio}
                    similarArtists={similarArtists}
                    upcomingEvents={upcomingEvents}
                    internalUpcoming={internalUpcoming}
                    internalPast={internalPast}
                    timesSeen={timesSeen}
                    averageRating={averageRating}
                    bestNight={bestNight}
                    stats={{ listeners, spotifyFollowers }}
                />
            </div>
        </main>
    )
}
