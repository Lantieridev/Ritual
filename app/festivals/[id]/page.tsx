import { notFound } from 'next/navigation'
import Link from 'next/link'
import type { Metadata } from 'next'
import { getFestivalById } from '@/src/domains/festivals/data'
import { routes } from '@/src/core/lib/routes'
import { FestivalAttendanceButton } from '@/src/domains/festivals/components/FestivalAttendanceButton'

interface FestivalDetailPageProps {
    params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: FestivalDetailPageProps): Promise<Metadata> {
    const { id } = await params
    const festival = await getFestivalById(id)
    if (!festival) return { title: 'Festival no encontrado | RITUAL' }
    return {
        title: `${festival.name} | RITUAL`,
        description: `${festival.name}${festival.edition ? ` ${festival.edition}` : ''} en RITUAL.`,
    }
}

export default async function FestivalDetailPage({ params }: FestivalDetailPageProps) {
    const { id } = await params
    const festival = await getFestivalById(id)
    if (!festival) notFound()

    const start = new Date(festival.start_date)
    const end = festival.end_date ? new Date(festival.end_date) : null
    const attendance = festival.festival_attendance?.[0]
    const location = [festival.city, festival.country].filter(Boolean).join(', ')

    // Agrupar eventos por día
    const eventsByDay = festival.festival_events?.sort((a, b) => {
        const dateA = new Date(a.events?.date ?? '').getTime()
        const dateB = new Date(b.events?.date ?? '').getTime()
        return dateA - dateB
    }) ?? []

    // Todos los artistas del festival
    const allArtists = new Set(
        eventsByDay.flatMap((fe) => fe.events?.lineups?.map((l) => l.artists.name) ?? [])
    )

    return (
        <main className="min-h-screen bg-neutral-950 text-white font-sans">
            {/* Hero */}
            <div className="relative bg-gradient-to-br from-neutral-900 to-neutral-950 border-b border-white/[0.06]">
                <div className="max-w-3xl mx-auto px-6 md:px-8 py-12">
                    <Link
                        href={routes.festivals.list}
                        className="inline-flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-6"
                    >
                        ← Festivales
                    </Link>

                    <div className="flex flex-col sm:flex-row sm:items-start gap-6">
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 flex-wrap mb-2">
                                <span className="text-3xl">🎪</span>
                                {festival.edition && (
                                    <span className="text-xs text-zinc-500 border border-white/10 rounded-full px-2.5 py-0.5">
                                        {festival.edition}
                                    </span>
                                )}
                            </div>
                            <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-3">
                                {festival.name}
                            </h1>
                            <div className="flex flex-wrap gap-4 text-sm text-zinc-400">
                                <span>
                                    📅 {start.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    {end && end.getTime() !== start.getTime() && (
                                        <> — {end.toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}</>
                                    )}
                                </span>
                                {location && <span>📍 {location}</span>}
                                {allArtists.size > 0 && <span>🎵 {allArtists.size} artistas</span>}
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

                {/* Stats */}
                <div className="grid grid-cols-3 gap-4">
                    {[
                        { label: 'Días', value: Math.max(1, eventsByDay.length) },
                        { label: 'Artistas', value: allArtists.size },
                        { label: 'Rating', value: attendance?.rating ? `${attendance.rating}/5` : '—' },
                    ].map(({ label, value }) => (
                        <div key={label} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-center">
                            <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
                            <p className="text-[10px] uppercase tracking-widest text-zinc-600 mt-1">{label}</p>
                        </div>
                    ))}
                </div>

                {/* Notas */}
                {festival.notes && (
                    <section>
                        <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">Notas</h2>
                        <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap">{festival.notes}</p>
                    </section>
                )}

                {/* Reseña */}
                {attendance?.review && (
                    <section>
                        <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-3">Tu reseña</h2>
                        <p className="text-sm text-zinc-400 leading-relaxed whitespace-pre-wrap">{attendance.review}</p>
                    </section>
                )}

                {/* Días / Eventos */}
                {eventsByDay.length > 0 && (
                    <section>
                        <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-5">Días del festival</h2>
                        <div className="space-y-4">
                            {eventsByDay.map((fe) => {
                                const ev = fe.events
                                if (!ev) return null
                                const date = new Date(ev.date)
                                const artists = ev.lineups?.map((l) => l.artists.name) ?? []

                                return (
                                    <div key={fe.id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-5">
                                        <div className="flex items-start justify-between gap-4">
                                            <div>
                                                {fe.day_label && (
                                                    <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">{fe.day_label}</p>
                                                )}
                                                <p className="font-semibold text-white">
                                                    {date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                                </p>
                                                {artists.length > 0 && (
                                                    <p className="text-sm text-zinc-500 mt-1 truncate">
                                                        {artists.slice(0, 5).join(' · ')}{artists.length > 5 ? ` +${artists.length - 5}` : ''}
                                                    </p>
                                                )}
                                            </div>
                                            <Link
                                                href={routes.events.detail(ev.id)}
                                                className="shrink-0 text-xs border border-white/15 text-zinc-400 hover:text-white hover:border-white/30 px-3 py-1.5 rounded-lg transition-colors"
                                            >
                                                Ver día →
                                            </Link>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </section>
                )}

                {/* Website */}
                {festival.website && (
                    <section className="border-t border-white/[0.06] pt-6">
                        <a
                            href={festival.website}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-2 text-sm text-zinc-400 hover:text-white transition-colors"
                        >
                            🌐 Sitio oficial del festival →
                        </a>
                    </section>
                )}
            </div>
        </main>
    )
}
