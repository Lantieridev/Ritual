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
    const pastEvents = artist.events.filter((e) => new Date(e.date) < now)
    const upcomingEvents = artist.events.filter((e) => new Date(e.date) >= now)

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
                <div className="absolute top-0 left-0 right-0 p-6">
                    <Link
                        href={routes.artists.list}
                        className="inline-flex items-center gap-2 text-sm text-zinc-300 hover:text-white transition-colors bg-black/30 backdrop-blur-sm rounded-lg px-3 py-1.5"
                    >
                        ← Artistas
                    </Link>
                </div>

                {/* Nombre + metadata sobre la imagen */}
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10">
                    <h1 className="text-4xl md:text-6xl font-bold tracking-tight text-white mb-3">
                        {artist.name}
                    </h1>
                    <div className="flex flex-wrap items-center gap-3">
                        {tags.slice(0, 3).map((tag) => (
                            <span
                                key={tag}
                                className="text-[10px] uppercase tracking-widest text-zinc-400 border border-white/20 rounded-full px-2.5 py-0.5 bg-black/30 backdrop-blur-sm"
                            >
                                {tag}
                            </span>
                        ))}
                    </div>
                </div>
            </div>

            {/* Contenido */}
            <div className="max-w-3xl mx-auto px-6 md:px-8 py-10 space-y-12">

                {/* Acciones y stats rápidos */}
                <div className="flex flex-wrap items-start gap-6">
                    {/* Botón seguir */}
                    <WishlistButton artistId={artist.id} initialInWishlist={inWishlist} />

                    {/* Stats externos */}
                    <div className="flex flex-wrap gap-5">
                        {spotifyFollowers && (
                            <div>
                                <p className="text-lg font-bold text-white tabular-nums">{spotifyFollowers}</p>
                                <p className="text-[10px] uppercase tracking-widest text-zinc-600">Seguidores Spotify</p>
                            </div>
                        )}
                        {listeners && (
                            <div>
                                <p className="text-lg font-bold text-white tabular-nums">{listeners}</p>
                                <p className="text-[10px] uppercase tracking-widest text-zinc-600">Oyentes Last.fm</p>
                            </div>
                        )}
                        {spotifyUrl && (
                            <a
                                href={spotifyUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors self-end mb-0.5"
                            >
                                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="currentColor">
                                    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                                </svg>
                                Ver en Spotify
                            </a>
                        )}
                    </div>
                </div>

                {/* Bio */}
                {bio && (
                    <section>
                        <p className="text-sm text-zinc-400 leading-relaxed">{bio}{bio.length >= 500 ? '…' : ''}</p>
                    </section>
                )}

                {/* Shows próximos desde Last.fm */}
                {upcomingFromLastFm.length > 0 && (
                    <section>
                        <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-5 flex items-center gap-3">
                            Shows próximos
                            <span className="text-[10px] text-zinc-700 normal-case tracking-normal">vía Last.fm</span>
                        </h2>
                        <ul className="divide-y divide-white/[0.05]">
                            {upcomingFromLastFm.map((ev) => {
                                const dateObj = new Date(ev.datetime)
                                return (
                                    <li key={ev.id}>
                                        <div className="flex items-center gap-5 py-4">
                                            <div className="w-12 shrink-0 text-center">
                                                <p className="text-[10px] font-bold text-zinc-600 uppercase">
                                                    {dateObj.toLocaleDateString('es-AR', { month: 'short' })}
                                                </p>
                                                <p className="text-xl font-bold text-white leading-none mt-0.5">
                                                    {dateObj.getDate()}
                                                </p>
                                                <p className="text-[10px] text-zinc-700">{dateObj.getFullYear()}</p>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-white truncate">{ev.title}</p>
                                                <p className="text-xs text-zinc-500 mt-0.5 truncate">
                                                    📍 {[ev.venue.name, ev.venue.city, ev.venue.country].filter(Boolean).join(', ')}
                                                </p>
                                                {ev.priceRange && (
                                                    <p className="text-xs text-zinc-600 mt-0.5">
                                                        {ev.priceRange.currency} {ev.priceRange.min.toLocaleString('es-AR')}
                                                        {ev.priceRange.max !== ev.priceRange.min && ` – ${ev.priceRange.max.toLocaleString('es-AR')}`}
                                                    </p>
                                                )}
                                            </div>
                                            {ev.url && (
                                                <a
                                                    href={ev.url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="shrink-0 text-xs border border-white/15 text-zinc-400 hover:text-white hover:border-white/30 px-3 py-1.5 rounded-lg transition-colors"
                                                >
                                                    Entradas
                                                </a>
                                            )}
                                        </div>
                                    </li>
                                )
                            })}
                        </ul>
                    </section>
                )}

                {/* Stats de shows en tu colección */}
                <div className="grid grid-cols-3 gap-4 border-t border-white/[0.06] pt-8">
                    {[
                        { label: 'En tu colección', value: artist.events.length },
                        { label: 'Pasados', value: pastEvents.length },
                        { label: 'Próximos', value: upcomingEvents.length },
                    ].map(({ label, value }) => (
                        <div key={label} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-center">
                            <p className="text-3xl font-bold text-white tabular-nums">{value}</p>
                            <p className="text-[10px] uppercase tracking-widest text-zinc-600 mt-1">{label}</p>
                        </div>
                    ))}
                </div>

                {/* Shows en tu colección */}
                {artist.events.length === 0 ? (
                    <div className="py-12 text-center border-t border-white/[0.06]">
                        <p className="text-zinc-600 text-sm">No hay shows de este artista en tu colección.</p>
                        <Link
                            href={routes.events.search}
                            className="inline-block mt-4 text-sm text-zinc-400 hover:text-white transition-colors underline underline-offset-4"
                        >
                            Buscar shows →
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-8 border-t border-white/[0.06] pt-8">
                        <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500">Tu historial</h2>
                        {upcomingEvents.length > 0 && (
                            <section>
                                <h3 className="text-[10px] uppercase tracking-widest text-zinc-600 mb-4">Próximos</h3>
                                <ShowList events={upcomingEvents} />
                            </section>
                        )}
                        {pastEvents.length > 0 && (
                            <section>
                                {upcomingEvents.length > 0 && (
                                    <h3 className="text-[10px] uppercase tracking-widest text-zinc-600 mb-4">Pasados</h3>
                                )}
                                <ShowList events={pastEvents} />
                            </section>
                        )}
                    </div>
                )}

                {/* Artistas similares */}
                {similarArtists.length > 0 && (
                    <section className="border-t border-white/[0.06] pt-8">
                        <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">Artistas similares</h2>
                        <div className="flex flex-wrap gap-2">
                            {similarArtists.map((similar) => (
                                <span
                                    key={similar.name}
                                    className="text-sm text-zinc-400 border border-white/[0.08] rounded-lg px-3 py-1.5 hover:border-white/20 hover:text-zinc-200 transition-colors"
                                >
                                    {similar.name}
                                </span>
                            ))}
                        </div>
                    </section>
                )}

                {/* Tags completos */}
                {tags.length > 3 && (
                    <section className="border-t border-white/[0.06] pt-6">
                        <div className="flex flex-wrap gap-1.5">
                            {tags.map((tag) => (
                                <span
                                    key={tag}
                                    className="text-[10px] uppercase tracking-widest text-zinc-500 border border-white/[0.08] rounded px-2 py-0.5"
                                >
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </main>
    )
}

function ShowList({
    events,
}: {
    events: Array<{ id: string; name: string | null; date: string; venues: { name: string; city: string | null } | null }>
}) {
    return (
        <ul className="divide-y divide-white/[0.05]">
            {events.map((ev) => {
                const dateObj = new Date(ev.date)
                return (
                    <li key={ev.id}>
                        <Link
                            href={routes.events.detail(ev.id)}
                            className="group flex items-center gap-5 py-4 hover:bg-white/[0.02] -mx-3 px-3 rounded-lg transition-colors"
                        >
                            <div className="w-12 shrink-0 text-center">
                                <p className="text-[10px] font-bold text-zinc-600 uppercase">
                                    {dateObj.toLocaleDateString('es-AR', { month: 'short' })}
                                </p>
                                <p className="text-xl font-bold text-white leading-none mt-0.5">
                                    {dateObj.getDate()}
                                </p>
                                <p className="text-[10px] text-zinc-700">{dateObj.getFullYear()}</p>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-white truncate">{ev.name || 'Recital'}</p>
                                {ev.venues && (
                                    <p className="text-xs text-zinc-600 mt-0.5 truncate">
                                        📍 {[ev.venues.name, ev.venues.city].filter(Boolean).join(', ')}
                                    </p>
                                )}
                            </div>
                            <span className="text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0">→</span>
                        </Link>
                    </li>
                )
            })}
        </ul>
    )
}
