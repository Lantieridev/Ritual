import type { Metadata } from 'next'
import Link from 'next/link'
import { getPersonalStats } from '@/src/domains/stats/data'
import { routes } from '@/src/core/lib/routes'

export const metadata: Metadata = {
    title: 'Mis estadísticas | RITUAL',
    description: 'Tu historial musical en números: shows, artistas, ciudades y más.',
}

export default async function StatsPage() {
    const stats = await getPersonalStats()

    const years = Object.keys(stats.showsByYear).sort((a, b) => Number(b) - Number(a))
    const maxShowsInYear = Math.max(...Object.values(stats.showsByYear), 1)

    const hasData = stats.totalShows > 0

    return (
        <main className="min-h-screen bg-neutral-950 text-white font-sans">
            <div className="max-w-4xl mx-auto px-6 md:px-8 py-16">

                {/* Header */}
                <div className="mb-12 flex items-start justify-between gap-4 flex-wrap">
                    <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-600 mb-2">
                            Tu perfil musical
                        </p>
                        <h1 className="text-4xl md:text-5xl font-bold tracking-tight text-white">
                            Estadísticas
                        </h1>
                    </div>
                    <Link
                        href={routes.wrapped}
                        className="inline-flex items-center gap-2 rounded-xl border border-white/15 px-4 py-2.5 text-sm font-semibold text-zinc-300 hover:border-white/30 hover:text-white hover:bg-white/5 transition-colors mt-1"
                    >
                        🎵 Ver Wrapped
                    </Link>
                </div>

                {!hasData ? (
                    <div className="flex flex-col items-center gap-5 py-24 text-center">
                        <div className="text-6xl">📊</div>
                        <div>
                            <p className="text-lg font-semibold text-zinc-300 mb-1">Todavía no hay datos</p>
                            <p className="text-sm text-zinc-600">Agregá recitales para ver tus estadísticas.</p>
                        </div>
                        <Link
                            href={routes.events.search}
                            className="inline-flex items-center justify-center rounded-lg bg-white px-6 py-2.5 text-sm font-semibold text-neutral-950 hover:bg-zinc-100 transition-colors"
                        >
                            Buscar shows
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-12">

                        {/* KPIs principales */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: 'Shows en total', value: stats.totalShows, sub: null },
                                { label: 'Fui', value: stats.showsAttended, sub: null },
                                { label: 'Voy a ir', value: stats.showsGoing, sub: null },
                                { label: 'Me interesa', value: stats.showsInterested, sub: null },
                            ].map(({ label, value, sub }) => (
                                <div
                                    key={label}
                                    className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-5"
                                >
                                    <p className="text-3xl md:text-4xl font-bold text-white tabular-nums">{value}</p>
                                    <p className="text-xs uppercase tracking-widest text-zinc-500 mt-1">{label}</p>
                                    {sub && <p className="text-xs text-zinc-600 mt-0.5">{sub}</p>}
                                </div>
                            ))}
                        </div>

                        {/* Fila: artistas / venues / ciudades / países */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {[
                                { label: 'Artistas únicos', value: stats.uniqueArtists },
                                { label: 'Venues únicos', value: stats.uniqueVenues },
                                { label: 'Ciudades', value: stats.uniqueCities.length },
                                { label: 'Países', value: stats.uniqueCountries.length },
                            ].map(({ label, value }) => (
                                <div key={label} className="rounded-xl border border-white/[0.06] p-5">
                                    <p className="text-2xl font-bold text-white tabular-nums">{value}</p>
                                    <p className="text-xs uppercase tracking-widest text-zinc-600 mt-1">{label}</p>
                                </div>
                            ))}
                        </div>

                        {/* Rating promedio */}
                        {stats.averageRating !== null && (
                            <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 flex items-center gap-6">
                                <div>
                                    <p className="text-5xl font-bold text-white tabular-nums">{stats.averageRating}</p>
                                    <div className="flex gap-0.5 mt-2">
                                        {[1, 2, 3, 4, 5].map((s) => (
                                            <span key={s} className={`text-lg ${s <= Math.round(stats.averageRating!) ? 'text-white' : 'text-zinc-700'}`}>★</span>
                                        ))}
                                    </div>
                                </div>
                                <div>
                                    <p className="text-sm font-semibold text-zinc-300">Rating promedio</p>
                                    <p className="text-xs text-zinc-600 mt-0.5">Basado en {stats.totalRated} show{stats.totalRated !== 1 ? 's' : ''} calificado{stats.totalRated !== 1 ? 's' : ''}</p>
                                </div>
                            </div>
                        )}

                        {/* Shows por año — barchart horizontal */}
                        {years.length > 0 && (
                            <section>
                                <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-6">Shows por año</h2>
                                <div className="space-y-3">
                                    {years.map((year) => {
                                        const count = stats.showsByYear[year]
                                        const pct = (count / maxShowsInYear) * 100
                                        return (
                                            <div key={year} className="flex items-center gap-4">
                                                <span className="w-12 text-right text-sm font-semibold text-zinc-400 shrink-0">{year}</span>
                                                <div className="flex-1 h-7 bg-white/[0.04] rounded-lg overflow-hidden">
                                                    <div
                                                        className="h-full bg-white/80 rounded-lg transition-all"
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                                <span className="w-8 text-sm font-bold text-white tabular-nums shrink-0">{count}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </section>
                        )}

                        {/* Top artistas */}
                        {stats.topArtists.length > 0 && (
                            <section>
                                <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-6">Artistas más vistos</h2>
                                <ul className="divide-y divide-white/[0.05]">
                                    {stats.topArtists.map((a, i) => (
                                        <li key={a.name} className="flex items-center gap-4 py-3">
                                            <span className="text-xs font-bold text-zinc-700 w-5 text-right shrink-0">{i + 1}</span>
                                            <span className="flex-1 font-semibold text-white">{a.name}</span>
                                            <span className="text-sm text-zinc-500 shrink-0">
                                                {a.count} show{a.count !== 1 ? 's' : ''}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        {/* Top venues */}
                        {stats.topVenues.length > 0 && (
                            <section>
                                <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-6">Venues más visitados</h2>
                                <ul className="divide-y divide-white/[0.05]">
                                    {stats.topVenues.map((v, i) => (
                                        <li key={v.name} className="flex items-center gap-4 py-3">
                                            <span className="text-xs font-bold text-zinc-700 w-5 text-right shrink-0">{i + 1}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-semibold text-white truncate">{v.name}</p>
                                                {v.city && <p className="text-xs text-zinc-600">{v.city}</p>}
                                            </div>
                                            <span className="text-sm text-zinc-500 shrink-0">
                                                {v.count} show{v.count !== 1 ? 's' : ''}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        {/* Ciudades visitadas */}
                        {stats.uniqueCities.length > 0 && (
                            <section>
                                <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-4">Ciudades</h2>
                                <div className="flex flex-wrap gap-2">
                                    {stats.uniqueCities.sort().map((city) => (
                                        <span
                                            key={city}
                                            className="inline-block text-sm text-zinc-400 border border-white/[0.08] rounded-lg px-3 py-1.5"
                                        >
                                            {city}
                                        </span>
                                    ))}
                                </div>
                            </section>
                        )}

                        {/* Actividad reciente */}
                        {stats.recentActivity.length > 0 && (
                            <section>
                                <h2 className="text-xs uppercase tracking-[0.2em] text-zinc-500 mb-6">Últimos shows</h2>
                                <ul className="divide-y divide-white/[0.05]">
                                    {stats.recentActivity.map((ev) => {
                                        const dateObj = new Date(ev.date)
                                        return (
                                            <li key={ev.id}>
                                                <Link
                                                    href={routes.events.detail(ev.id)}
                                                    className="flex items-center gap-4 py-3 hover:bg-white/[0.02] -mx-3 px-3 rounded-lg transition-colors group"
                                                >
                                                    <div className="w-12 shrink-0 text-center">
                                                        <p className="text-[10px] font-bold text-zinc-600 uppercase">
                                                            {dateObj.toLocaleDateString('es-AR', { month: 'short' })}
                                                        </p>
                                                        <p className="text-lg font-bold text-white leading-none">
                                                            {dateObj.getDate()}
                                                        </p>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-semibold text-white truncate">{ev.name || 'Recital'}</p>
                                                        {ev.venueName && (
                                                            <p className="text-xs text-zinc-600 truncate">
                                                                {[ev.venueName, ev.venueCity].filter(Boolean).join(', ')}
                                                            </p>
                                                        )}
                                                    </div>
                                                    {ev.rating && (
                                                        <div className="flex gap-0.5 shrink-0">
                                                            {[1, 2, 3, 4, 5].map((s) => (
                                                                <span key={s} className={`text-xs ${s <= ev.rating! ? 'text-white' : 'text-zinc-700'}`}>★</span>
                                                            ))}
                                                        </div>
                                                    )}
                                                    <span className="text-zinc-700 group-hover:text-zinc-400 transition-colors shrink-0">→</span>
                                                </Link>
                                            </li>
                                        )
                                    })}
                                </ul>
                            </section>
                        )}

                    </div>
                )}
            </div>
        </main>
    )
}
