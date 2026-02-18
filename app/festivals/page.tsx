import type { Metadata } from 'next'
import Link from 'next/link'
import { getFestivals } from '@/src/domains/festivals/data'
import { routes } from '@/src/core/lib/routes'
import { PageShell } from '@/src/core/components/layout'
import { LinkButton } from '@/src/core/components/ui'

export const metadata: Metadata = {
    title: 'Festivales | RITUAL',
    description: 'Tus festivales de música — pasados y futuros.',
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
    interested: { label: 'Me interesa', className: 'bg-zinc-800 text-zinc-400 border-zinc-700' },
    going: { label: 'Voy', className: 'bg-white/10 text-zinc-200 border-white/20' },
    went: { label: 'Fui ✓', className: 'bg-white text-neutral-950 border-white' },
}

export default async function FestivalsPage() {
    const festivals = await getFestivals()
    const now = new Date()

    const upcoming = festivals.filter((f) => new Date(f.start_date) >= now)
    const past = festivals.filter((f) => new Date(f.start_date) < now)

    return (
        <PageShell
            title="Festivales"
            description="Tus festivales de música"
            action={
                <LinkButton href={routes.festivals.new} variant="secondary" className="px-4 py-2 text-sm">
                    + Nuevo festival
                </LinkButton>
            }
        >
            {festivals.length === 0 && (
                <div className="flex flex-col items-center gap-5 py-24 text-center">
                    <div className="flex h-20 w-20 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03]">
                        <span className="text-3xl">🎪</span>
                    </div>
                    <div>
                        <p className="text-lg font-semibold text-zinc-300 mb-1">Todavía no hay festivales</p>
                        <p className="text-sm text-zinc-600 max-w-xs">
                            Registrá los festivales a los que fuiste o que querés ir.
                        </p>
                    </div>
                    <LinkButton href={routes.festivals.new} variant="primary" className="px-5 py-2.5 text-sm">
                        + Agregar festival
                    </LinkButton>
                </div>
            )}

            {upcoming.length > 0 && (
                <section className="mb-10">
                    <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-5 flex items-center gap-3">
                        Próximos
                        <div className="flex-1 h-px bg-white/[0.06]" />
                    </h2>
                    <FestivalList festivals={upcoming} />
                </section>
            )}

            {past.length > 0 && (
                <section>
                    <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-5 flex items-center gap-3">
                        Historial
                        <div className="flex-1 h-px bg-white/[0.06]" />
                    </h2>
                    <FestivalList festivals={past} />
                </section>
            )}
        </PageShell>
    )
}

function FestivalList({ festivals }: { festivals: Awaited<ReturnType<typeof getFestivals>> }) {
    return (
        <ul className="divide-y divide-white/[0.04]">
            {festivals.map((festival) => {
                const start = new Date(festival.start_date)
                const end = festival.end_date ? new Date(festival.end_date) : null
                const attendance = festival.festival_attendance?.[0]
                const status = attendance?.status
                const totalArtists = new Set(
                    festival.festival_events?.flatMap((fe) =>
                        fe.events?.lineups?.map((l) => l.artists.name) ?? []
                    ) ?? []
                ).size
                const location = [festival.city, festival.country].filter(Boolean).join(', ')

                return (
                    <li key={festival.id}>
                        <Link
                            href={routes.festivals.detail(festival.id)}
                            className="group flex items-start gap-5 py-5 hover:bg-white/[0.02] -mx-3 px-3 rounded-lg transition-colors"
                        >
                            {/* Fecha */}
                            <div className="w-14 shrink-0 text-center pt-0.5">
                                <p className="text-xs font-bold text-zinc-500 uppercase">
                                    {start.toLocaleDateString('es-AR', { month: 'short' })}
                                </p>
                                <p className="text-2xl font-bold text-white leading-none mt-0.5">
                                    {start.getDate()}
                                </p>
                                <p className="text-[10px] text-zinc-700">{start.getFullYear()}</p>
                            </div>

                            {/* Info */}
                            <div className="flex-1 min-w-0">
                                <div className="flex items-start gap-2 flex-wrap">
                                    <p className="font-bold text-white text-lg leading-tight truncate">
                                        {festival.name}
                                    </p>
                                    {festival.edition && (
                                        <span className="text-xs text-zinc-500 mt-0.5">{festival.edition}</span>
                                    )}
                                    {status && STATUS_BADGE[status] && (
                                        <span className={`inline-block text-[10px] font-semibold uppercase tracking-widest border rounded px-1.5 py-0.5 shrink-0 ${STATUS_BADGE[status].className}`}>
                                            {STATUS_BADGE[status].label}
                                        </span>
                                    )}
                                </div>
                                {location && (
                                    <p className="text-sm text-zinc-500 mt-0.5">📍 {location}</p>
                                )}
                                <div className="flex gap-4 mt-1.5">
                                    {end && (
                                        <p className="text-xs text-zinc-600">
                                            Hasta el {end.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                                        </p>
                                    )}
                                    {festival.festival_events?.length > 0 && (
                                        <p className="text-xs text-zinc-600">
                                            {festival.festival_events.length} día{festival.festival_events.length !== 1 ? 's' : ''}
                                            {totalArtists > 0 && ` · ${totalArtists} artistas`}
                                        </p>
                                    )}
                                    {attendance?.rating && (
                                        <div className="flex gap-0.5">
                                            {[1, 2, 3, 4, 5].map((s) => (
                                                <span key={s} className={`text-xs ${s <= attendance.rating! ? 'text-white' : 'text-zinc-700'}`}>★</span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <span className="text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0 pt-1">→</span>
                        </Link>
                    </li>
                )
            })}
        </ul>
    )
}
