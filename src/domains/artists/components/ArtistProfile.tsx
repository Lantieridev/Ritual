import type { ArtistWithEvents } from '@/src/domains/artists/service'
import type { BestNight } from '@/src/domains/artists/enrichment'
import { FutureEvent } from '@/src/core/types'
import Link from 'next/link'
import { routes } from '@/src/core/lib/routes'
import { formatDate } from '@/src/core/lib/utils'
import { eventYear } from '@/src/core/lib/dates'
import { StarRating } from '@/src/core/components/ui'

interface ArtistProfileProps {
    artist: ArtistWithEvents
    bio: string
    similarArtists: { name: string }[] // Last.fm returns more fields, but only `name` is used here
    upcomingEvents: FutureEvent[] // External (Ticketmaster)
    internalUpcoming: ArtistWithEvents['events']
    internalPast: ArtistWithEvents['events']
    timesSeen: number
    averageRating: number | null
    bestNight: BestNight | null
    stats: {
        listeners: string | null
        spotifyFollowers: string | null
    }
}

const MAX_RECENT_NIGHTS = 6

export function ArtistProfile({
    artist,
    bio,
    similarArtists,
    upcomingEvents,
    internalUpcoming,
    internalPast,
    timesSeen,
    averageRating,
    bestNight,
    stats,
}: ArtistProfileProps) {
    const attendedPast = internalPast.filter((e) => e.attendance?.[0]?.status === 'went')
    const recentNights = attendedPast.slice(0, MAX_RECENT_NIGHTS)
    const venuesSeenAt = [...new Set(attendedPast.map((e) => e.venues?.name).filter((v): v is string => Boolean(v)))]

    return (
        <div className="space-y-14">
            {/* Próximas funciones — lo que se viene va primero */}
            {(internalUpcoming.length > 0 || upcomingEvents.length > 0) && (
                <section>
                    <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-4">Próximas funciones</h2>
                    <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {internalUpcoming.map((ev) => (
                            <Link
                                key={ev.id}
                                href={routes.events.detail(ev.id)}
                                className="block border border-ritual-border bg-ritual-surface p-5 hover:border-ritual-border-2 transition-colors"
                            >
                                <p className="font-display text-4xl uppercase text-ritual-red-hover">{formatDate(ev.date, { day: 'numeric', month: 'short' })}</p>
                                <p className="font-subtitle font-black uppercase text-ritual-bone mt-2">{ev.venues?.name ?? 'Sede por confirmar'}</p>
                                {ev.venues?.city && <p className="font-label text-xs text-ritual-gray-text mt-1">{ev.venues.city}</p>}
                            </Link>
                        ))}
                        {upcomingEvents.slice(0, 3 - internalUpcoming.length).map((ev) => (
                            <div key={ev.id} className="border border-dashed border-ritual-border p-5">
                                <p className="font-display text-4xl uppercase text-ritual-gray-text">{formatDate(ev.datetime, { day: 'numeric', month: 'short' })}</p>
                                <p className="font-subtitle font-black uppercase text-ritual-gray-light-3 mt-2">{ev.venue.name}</p>
                                <div className="flex items-center justify-between mt-1">
                                    <p className="font-label text-xs text-ritual-gray-text">{[ev.venue.city, ev.venue.country].filter(Boolean).join(', ')}</p>
                                    {ev.url && (
                                        <a href={ev.url} target="_blank" rel="noopener noreferrer" className="font-label text-[10px] text-ritual-red-hover uppercase tracking-[0.1em]">
                                            Tickets →
                                        </a>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </section>
            )}

            {/* La cita de la mejor noche */}
            {bestNight?.review && (
                <section className="border-l-[3px] border-ritual-red pl-6">
                    <p className="font-body italic text-2xl md:text-3xl leading-snug text-ritual-bone">&ldquo;{bestNight.review}&rdquo;</p>
                    <p className="font-label text-[10px] tracking-[0.14em] uppercase text-ritual-gray-text mt-3">
                        {formatDate(bestNight.event.date, { day: 'numeric', month: 'long', year: 'numeric' })}
                        {bestNight.event.venues && ` · ${bestNight.event.venues.name}`}
                    </p>
                </section>
            )}

            {/* Bio */}
            {bio && (
                <section>
                    <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-4">Biografía</h2>
                    <p className="font-body text-sm text-ritual-gray-light-3 leading-relaxed whitespace-pre-line">{bio}</p>
                </section>
            )}

            {/* Las veces que fuiste */}
            {recentNights.length > 0 && (
                <section>
                    <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-4">
                        Las {timesSeen} {timesSeen === 1 ? 'vez' : 'veces'} que fuiste
                    </h2>
                    <ul className="divide-y divide-ritual-border-subtle">
                        {recentNights.map((ev) => {
                            const rating = ev.attendance?.[0]?.rating
                            const isBest = bestNight?.event.id === ev.id
                            return (
                                <li key={ev.id}>
                                    <Link href={routes.events.detail(ev.id)} className="flex items-center gap-4 py-3">
                                        <span className="font-figure text-2xl text-ritual-gray-text w-16 shrink-0">{eventYear(ev.date)}</span>
                                        <div className="flex-1 min-w-0">
                                            <p className={`font-subtitle font-black uppercase truncate ${isBest ? 'text-ritual-bone' : 'text-ritual-gray-light-3'}`}>
                                                {ev.venues?.name ?? 'Recital'}
                                            </p>
                                        </div>
                                        {rating != null && <StarRating value={rating} size="xs" />}
                                    </Link>
                                </li>
                            )
                        })}
                    </ul>
                </section>
            )}

            {/* Dónde las viste + del mismo palo */}
            <div className="grid sm:grid-cols-2 gap-10">
                {venuesSeenAt.length > 0 && (
                    <section>
                        <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-4">Dónde las viste</h2>
                        <div className="flex flex-wrap gap-2">
                            {venuesSeenAt.map((name) => (
                                <span key={name} className="font-label text-xs text-ritual-gray-text border border-ritual-border px-3 py-1.5">{name}</span>
                            ))}
                        </div>
                    </section>
                )}
                {similarArtists.length > 0 && (
                    <section>
                        <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-4">Del mismo palo</h2>
                        <div className="flex flex-wrap gap-2">
                            {similarArtists.map((similar) => (
                                <span key={similar.name} className="font-label text-xs text-ritual-gray-text border border-ritual-border px-3 py-1.5">{similar.name}</span>
                            ))}
                        </div>
                    </section>
                )}
            </div>

            {/* Stats de referencia */}
            {(stats.listeners || stats.spotifyFollowers || averageRating != null) && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-6 border-t border-ritual-border-subtle">
                    <StatBox label="Shows vistos" value={timesSeen} />
                    {averageRating != null && <StatBox label="Tu promedio" value={averageRating.toFixed(1)} />}
                    {stats.listeners && <StatBox label="Oyentes Last.fm" value={stats.listeners} />}
                    {stats.spotifyFollowers && <StatBox label="Seguidores Spotify" value={stats.spotifyFollowers} />}
                </div>
            )}

            {timesSeen === 0 && (
                <p className="font-body text-sm text-ritual-gray-text">
                    Todavía no tenés shows de {artist.name} en tu archivo.{' '}
                    <Link href={routes.events.new} className="text-ritual-red-hover underline underline-offset-4">Cargar uno</Link>.
                </p>
            )}
        </div>
    )
}

function StatBox({ label, value }: { label: string, value: string | number }) {
    return (
        <div className="border border-ritual-border bg-ritual-surface p-4 text-center">
            <p className="font-display text-3xl text-ritual-bone tabular-nums truncate">{value}</p>
            <p className="font-label text-[9px] tracking-[0.14em] uppercase text-ritual-gray-text mt-1 truncate">{label}</p>
        </div>
    )
}
