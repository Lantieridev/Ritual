import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getVenueById } from '@/src/domains/venues/data'
import { routes } from '@/src/core/lib/routes'

interface VenueDetailPageProps {
    params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: VenueDetailPageProps): Promise<Metadata> {
    const { id } = await params
    const venue = await getVenueById(id)
    if (!venue) return { title: 'Sede no encontrada | RITUAL' }
    return {
        title: `${venue.name} | RITUAL`,
        description: `Historial de shows en ${venue.name}${venue.city ? `, ${venue.city}` : ''}.`,
    }
}

export default async function VenueDetailPage({ params }: VenueDetailPageProps) {
    const { id } = await params
    const venue = await getVenueById(id)

    if (!venue) notFound()

    const now = new Date()
    const pastEvents = venue.events.filter((e) => new Date(e.date) < now)
    const upcomingEvents = venue.events.filter((e) => new Date(e.date) >= now)

    return (
        <main className="min-h-screen bg-neutral-950 text-white font-sans">
            <div className="max-w-3xl mx-auto px-6 md:px-8 py-16">

                {/* Back */}
                <Link
                    href={routes.venues.list}
                    className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-white transition-colors mb-10"
                >
                    ← Sedes
                </Link>

                {/* Header */}
                <div className="mb-10">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600 mb-2">
                        {[venue.city, venue.country].filter(Boolean).join(' · ')}
                    </p>
                    <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white mb-2">
                        {venue.name}
                    </h1>
                    {venue.address && (
                        <p className="text-sm text-zinc-500">📍 {venue.address}</p>
                    )}
                </div>

                {/* Stats rápidas */}
                <div className="grid grid-cols-3 gap-4 mb-12">
                    {[
                        { label: 'Shows en total', value: venue.events.length },
                        { label: 'Pasados', value: pastEvents.length },
                        { label: 'Próximos', value: upcomingEvents.length },
                    ].map(({ label, value }) => (
                        <div key={label} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-center">
                            <p className="text-3xl font-bold text-white tabular-nums">{value}</p>
                            <p className="text-[10px] uppercase tracking-widest text-zinc-600 mt-1">{label}</p>
                        </div>
                    ))}
                </div>

                {venue.events.length === 0 ? (
                    <div className="py-16 text-center">
                        <p className="text-zinc-600">No hay shows registrados en esta sede.</p>
                    </div>
                ) : (
                    <div className="space-y-10">
                        {/* Próximos */}
                        {upcomingEvents.length > 0 && (
                            <section>
                                <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-5">Próximos</h2>
                                <EventList events={upcomingEvents} />
                            </section>
                        )}

                        {/* Pasados */}
                        {pastEvents.length > 0 && (
                            <section>
                                <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-5">Historial</h2>
                                <EventList events={pastEvents} />
                            </section>
                        )}
                    </div>
                )}
            </div>
        </main>
    )
}

function EventList({ events }: { events: Array<{ id: string; name: string | null; date: string; lineups: Array<{ artists: { name: string } }> }> }) {
    return (
        <ul className="divide-y divide-white/[0.05]">
            {events.map((ev) => {
                const dateObj = new Date(ev.date)
                const artists = ev.lineups?.map((l) => l.artists?.name).filter(Boolean) ?? []
                return (
                    <li key={ev.id}>
                        <Link
                            href={routes.events.detail(ev.id)}
                            className="group flex items-center gap-5 py-4 hover:bg-white/[0.02] -mx-3 px-3 rounded-lg transition-colors"
                        >
                            {/* Fecha */}
                            <div className="w-12 shrink-0 text-center">
                                <p className="text-[10px] font-bold text-zinc-600 uppercase">
                                    {dateObj.toLocaleDateString('es-AR', { month: 'short' })}
                                </p>
                                <p className="text-xl font-bold text-white leading-none mt-0.5">
                                    {dateObj.getDate()}
                                </p>
                                <p className="text-[10px] text-zinc-700">{dateObj.getFullYear()}</p>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-white truncate">{ev.name || artists[0] || 'Recital'}</p>
                                {artists.length > 0 && (
                                    <p className="text-xs text-zinc-600 mt-0.5 truncate">
                                        {artists.slice(0, 3).join(' · ')}{artists.length > 3 ? ` +${artists.length - 3}` : ''}
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
