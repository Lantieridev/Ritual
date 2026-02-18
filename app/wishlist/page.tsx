import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { PageShell } from '@/src/core/components/layout'
import { routes } from '@/src/core/lib/routes'
import { getWishlistArtistIds } from '@/src/domains/artists/wishlist-actions'
import { supabase } from '@/src/core/lib/supabase'
import {
    getLastFmArtistInfo,
    getArtistEvents,
    isLastFmConfigured,
    getBestLastFmImage,
} from '@/src/core/lib/lastfm'
import { EmptyState } from '@/src/core/components/ui/EmptyState'
import {
    searchSpotifyArtist,
    getBestSpotifyImage,
    isSpotifyConfigured,
} from '@/src/core/lib/spotify'
import { FutureEventsResults } from '@/src/domains/events/components/FutureEventsResults'
import { FutureEvent } from '@/src/core/types'

export const metadata: Metadata = {
    title: 'Wishlist | RITUAL',
    description: 'Artistas que seguís. Mirá si anunciaron shows próximos.',
}

export default async function WishlistPage() {
    const artistIds = await getWishlistArtistIds()

    if (artistIds.length === 0) {
        return (
            <PageShell
                backHref={routes.home}
                backLabel="← Inicio"
                title="Wishlist"
                description="Artistas que seguís."
            >
                <EmptyState
                    title="Tu wishlist está vacía"
                    description="Seguí a tus artistas favoritos para ver sus próximos shows acá."
                    action={{ label: "Explorar Artistas", href: routes.artists.list }}
                    icon={<span className="text-3xl">☆</span>}
                />
            </PageShell>
        )
    }

    // Fetch artist details from DB
    const { data: artists } = await supabase
        .from('artists')
        .select('id, name, genre')
        .in('id', artistIds)
        .order('name')

    // Fetch Spotify images and Last.fm shows for each artist in parallel
    const enriched = await Promise.all(
        (artists ?? []).map(async (artist) => {
            const [spotifyResult, lastfmResult, lastfmEventsResult] = await Promise.allSettled([
                isSpotifyConfigured()
                    ? searchSpotifyArtist(artist.name)
                    : Promise.resolve({ artist: null }),
                isLastFmConfigured()
                    ? getLastFmArtistInfo(artist.name)
                    : Promise.resolve({ artist: null }),
                isLastFmConfigured()
                    ? getArtistEvents(artist.name)
                    : Promise.resolve({ events: [] }),
            ])

            const spotifyArtist =
                spotifyResult.status === 'fulfilled' ? spotifyResult.value.artist : null
            const lastfmArtist =
                lastfmResult.status === 'fulfilled' ? lastfmResult.value.artist : null
            const upcomingEvents: FutureEvent[] =
                lastfmEventsResult.status === 'fulfilled'
                    ? lastfmEventsResult.value.events.slice(0, 3)
                    : []

            const image = spotifyArtist
                ? getBestSpotifyImage(spotifyArtist.images)
                : lastfmArtist
                    ? getBestLastFmImage(lastfmArtist.image)
                    : null

            return {
                ...artist,
                image,
                upcomingEvents,
            }
        })
    )

    return (
        <PageShell
            backHref={routes.home}
            backLabel="← Inicio"
            title="Wishlist"
            description={`${artistIds.length} artista${artistIds.length !== 1 ? 's' : ''} seguido${artistIds.length !== 1 ? 's' : ''}`}
        >
            <ul className="space-y-4">
                {enriched.map((artist) => (
                    <li key={artist.id}>
                        <div className="rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden">
                            <div className="flex items-center gap-4 p-4">
                                {/* Artist image */}
                                <div className="relative w-14 h-14 rounded-full overflow-hidden bg-neutral-800 flex-shrink-0">
                                    {artist.image ? (
                                        <Image
                                            src={artist.image}
                                            alt={artist.name}
                                            fill
                                            className="object-cover"
                                            sizes="56px"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-2xl text-zinc-600">
                                            🎤
                                        </div>
                                    )}
                                </div>

                                {/* Artist info */}
                                <div className="flex-1 min-w-0">
                                    <Link
                                        href={routes.artists.detail(artist.id)}
                                        className="font-semibold text-white hover:text-zinc-300 transition-colors"
                                    >
                                        {artist.name}
                                    </Link>
                                    {artist.genre && (
                                        <p className="text-xs text-zinc-500 mt-0.5">{artist.genre}</p>
                                    )}
                                </div>

                                {/* Shows badge */}
                                {artist.upcomingEvents.length > 0 && (
                                    <span className="flex-shrink-0 inline-flex items-center gap-1 text-xs font-semibold bg-green-500/15 text-green-400 border border-green-500/25 px-2.5 py-1 rounded-full">
                                        <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                                        {artist.upcomingEvents.length} show{artist.upcomingEvents.length !== 1 ? 's' : ''}
                                    </span>
                                )}
                            </div>

                            {/* Upcoming shows */}
                            {artist.upcomingEvents.length > 0 && (
                                <div className="border-t border-white/[0.06] px-4 pb-3">
                                    <FutureEventsResults events={artist.upcomingEvents} compact />
                                </div>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        </PageShell>
    )
}
