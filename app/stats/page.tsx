import type { Metadata } from 'next'
import Link from 'next/link'
import { getPersonalStats } from '@/src/domains/stats/data'
import { routes } from '@/src/core/lib/routes'
import { formatDate } from '@/src/core/lib/utils'
import { StarRating } from '@/src/core/components/ui'

export const metadata: Metadata = {
    title: 'Números | RITUAL',
    description: 'Tu historial musical en números: shows, artistas, ciudades y más.',
}

export default async function StatsPage() {
    const stats = await getPersonalStats()

    const years = Object.keys(stats.showsByYear).sort((a, b) => Number(b) - Number(a))
    const maxShowsInYear = Math.max(...Object.values(stats.showsByYear), 1)
    const recordYear = years.find((y) => stats.showsByYear[y] === maxShowsInYear)
    const currentYear = String(new Date().getFullYear())

    const hasData = stats.totalShows > 0

    return (
        <main className="min-h-screen bg-ritual-bg text-ritual-bone">
            <div className="max-w-4xl mx-auto px-6 md:px-8 py-16">
                <div className="mb-12 flex items-start justify-between gap-4 flex-wrap">
                    <p className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-mid">Tu perfil musical</p>
                    <Link
                        href={routes.wrapped}
                        className="font-label text-[10px] tracking-[0.14em] uppercase border border-ritual-border px-4 py-2 text-ritual-gray-text hover:text-ritual-bone hover:border-ritual-border-2 transition-colors"
                    >
                        Ver Wrapped →
                    </Link>
                </div>

                {!hasData ? (
                    <div className="flex flex-col items-center gap-5 py-24 text-center">
                        <h1 className="font-display text-4xl uppercase text-ritual-bone">Todavía no hay datos</h1>
                        <p className="font-body text-sm text-ritual-gray-mid">Agregá recitales para ver tus números.</p>
                        <Link href={routes.events.search} className="font-label text-[10px] tracking-[0.14em] uppercase bg-ritual-red text-ritual-panel px-6 py-3">
                            Buscar shows
                        </Link>
                    </div>
                ) : (
                    <div className="space-y-14">
                        {/* Titular de tapa */}
                        <div>
                            <h1 className="font-display leading-[0.8] text-ritual-bone" style={{ fontSize: 'min(28vw, 190px)' }}>
                                {stats.totalShows}
                            </h1>
                            <div className="flex flex-wrap gap-x-8 gap-y-2 mt-4 font-label text-xs tracking-[0.1em] uppercase text-ritual-gray-text">
                                <span>{stats.showsAttended} fui</span>
                                <span>{stats.showsGoing} voy a ir</span>
                                <span>{stats.showsInterested} me interesa</span>
                                <span>{stats.uniqueArtists} artistas únicos</span>
                                <span>{stats.uniqueVenues} venues únicos</span>
                                <span>{stats.uniqueCities.length} ciudades</span>
                                {stats.uniqueCountries.length > 0 && <span>{stats.uniqueCountries.length} países</span>}
                            </div>
                        </div>

                        {stats.averageRating !== null && (
                            <div className="flex items-center gap-6">
                                <p className="font-display text-6xl text-ritual-bone tabular-nums">{stats.averageRating}</p>
                                <div>
                                    <StarRating value={Math.round(stats.averageRating)} size="lg" />
                                    <p className="font-label text-[10px] text-ritual-gray-mid mt-1 uppercase tracking-[0.1em]">
                                        Promedio sobre {stats.totalRated} show{stats.totalRated !== 1 ? 's' : ''} calificado{stats.totalRated !== 1 ? 's' : ''}
                                    </p>
                                </div>
                            </div>
                        )}

                        {years.length > 0 && (
                            <section>
                                <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-mid mb-6">Shows por año</h2>
                                <div className="space-y-3">
                                    {years.map((year) => {
                                        const count = stats.showsByYear[year]
                                        const pct = (count / maxShowsInYear) * 100
                                        const isRecord = year === recordYear
                                        const isCurrent = year === currentYear
                                        return (
                                            <div key={year} className="flex items-center gap-4">
                                                <span className="w-12 text-right font-label text-xs text-ritual-gray-text shrink-0">{year}</span>
                                                <div className="flex-1 h-6 bg-ritual-surface overflow-hidden">
                                                    <div
                                                        className={`h-full transition-all ${isCurrent ? 'bg-ritual-red' : isRecord ? 'bg-ritual-bone' : 'bg-ritual-border-2'}`}
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                                <span className="w-8 font-figure text-lg text-ritual-bone tabular-nums shrink-0">{count}</span>
                                            </div>
                                        )
                                    })}
                                </div>
                            </section>
                        )}

                        {stats.topArtists.length > 0 && (
                            <section>
                                <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-mid mb-6">Artistas más vistos</h2>
                                <ul className="divide-y divide-ritual-border-subtle">
                                    {stats.topArtists.map((a, i) => (
                                        <li key={a.name} className="flex items-center gap-4 py-3">
                                            <span className="font-figure text-lg text-ritual-gray-mid w-6 text-right shrink-0">{i + 1}</span>
                                            <span className="flex-1 font-dense font-extrabold text-ritual-bone">{a.name}</span>
                                            <span className="font-label text-xs text-ritual-gray-mid shrink-0">
                                                {a.count} show{a.count !== 1 ? 's' : ''}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        {stats.topVenues.length > 0 && (
                            <section>
                                <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-mid mb-6">Venues más visitados</h2>
                                <ul className="divide-y divide-ritual-border-subtle">
                                    {stats.topVenues.map((v, i) => (
                                        <li key={v.name} className="flex items-center gap-4 py-3">
                                            <span className="font-figure text-lg text-ritual-gray-mid w-6 text-right shrink-0">{i + 1}</span>
                                            <div className="flex-1 min-w-0">
                                                <p className="font-dense font-extrabold text-ritual-bone truncate">{v.name}</p>
                                                {v.city && <p className="font-label text-[10px] text-ritual-gray-mid">{v.city}</p>}
                                            </div>
                                            <span className="font-label text-xs text-ritual-gray-mid shrink-0">
                                                {v.count} show{v.count !== 1 ? 's' : ''}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            </section>
                        )}

                        {stats.uniqueCities.length > 0 && (
                            <section>
                                <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-mid mb-4">Ciudades</h2>
                                <div className="flex flex-wrap gap-2">
                                    {stats.uniqueCities.sort().map((city) => (
                                        <span key={city} className="font-label text-xs text-ritual-gray-text border border-ritual-border px-3 py-1.5">
                                            {city}
                                        </span>
                                    ))}
                                </div>
                            </section>
                        )}

                        {stats.recentActivity.length > 0 && (
                            <section>
                                <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-mid mb-6">Últimos shows</h2>
                                <ul className="divide-y divide-ritual-border-subtle">
                                    {stats.recentActivity.map((ev) => {
                                        const dateObj = new Date(ev.date)
                                        return (
                                            <li key={ev.id}>
                                                <Link href={routes.events.detail(ev.id)} className="group flex items-center gap-4 py-3">
                                                    <div className="w-12 shrink-0 text-center">
                                                        <p className="font-label text-[9px] font-bold text-ritual-gray-mid uppercase">{formatDate(dateObj, { month: 'short' })}</p>
                                                        <p className="font-display text-xl text-ritual-bone leading-none">{dateObj.getDate()}</p>
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-dense font-extrabold text-ritual-bone truncate">{ev.name || 'Recital'}</p>
                                                        {ev.venueName && (
                                                            <p className="font-label text-[10px] text-ritual-gray-mid truncate">
                                                                {[ev.venueName, ev.venueCity].filter(Boolean).join(', ')}
                                                            </p>
                                                        )}
                                                    </div>
                                                    {ev.rating && <StarRating value={ev.rating} size="xs" className="shrink-0" />}
                                                    <span className="font-label text-[9px] tracking-[0.1em] uppercase text-ritual-red opacity-0 group-hover:opacity-100 transition-opacity shrink-0">Ver →</span>
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
