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
} from '@/src/core/lib/lastfm'

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

    // Enriquecer con Spotify y Last.fm en paralelo
    const [spotifyResult, lastfmResult] = await Promise.allSettled([
        isSpotifyConfigured() ? searchSpotifyArtist(artist.name) : Promise.resolve({ artist: null }),
        isLastFmConfigured() ? getLastFmArtistInfo(artist.name) : Promise.resolve({ artist: null }),
    ])

    const spotifyArtist = spotifyResult.status === 'fulfilled' ? spotifyResult.value.artist : null
    const lastfmArtist = lastfmResult.status === 'fulfilled' ? lastfmResult.value.artist : null

    const heroImage = spotifyArtist
        ? getBestSpotifyImage(spotifyArtist.images)
        : lastfmArtist
            ? getBestLastFmImage(lastfmArtist.image)
            : null

    const tags = lastfmArtist ? getLastFmTags(lastfmArtist, 5) : artist.genre ? [artist.genre] : []

    // Limpiar bio de Last.fm (viene con HTML y links)
    const rawBio = lastfmArtist?.bio?.summary ?? ''
    const bio = rawBio
        .replace(/<a[^>]*>.*?<\/a>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 400)

    const listeners = lastfmArtist?.stats?.listeners
        ? Number(lastfmArtist.stats.listeners).toLocaleString('es-AR')
        : null

    const now = new Date()
    const pastEvents = artist.events.filter((e) => new Date(e.date) < now)
    const upcomingEvents = artist.events.filter((e) => new Date(e.date) >= now)

    return (
        <main className="min-h-screen bg-neutral-950 text-white font-sans">
            {/* Hero */}
            <div className="relative h-64 md:h-80 w-full overflow-hidden bg-neutral-900">
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
                <div className="absolute inset-0 bg-gradient-to-t from-neutral-950 via-neutral-950/50 to-transparent" />

                {/* Back nav */}
                <div className="absolute top-0 left-0 right-0 p-6">
                    <Link
                        href={routes.artists.list}
                        className="inline-flex items-center gap-2 text-sm text-zinc-300 hover:text-white transition-colors bg-black/30 backdrop-blur-sm rounded-lg px-3 py-1.5"
                    >
                        ← Artistas
                    </Link>
                </div>

                {/* Nombre sobre la imagen */}
                <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
                        {artist.name}
                    </h1>
                </div>
            </div>

            {/* Contenido */}
            <div className="max-w-3xl mx-auto px-6 md:px-8 py-10 space-y-10">

                {/* Tags y stats */}
                <div className="flex flex-wrap items-center gap-4">
                    {tags.length > 0 && (
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
                    )}
                    {listeners && (
                        <p className="text-xs text-zinc-600">
                            {listeners} oyentes en Last.fm
                        </p>
                    )}
                </div>

                {/* Bio */}
                {bio && (
                    <section>
                        <p className="text-sm text-zinc-400 leading-relaxed">{bio}{bio.length >= 400 ? '…' : ''}</p>
                    </section>
                )}

                {/* Stats de shows */}
                <div className="grid grid-cols-3 gap-4 border-t border-white/[0.06] pt-8">
                    {[
                        { label: 'Shows en total', value: artist.events.length },
                        { label: 'Pasados', value: pastEvents.length },
                        { label: 'Próximos', value: upcomingEvents.length },
                    ].map(({ label, value }) => (
                        <div key={label} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-center">
                            <p className="text-3xl font-bold text-white tabular-nums">{value}</p>
                            <p className="text-[10px] uppercase tracking-widest text-zinc-600 mt-1">{label}</p>
                        </div>
                    ))}
                </div>

                {/* Shows */}
                {artist.events.length === 0 ? (
                    <div className="py-12 text-center border-t border-white/[0.06]">
                        <p className="text-zinc-600 text-sm">No hay shows registrados para este artista.</p>
                        <Link
                            href={routes.events.search}
                            className="inline-block mt-4 text-sm text-zinc-400 hover:text-white transition-colors underline underline-offset-4"
                        >
                            Buscar shows en Ticketmaster →
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-8 border-t border-white/[0.06] pt-8">
                        {upcomingEvents.length > 0 && (
                            <section>
                                <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-5">Próximos</h2>
                                <ShowList events={upcomingEvents} />
                            </section>
                        )}
                        {pastEvents.length > 0 && (
                            <section>
                                <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-5">Historial</h2>
                                <ShowList events={pastEvents} />
                            </section>
                        )}
                    </div>
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
