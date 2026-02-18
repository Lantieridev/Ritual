'use client'

import { useState } from 'react'
import { Tabs } from '@/src/core/components/ui/Tabs'
import { ArtistWithEvents } from '@/src/domains/artists/data'
import { FutureEvent } from '@/src/core/types'
import Link from 'next/link'
import { routes } from '@/src/core/lib/routes'
import Image from 'next/image'

interface ArtistProfileProps {
    artist: ArtistWithEvents
    bio: string
    tags: string[]
    similarArtists: any[] // Last.fm similar artist structure is loose, any is okay for now or define custom interface
    upcomingEvents: FutureEvent[] // External (Last.fm)
    internalUpcoming: ArtistWithEvents['events']
    internalPast: ArtistWithEvents['events']
    stats: {
        listeners: string | null
        spotifyFollowers: string | null
    }
}

export function ArtistProfile({
    artist,
    bio,
    tags,
    similarArtists,
    upcomingEvents,
    internalUpcoming,
    internalPast,
    stats,
}: ArtistProfileProps) {
    const [activeTab, setActiveTab] = useState('overview')

    const tabs = [
        { id: 'overview', label: 'Descripción' },
        { id: 'history', label: 'Historial' },
        { id: 'photos', label: 'Fotos' },
    ]

    // Collect photos from events
    const allPhotos = artist.events.flatMap(e =>
        e.event_photos?.map(p => ({ ...p, event: { name: e.name, date: e.date } })) || []
    )

    return (
        <div className="space-y-8">
            <Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />

            {activeTab === 'overview' && (
                <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Bio */}
                    {bio && (
                        <section>
                            <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">Biografía</h2>
                            <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-line">{bio}</p>
                        </section>
                    )}

                    {/* Similar Artists */}
                    {similarArtists.length > 0 && (
                        <section>
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

                    {/* Stats Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-white/5">
                        <StatBox label="Shows vistos" value={artist.events.length} />
                        <StatBox label="Próximos (Agenda)" value={internalUpcoming.length} />
                        {stats.listeners && <StatBox label="Oyentes Last.fm" value={stats.listeners} />}
                        {stats.spotifyFollowers && <StatBox label="Seguidores Spotify" value={stats.spotifyFollowers} />}
                    </div>
                </div>
            )}

            {activeTab === 'history' && (
                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {internalUpcoming.length > 0 && (
                        <section>
                            <h3 className="text-xs uppercase tracking-widest text-emerald-400 mb-4">Próximos en tu agenda</h3>
                            <ShowList events={internalUpcoming} />
                        </section>
                    )}

                    {upcomingEvents.length > 0 && (
                        <section>
                            <h3 className="text-xs uppercase tracking-widest text-zinc-500 mb-4 flex items-center gap-2">
                                Gira (Last.fm)
                                <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[9px] text-zinc-400">EXTERNO</span>
                            </h3>
                            <ExternalShowList events={upcomingEvents} />
                        </section>
                    )}

                    {internalPast.length > 0 && (
                        <section>
                            <h3 className="text-xs uppercase tracking-widest text-zinc-500 mb-4">Historial de shows</h3>
                            <ShowList events={internalPast} />
                        </section>
                    )}

                    {internalPast.length === 0 && internalUpcoming.length === 0 && (
                        <div className="py-12 text-center border border-dashed border-white/10 rounded-xl">
                            <p className="text-zinc-500">No tenés shows de este artista en tu historial.</p>
                            <Link href="/events/nuevo" className="text-emerald-400 hover:text-emerald-300 text-sm mt-2 inline-block">
                                + Cargar show manualmente
                            </Link>
                        </div>
                    )}
                </div>
            )}

            {activeTab === 'photos' && (
                <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {allPhotos.length > 0 ? (
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
                            {allPhotos.map((photo, i) => (
                                <div key={i} className="relative aspect-square group overflow-hidden bg-neutral-900">
                                    <Image
                                        src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/event-photos/${photo.storage_path}`}
                                        alt={photo.caption || 'Foto del show'}
                                        fill
                                        className="object-cover transition-transform duration-500 group-hover:scale-110"
                                        sizes="(max-width: 768px) 50vw, 33vw"
                                    />
                                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-4">
                                        <div>
                                            <p className="text-xs font-bold text-white">{photo.event.name}</p>
                                            <p className="text-[10px] text-zinc-300">{new Date(photo.event.date).getFullYear()}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="py-20 text-center text-zinc-600">
                            <p>No hay fotos cargadas todavía.</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

function StatBox({ label, value }: { label: string, value: string | number }) {
    return (
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-center">
            <p className="text-2xl md:text-3xl font-bold text-white tabular-nums truncate">{value}</p>
            <p className="text-[10px] uppercase tracking-widest text-zinc-600 mt-1 truncate">{label}</p>
        </div>
    )
}

function ShowList({ events }: { events: ArtistWithEvents['events'] }) {
    return (
        <ul className="divide-y divide-white/[0.05]">
            {events.map((ev) => {
                const dateObj = new Date(ev.date)
                return (
                    <li key={ev.id}>
                        <Link
                            href={routes.events.detail(ev.id)}
                            className="group flex items-center gap-5 py-3 hover:bg-white/[0.02] -mx-2 px-2 rounded-lg transition-colors"
                        >
                            <div className="w-10 shrink-0 text-center">
                                <p className="text-[10px] font-bold text-zinc-600 uppercase">
                                    {dateObj.toLocaleDateString('es-AR', { month: 'short' })}
                                </p>
                                <p className="text-lg font-bold text-white leading-none mt-0.5">
                                    {dateObj.getDate()}
                                </p>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-white truncate text-sm">{ev.name || 'Recital'}</p>
                                {ev.venues && (
                                    <p className="text-xs text-zinc-600 mt-0.5 truncate">
                                        📍 {[ev.venues.name, ev.venues.city].filter(Boolean).join(', ')}
                                    </p>
                                )}
                            </div>
                        </Link>
                    </li>
                )
            })}
        </ul>
    )
}

function ExternalShowList({ events }: { events: FutureEvent[] }) {
    return (
        <ul className="divide-y divide-white/[0.05]">
            {events.map((ev) => {
                const dateObj = new Date(ev.datetime)
                return (
                    <li key={ev.id}>
                        <div className="flex items-center gap-5 py-3 -mx-2 px-2 text-zinc-400">
                            <div className="w-10 shrink-0 text-center opacity-70">
                                <p className="text-[10px] font-bold uppercase">
                                    {dateObj.toLocaleDateString('es-AR', { month: 'short' })}
                                </p>
                                <p className="text-lg font-bold leading-none mt-0.5">
                                    {dateObj.getDate()}
                                </p>
                            </div>
                            <div className="flex-1 min-w-0">
                                <p className="font-medium text-zinc-300 truncate text-sm">{ev.title}</p>
                                <p className="text-xs text-zinc-600 mt-0.5 truncate">
                                    📍 {[ev.venue.name, ev.venue.city, ev.venue.country].filter(Boolean).join(', ')}
                                </p>
                            </div>
                            {ev.url && (
                                <a href={ev.url} target="_blank" rel="noopener noreferrer" className="text-xs border border-white/10 px-2 py-1 rounded hover:bg-white/10">
                                    Tickets
                                </a>
                            )}
                        </div>
                    </li>
                )
            })}
        </ul>
    )
}
