import type { Metadata } from 'next'
import Link from 'next/link'
import { getPersonalStats } from '@/src/domains/stats/data'
import { buildWrappedSummary } from '@/src/domains/stats/wrapped-view'
import { getEventsWithAttendance } from '@/src/domains/events/data'
import { routes } from '@/src/core/lib/routes'
import { parseYearParam } from '@/src/core/lib/validation'
import { formatDate } from '@/src/core/lib/utils'
import { StarRating } from '@/src/core/components/ui'

export const metadata: Metadata = {
    title: 'Tu Wrapped | RITUAL',
    description: 'Tu resumen musical anual — los shows, artistas y momentos del año.',
}

interface PageProps {
    searchParams: Promise<{ year?: string }>
}

export default async function WrappedPage({ searchParams }: PageProps) {
    const { year: yearParam } = await searchParams
    const currentYear = new Date().getFullYear()
    const selectedYear = parseYearParam(yearParam, currentYear)

    const [stats, allEvents] = await Promise.all([
        getPersonalStats(),
        getEventsWithAttendance(),
    ])

    const {
        attendedThisYear,
        uniqueArtists,
        uniqueVenues,
        totalRated,
        topArtists: topArtistsThisYear,
        topVenues: topVenuesThisYear,
        avgRating: avgRatingThisYear,
        busiestMonth,
        availableYears,
        hasData,
    } = buildWrappedSummary(allEvents, stats, selectedYear)

    return (
        <main className="min-h-screen bg-neutral-950 text-white font-sans">
            <div className="max-w-2xl mx-auto px-6 md:px-8 py-16">

                {/* Header */}
                <div className="mb-10">
                    <Link
                        href={routes.stats}
                        className="text-sm text-zinc-500 hover:text-zinc-300 transition-colors mb-4 inline-block"
                    >
                        ← Stats
                    </Link>
                    <div className="flex items-end gap-4 flex-wrap">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">Tu resumen</p>
                            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                                {selectedYear} <span className="text-zinc-600">Wrapped</span>
                            </h1>
                        </div>
                        {/* Selector de año */}
                        {availableYears.length > 1 && (
                            <div className="flex gap-1.5 flex-wrap ml-auto">
                                {availableYears.map((y) => (
                                    <Link
                                        key={y}
                                        href={`/wrapped?year=${y}`}
                                        className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${y === selectedYear
                                            ? 'bg-white text-neutral-950 font-semibold'
                                            : 'border border-white/10 text-zinc-500 hover:text-zinc-300'
                                            }`}
                                    >
                                        {y}
                                    </Link>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {!hasData ? (
                    <div className="py-20 text-center">
                        <p className="text-zinc-500 text-lg mb-2">Sin shows en {selectedYear}</p>
                        <p className="text-zinc-700 text-sm">
                            Marcá shows como &quot;Fui&quot; para verlos en tu Wrapped.
                        </p>
                        <Link
                            href={routes.home}
                            className="inline-block mt-6 text-sm text-zinc-400 hover:text-white transition-colors underline underline-offset-4"
                        >
                            Ver mis recitales →
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-8">

                        {/* Hero stat */}
                        <div className="rounded-2xl border border-white/[0.08] bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-8 text-center">
                            <p className="text-7xl font-bold text-white tabular-nums mb-2">
                                {attendedThisYear.length}
                            </p>
                            <p className="text-zinc-400 text-lg">
                                show{attendedThisYear.length !== 1 ? 's' : ''} en {selectedYear}
                            </p>
                            {avgRatingThisYear && (
                                <div className="flex justify-center items-center gap-1 mt-3">
                                    <StarRating value={Math.round(parseFloat(avgRatingThisYear))} size="lg" />
                                    <span className="text-zinc-500 text-sm ml-1 self-center">{avgRatingThisYear} promedio</span>
                                </div>
                            )}
                        </div>

                        {/* Grid de stats */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {([
                                { label: 'Artistas únicos', value: uniqueArtists },
                                { label: 'Venues distintos', value: uniqueVenues },
                                { label: 'Shows con rating', value: totalRated },
                                ...(busiestMonth ? [{ label: 'Mes más activo', value: busiestMonth }] : []),
                                { label: 'Shows en total (histórico)', value: stats.showsAttended },
                                { label: 'Artistas únicos (histórico)', value: stats.uniqueArtists },
                            ] as { label: string; value: string | number }[]).map(({ label, value }) => (
                                <div key={label} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-4">
                                    <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
                                    <p className="text-[10px] uppercase tracking-widest text-zinc-600 mt-1 leading-tight">{label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Top artistas */}
                        {topArtistsThisYear.length > 0 && (
                            <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
                                <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-5">
                                    Tus artistas del año
                                </h2>
                                <ol className="space-y-3">
                                    {topArtistsThisYear.map(([name, count], i) => (
                                        <li key={name} className="flex items-center gap-4">
                                            <span className="text-2xl font-bold text-zinc-700 tabular-nums w-6 shrink-0">
                                                {i + 1}
                                            </span>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-white truncate">{name}</p>
                                                <div className="mt-1 h-1 bg-white/[0.06] rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-white rounded-full transition-all"
                                                        style={{ width: `${(count / topArtistsThisYear[0][1]) * 100}%` }}
                                                    />
                                                </div>
                                            </div>
                                            <span className="text-sm text-zinc-500 shrink-0">
                                                {count} show{count !== 1 ? 's' : ''}
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                            </section>
                        )}

                        {/* Top venues */}
                        {topVenuesThisYear.length > 0 && (
                            <section className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6">
                                <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-5">
                                    Tus venues del año
                                </h2>
                                <ol className="space-y-3">
                                    {topVenuesThisYear.map(([name, count], i) => (
                                        <li key={name} className="flex items-center gap-4">
                                            <span className="text-2xl font-bold text-zinc-700 tabular-nums w-6 shrink-0">
                                                {i + 1}
                                            </span>
                                            <p className="flex-1 font-semibold text-white truncate">{name}</p>
                                            <span className="text-sm text-zinc-500 shrink-0">
                                                {count}×
                                            </span>
                                        </li>
                                    ))}
                                </ol>
                            </section>
                        )}

                        {/* Timeline del año */}
                        <section>
                            <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-5">
                                Todos los shows de {selectedYear}
                            </h2>
                            <ul className="divide-y divide-white/[0.04]">
                                {attendedThisYear
                                    .map((ev) => {
                                        const date = new Date(ev.date)
                                        const artists = ev.lineups?.map((l) => l.artists.name) ?? []
                                        const rating = ev.attendance?.[0]?.rating

                                        return (
                                            <li key={ev.id}>
                                                <Link
                                                    href={routes.events.detail(ev.id)}
                                                    className="group flex items-center gap-4 py-3 hover:bg-white/[0.02] -mx-3 px-3 rounded-lg transition-colors"
                                                >
                                                    <div className="w-10 shrink-0 text-center">
                                                        <p className="text-[10px] font-bold text-zinc-600 uppercase">
                                                            {formatDate(date, { month: 'short' })}
                                                        </p>
                                                        <p className="text-lg font-bold text-white leading-none">
                                                            {date.getDate()}
                                                        </p>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-white truncate text-sm">
                                                            {ev.name || artists[0] || 'Recital'}
                                                        </p>
                                                        {ev.venues && (
                                                            <p className="text-xs text-zinc-600 truncate">
                                                                {ev.venues.name}
                                                            </p>
                                                        )}
                                                    </div>
                                                    {rating && (
                                                        <StarRating value={rating} size="xs" className="shrink-0" />
                                                    )}
                                                    <span className="text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0 text-sm">→</span>
                                                </Link>
                                            </li>
                                        )
                                    })}
                            </ul>
                        </section>
                    </div>
                )}
            </div>
        </main>
    )
}
