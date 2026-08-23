import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { gql } from 'urql'
import { getClient } from '@/src/graphql/client'
import type { GraphQLFestival } from '@/src/core/types'
import { routes } from '@/src/core/lib/routes'
import { safeHref } from '@/src/core/lib/validation'
import { formatDate } from '@/src/core/lib/utils'
import { todayDateOnly } from '@/src/core/lib/dates'
import { FestivalAttendanceButton } from '@/src/domains/festivals/components/FestivalAttendanceButton'

const FestivalDetailQuery = gql`
  query FestivalDetail($id: ID!) {
    festival(id: $id) {
      id
      name
      edition
      startDate
      endDate
      city
      country
      website
      notes
      festivalEvents {
        id
        dayLabel
        event {
          id
          name
          date
          lineups { artist { id name } stage startTime }
        }
      }
      festivalAttendance { status rating review }
    }
  }
`

async function fetchFestival(id: string): Promise<GraphQLFestival | null> {
    const { data } = await getClient().query<{ festival: GraphQLFestival | null }>(
        FestivalDetailQuery,
        { id }
    )
    return data?.festival ?? null
}

interface FestivalDetailPageProps {
    params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: FestivalDetailPageProps): Promise<Metadata> {
    const { id } = await params
    const festival = await fetchFestival(id)
    if (!festival) return { title: 'Festival no encontrado | RITUAL' }
    return {
        title: `${festival.name} | RITUAL`,
        description: `${festival.name}${festival.edition ? ` ${festival.edition}` : ''} en RITUAL.`,
    }
}

