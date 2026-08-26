import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { gql } from 'urql'
import { getClient } from '@/src/graphql/client'
import type { GraphQLVenueEvent, GraphQLVenueWithEvents } from '@/src/core/types'
import { routes } from '@/src/core/lib/routes'
import { isPastEvent } from '@/src/core/lib/dates'
import { formatDate } from '@/src/core/lib/utils'

const VenueDetailQuery = gql`
  query VenueDetail($id: ID!) {
    venue(id: $id) {
      id
      name
      city
      country
      address
      events {
        id
        name
        date
        lineups { artist { name } }
        attendance { status }
      }
    }
  }
`

async function fetchVenue(id: string): Promise<GraphQLVenueWithEvents | null> {
    const { data } = await getClient().query<{ venue: GraphQLVenueWithEvents | null }>(
        VenueDetailQuery,
        { id }
    ).toPromise()
    return data?.venue ?? null
}

interface VenueDetailPageProps {
    params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: VenueDetailPageProps): Promise<Metadata> {
    const { id } = await params
    const venue = await fetchVenue(id)
    if (!venue) return { title: 'Sede no encontrada | RITUAL' }
    return {
        title: `${venue.name} | RITUAL`,
        description: `Historial de shows en ${venue.name}${venue.city ? `, ${venue.city}` : ''}.`,
    }
}

export default async function VenueDetailPage({ params }: VenueDetailPageProps) {
    const { id } = await params
    const venue = await fetchVenue(id)

    if (!venue) notFound()

    const pastEvents = venue.events.filter((e) => isPastEvent(e.date))
    const upcomingEvents = venue.events.filter((e) => !isPastEvent(e.date))
    const nightsHere = venue.events.filter((e) => e.attendance?.[0]?.status === 'went').length

    return (
        <main className="min-h-screen bg-ritual-bg text-ritual-bone">
            <div className="max-w-3xl mx-auto px-6 md:px-8 py-16">
                <Link
                    href={routes.venues.list}
                    className="inline-flex items-center gap-2 font-label text-[10px] tracking-[0.14em] uppercase text-ritual-gray-text hover:text-ritual-gray-text transition-colors mb-10"
                >
                    ← Sedes
                </Link>

                <div className="mb-10">
                    <p className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-2">
                        {[venue.city, venue.country].filter(Boolean).join(' · ')}
                    </p>
                    <h1 className="font-display text-6xl md:text-8xl leading-[0.85] uppercase text-ritual-bone mb-2">
                        {venue.name}
                    </h1>
                    {nightsHere > 0 && (
                        <p className="font-label text-[11px] tracking-[0.1em] uppercase text-ritual-red-hover mt-3">
                            {nightsHere} {nightsHere === 1 ? 'noche tuya' : 'noches tuyas'} acá
                        </p>
                    )}
                    {venue.address && <p className="font-body text-sm text-ritual-gray-text mt-2">📍 {venue.address}</p>}
                </div>

                <div className="grid grid-cols-3 gap-4 mb-12">
                    {[
                        { label: 'Shows en total', value: venue.events.length },
                        { label: 'Pasados', value: pastEvents.length },
                        { label: 'Próximos', value: upcomingEvents.length },
                    ].map(({ label, value }) => (
                        <div key={label} className="border border-ritual-border bg-ritual-surface p-4 text-center">
                            <p className="font-display text-3xl text-ritual-bone tabular-nums">{value}</p>
                            <p className="font-label text-[9px] tracking-[0.14em] uppercase text-ritual-gray-text mt-1">{label}</p>
                        </div>
                    ))}
                </div>

                {/* El plano — depende de una columna de zona/sector que no existe todavía en attendance */}
                <div className="border border-dashed border-ritual-border p-5 mb-12">
                    <p className="font-label text-[10px] tracking-[0.14em] uppercase text-ritual-gray-text">
                        El plano del lugar, con un punto por visita, todavía no está — necesita guardar en qué zona
                        estuviste cada noche, y esa columna no existe todavía en el modelo de datos.
                    </p>
                </div>

                {venue.events.length === 0 ? (
                    <div className="py-16 text-center">
                        <p className="font-body text-ritual-gray-text">No hay shows registrados en esta sede.</p>
                    </div>
                ) : (
                    <div className="space-y-10">
                        {upcomingEvents.length > 0 && (
                            <section>
                                <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-5">Próximos</h2>
                                <EventList events={upcomingEvents} />
                            </section>
                        )}
                        {pastEvents.length > 0 && (
                            <section>
                                <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-5">Tus noches acá</h2>
                                <EventList events={pastEvents} />
                            </section>
                        )}
                    </div>
                )}
            </div>
        </main>
    )
}

function EventList({ events }: { events: GraphQLVenueEvent[] }) {
    return (
        <ul className="divide-y divide-ritual-border-subtle">
            {events.map((ev) => {
                const dateObj = new Date(ev.date)
                const artists = ev.lineups?.map((l) => l.artist?.name).filter(Boolean) ?? []
                return (
                    <li key={ev.id}>
                        <Link
                            href={routes.events.detail(ev.id)}
                            className="group flex items-center gap-5 py-4 transition-colors"
                        >
                            <div className="w-12 shrink-0 text-center">
                                <p className="font-label text-[10px] font-bold text-ritual-gray-text uppercase">
                                    {formatDate(dateObj, { month: 'short' })}
                                </p>
                                <p className="font-display text-2xl text-ritual-bone leading-none mt-0.5">
                                    {dateObj.getDate()}
                                </p>
                                <p className="font-label text-[9px] text-ritual-gray-text">{dateObj.getFullYear()}</p>
                            </div>

                            <div className="flex-1 min-w-0">
                                <p className="font-dense font-extrabold text-ritual-bone truncate">{ev.name || artists[0] || 'Recital'}</p>
                                {artists.length > 0 && (
                                    <p className="font-label text-xs text-ritual-gray-text mt-0.5 truncate">
                                        {artists.slice(0, 3).join(' · ')}{artists.length > 3 ? ` +${artists.length - 3}` : ''}
                                    </p>
                                )}
                            </div>

                            <span className="font-label text-[10px] tracking-[0.1em] uppercase text-ritual-red-hover opacity-0 group-hover:opacity-100 transition-opacity shrink-0">Ver →</span>
                        </Link>
                    </li>
                )
            })}
        </ul>
    )
}
