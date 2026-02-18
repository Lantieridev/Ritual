import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import { PageShell } from '@/src/core/components/layout'
import { routes } from '@/src/core/lib/routes'
import { getWishlistArtistIds } from '@/src/domains/artists/wishlist-actions'
import { supabase } from '@/src/core/lib/supabase'
import { getTicketmasterEventsByArtist, isTicketmasterConfigured, normalizeTicketmasterEvent } from '@/src/core/lib/ticketmaster'

import { searchSpotifyArtist, getBestSpotifyImage, isSpotifyConfigured } from '@/src/core/lib/spotify'

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
                <div className="flex flex-col items-center gap-4 py-16 text-center">
                    <p className="text-5xl">☆</p>
                    <p className="text-zinc-500 max-w-sm">
                        No seguís ningún artista todavía. Entrá al perfil de un artista y tocá{' '}
                        <strong className="text-zinc-400">Seguir</strong>.
                    </p>
                    <Link
                        href={routes.artists.list}
                        className="text-sm text-zinc-400 hover:text-white transition-colors underline underline-offset-4"
                    >
                        Ver artistas
                    </Link>
                </div>
            </PageShell>
        )
    }

    // Fetch artist details from DB
    const { data: artists } = await supabase
        .from('artists')
        .select('id, name, genre')
        .in('id', artistIds)
        .order('name')

    // Fetch Spotify images and Ticketmaster shows for each artist in parallel
    const enriched = await Promise.all(
        (artists ?? []).map(async (artist) => {
            const [spotifyResult, ticketmasterResult] = await Promise.allSettled([
                isSpotifyConfigured()
                    ? searchSpotifyArtist(artist.name)
                    : Promise.resolve({ artist: null }),
                isTicketmasterConfigured()
                    ? getTicketmasterEventsByArtist(artist.name)
                    : Promise.resolve({ events: [] }),
            ])

            const spotifyArtist =
                spotifyResult.status === 'fulfilled' ? spotifyResult.value.artist : null
            const upcomingEvents = ticketmasterResult.status === 'fulfilled'
                ? ticketmasterResult.value.events.slice(0, 3).map(normalizeTicketmasterEvent)
                : []

            return {
                ...artist,
                image: spotifyArtist ? getBestSpotifyImage(spotifyArtist.images) : null,
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
                                <div className="border-t border-white/[0.06] px-4 py-3 space-y-2">
                                    <p className="text-[10px] uppercase tracking-widest text-zinc-600 mb-2">Shows próximos</p>
                                    {artist.upcomingEvents.map((ev) => (
                                        <div key={ev.id} className="flex items-center justify-between gap-3 text-sm">
                                            <div className="min-w-0">
                                                <p className="text-zinc-300 truncate">{ev.venue.name}</p>
                                                <p className="text-xs text-zinc-600">{ev.venue.city}</p>
                                            </div>
                                            <p className="text-zinc-500 whitespace-nowrap text-xs">
                                                {new Date(ev.datetime).toLocaleDateString('es-AR', {
                                                    day: 'numeric',
                                                    month: 'short',
                                                    year: 'numeric',
                                                })}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </li>
                ))}
            </ul>
        </PageShell>
    )
}