export default async function FestivalDetailPage({ params }: FestivalDetailPageProps) {
    const { id } = await params
    const festival = await fetchFestival(id)
    if (!festival) notFound()

    const start = new Date(festival.startDate)
    const end = festival.endDate ? new Date(festival.endDate) : null
    const attendance = festival.festivalAttendance?.[0]
    const location = [festival.city, festival.country].filter(Boolean).join(', ')

    const eventsByDay = [...(festival.festivalEvents ?? [])].sort((a, b) => {
        const dateA = new Date(a.event?.date ?? '').getTime()
        const dateB = new Date(b.event?.date ?? '').getTime()
        return dateA - dateB
    })

    const allArtists = new Set(
        eventsByDay.flatMap((fe) => fe.event?.lineups?.map((l) => l.artist.name) ?? [])
    )

    const today = todayDateOnly()
    const todayIndex = eventsByDay.findIndex((fe) => fe.event?.date?.slice(0, 10) === today)
    const isRunningToday = todayIndex !== -1

    return (
        <main className="min-h-screen bg-ritual-bg text-ritual-bone">
            {/* Hero */}
            <div className="relative bg-ritual-panel border-b border-ritual-border-subtle">
                <div className="max-w-3xl mx-auto px-6 md:px-8 py-14">
                    <Link
                        href={routes.festivals.list}
                        className="inline-flex items-center gap-2 font-label text-[10px] tracking-[0.14em] uppercase text-ritual-gray-text hover:text-ritual-gray-text transition-colors mb-8"
                    >
                        ← Festivales
                    </Link>

                    <div className="flex flex-col sm:flex-row sm:items-start gap-6">
                        <div className="flex-1 min-w-0">
                            {isRunningToday && (
                                <p className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-red-hover mb-2">
                                    Día {todayIndex + 1} de {Math.max(1, eventsByDay.length)} · en curso
                                </p>
                            )}
                            <div className="flex items-center gap-3 flex-wrap mb-2">
                                {festival.edition && (
                                    <span className="font-label text-[10px] uppercase tracking-[0.1em] text-ritual-gray-text border border-ritual-border px-2.5 py-0.5">
                                        {festival.edition}
                                    </span>
                                )}
                            </div>
                            <h1 className="font-display text-5xl md:text-7xl leading-[0.85] uppercase text-ritual-bone mb-3">
                                {festival.name}
                            </h1>
                            <div className="flex flex-wrap gap-4 font-label text-xs text-ritual-gray-text">
                                <span>
                                    {formatDate(start)}
                                    {end && end.getTime() !== start.getTime() && <> — {formatDate(end, { day: 'numeric', month: 'long' })}</>}
                                </span>
                                {location && <span>{location}</span>}
                                {allArtists.size > 0 && <span>{allArtists.size} artistas</span>}
                            </div>
                        </div>

                        <FestivalAttendanceButton
                            festivalId={festival.id}
                            initialStatus={attendance?.status as 'interested' | 'going' | 'went' | undefined}
                        />
                    </div>
                </div>
            </div>

            {/* Contenido */}
            <div className="max-w-3xl mx-auto px-6 md:px-8 py-10 space-y-10">
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: 'Días', value: Math.max(1, eventsByDay.length) },
                        { label: 'Artistas', value: allArtists.size },
                        { label: 'Rating', value: attendance?.rating ? `${attendance.rating}/5` : '—' },
                    ].map(({ label, value }) => (
                        <div key={label} className="border border-ritual-border bg-ritual-surface p-4 text-center">
                            <p className="font-display text-2xl text-ritual-bone tabular-nums">{value}</p>
                            <p className="font-label text-[9px] tracking-[0.14em] uppercase text-ritual-gray-text mt-1">{label}</p>
                        </div>
                    ))}
                </div>

                {festival.notes && (
                    <section>
                        <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-3">Notas</h2>
                        <p className="font-body text-sm text-ritual-gray-light-3 leading-relaxed whitespace-pre-wrap">{festival.notes}</p>
                    </section>
                )}

                {attendance?.review && (
                    <section className="border-l-[3px] border-ritual-red pl-6">
                        <p className="font-body italic text-xl text-ritual-bone leading-snug">&ldquo;{attendance.review}&rdquo;</p>
                    </section>
                )}

                {eventsByDay.length > 0 && (
                    <section>
                        <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-5">Días del festival</h2>
                        <div className="space-y-4">
                            {eventsByDay.map((fe, i) => {
                                const ev = fe.event
                                if (!ev) return null
                                const date = new Date(ev.date)
                                const lineup = [...(ev.lineups ?? [])].sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''))
                                const isToday = i === todayIndex

                                return (
                                    <div key={fe.id} className={`border p-5 ${isToday ? 'border-ritual-red' : 'border-ritual-border'} bg-ritual-surface`}>
                                        <div className="flex items-start justify-between gap-4 mb-2">
                                            <div>
                                                {fe.dayLabel && (
                                                    <p className="font-label text-[9px] tracking-[0.14em] uppercase text-ritual-gray-text mb-1">{fe.dayLabel}</p>
                                                )}
                                                <p className="font-subtitle font-black uppercase text-ritual-bone">
                                                    {formatDate(date, { weekday: 'long', day: 'numeric', month: 'long' })}
                                                </p>
                                            </div>
                                            <Link
                                                href={routes.events.detail(ev.id)}
                                                className="shrink-0 font-label text-[10px] tracking-[0.1em] uppercase border border-ritual-border text-ritual-gray-text hover:text-ritual-bone hover:border-ritual-border-2 px-3 py-1.5 transition-colors"
                                            >
                                                Ver día →
                                            </Link>
                                        </div>
                                        {lineup.length > 0 && (
                                            <ul className="mt-3 space-y-1">
                                                {lineup.map((l, li) => (
                                                    <li key={li} className="flex items-center justify-between font-label text-xs text-ritual-gray-text">
                                                        <span>{l.artist.name}{l.stage && <span className="text-ritual-gray-text"> · {l.stage}</span>}</span>
                                                        {l.startTime && <span className="text-ritual-gray-text">{l.startTime}</span>}
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )
                            })}
                        </div>
                    </section>
                )}

                {safeHref(festival.website) && (
                    <section className="border-t border-ritual-border-subtle pt-6">
                        <a
                            href={safeHref(festival.website)!}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 font-label text-xs text-ritual-gray-text hover:text-ritual-bone transition-colors"
                        >
                            Sitio oficial del festival →
                        </a>
                    </section>
                )}
            </div>
        </main>
    )
}
