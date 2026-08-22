import type { Metadata } from 'next'
import Link from 'next/link'
import { getPersonalStats } from '@/src/domains/stats/data'
import { buildWrappedSummary } from '@/src/domains/stats/wrapped-view'
import { getEventsWithAttendance } from '@/src/domains/events/data'
import { summarizeExpenses } from '@/src/domains/expenses/service'
import { getProfile } from '@/src/domains/auth/data'
import { getCurrentUserId } from '@/src/core/auth/session'
import { routes } from '@/src/core/lib/routes'
import { parseYearParam } from '@/src/core/lib/validation'
import { formatDate } from '@/src/core/lib/utils'
import { WrappedStories, type WrappedSlide } from '@/src/domains/stats/components/WrappedStories'

export const metadata: Metadata = {
    title: 'Tu Wrapped | RITUAL',
    description: 'Tu resumen musical anual — los shows, artistas y momentos del año.',
}

interface PageProps {
    searchParams: Promise<{ year?: string }>
}

function formatARS(amount: number) {
    return `$${amount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
}

export default async function WrappedPage({ searchParams }: PageProps) {
    const { year: yearParam } = await searchParams
    const currentYear = new Date().getFullYear()
    const selectedYear = parseYearParam(yearParam, currentYear)

    const userId = await getCurrentUserId()
    const [stats, allEvents, expensesSummary, profile] = await Promise.all([
        getPersonalStats(),
        getEventsWithAttendance(),
        summarizeExpenses(userId),
        getProfile(userId ?? undefined),
    ])

    const {
        attendedThisYear,
        uniqueArtists,
        uniqueVenues,
        topArtists: topArtistsThisYear,
        topVenues: topVenuesThisYear,
        bestNight,
        availableYears,
        hasData,
    } = buildWrappedSummary(allEvents, stats, selectedYear)

    const spentThisYear = expensesSummary.byYear[String(selectedYear)] ?? 0
    const handle = profile?.username || 'vos'

    return (
        <main className="min-h-screen bg-ritual-bg text-ritual-bone">
            <div className="max-w-2xl mx-auto px-6 md:px-8 py-16">
                <div className="mb-10">
                    <Link href={routes.stats} className="font-label text-[10px] tracking-[0.14em] uppercase text-ritual-gray-text hover:text-ritual-gray-text transition-colors mb-4 inline-block">
                        ← Números
                    </Link>
                    <div className="flex items-end gap-4 flex-wrap">
                        <h1 className="font-display text-5xl uppercase text-ritual-bone">
                            {selectedYear} <span className="text-ritual-gray-text">Wrapped</span>
                        </h1>
                        {availableYears.length > 1 && (
                            <div className="flex gap-1.5 flex-wrap ml-auto">
                                {availableYears.map((y) => (
                                    <Link
                                        key={y}
                                        href={`/wrapped?year=${y}`}
                                        aria-current={y === selectedYear ? 'page' : undefined}
                                        className={`px-3 py-1.5 font-label text-xs ${y === selectedYear ? 'bg-ritual-red text-ritual-bone' : 'border border-ritual-border text-ritual-gray-text hover:text-ritual-gray-text'}`}
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
                        <p className="font-body text-ritual-gray-text text-lg mb-2">Sin shows en {selectedYear}</p>
                        <p className="font-label text-xs text-ritual-gray-text uppercase tracking-[0.1em]">Marcá shows como &quot;Fui&quot; para verlos acá.</p>
                        <Link href={routes.home} className="inline-block mt-6 font-label text-xs text-ritual-red-hover uppercase tracking-[0.1em] underline underline-offset-4">
                            Ver mis recitales →
                        </Link>
                    </div>
                ) : (
                    <>
                        <WrappedStories
                            handle={handle}
                            slides={buildSlides({
                                selectedYear,
                                showCount: attendedThisYear.length,
                                topArtist: topArtistsThisYear[0] ?? null,
                                bestNight,
                                uniqueVenues,
                                spentThisYear,
                            })}
                        />

                        {/* Versión de escritorio con el mismo lenguaje: resumen en línea, no la historia */}
                        <div className="mt-12 space-y-8">
                            <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                <StatBox label="Shows" value={attendedThisYear.length} />
                                <StatBox label="Artistas únicos" value={uniqueArtists} />
                                <StatBox label="Venues distintos" value={uniqueVenues} />
                                <StatBox label="Gastado" value={formatARS(spentThisYear)} />
                            </section>

                            {topArtistsThisYear.length > 0 && (
                                <section>
                                    <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-5">Tus artistas del año</h2>
                                    <ol className="space-y-3">
                                        {topArtistsThisYear.map(([name, count], i) => (
                                            <li key={name} className="flex items-center gap-4">
                                                <span className="font-figure text-xl text-ritual-gray-text w-6 shrink-0">{i + 1}</span>
                                                <p className="flex-1 font-dense font-extrabold text-ritual-bone truncate">{name}</p>
                                                <span className="font-label text-xs text-ritual-gray-text shrink-0">{count} show{count !== 1 ? 's' : ''}</span>
                                            </li>
                                        ))}
                                    </ol>
                                </section>
                            )}

                            {topVenuesThisYear.length > 0 && (
                                <section>
                                    <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-5">Tus venues del año</h2>
                                    <ol className="space-y-3">
                                        {topVenuesThisYear.map(([name, count], i) => (
                                            <li key={name} className="flex items-center gap-4">
                                                <span className="font-figure text-xl text-ritual-gray-text w-6 shrink-0">{i + 1}</span>
                                                <p className="flex-1 font-dense font-extrabold text-ritual-bone truncate">{name}</p>
                                                <span className="font-label text-xs text-ritual-gray-text shrink-0">{count}×</span>
                                            </li>
                                        ))}
                                    </ol>
                                </section>
                            )}

                            <section>
                                <h2 className="font-label text-[10px] tracking-[0.2em] uppercase text-ritual-gray-text mb-5">Todos los shows de {selectedYear}</h2>
                                <ul className="divide-y divide-ritual-border-subtle">
                                    {attendedThisYear.map((ev) => {
                                        const date = new Date(ev.date)
                                        const artists = ev.lineups?.map((l) => l.artists.name) ?? []
                                        return (
                                            <li key={ev.id}>
                                                <Link href={routes.events.detail(ev.id)} className="flex items-center gap-4 py-3">
                                                    <div className="w-10 shrink-0 text-center">
                                                        <p className="font-label text-[9px] font-bold text-ritual-gray-text uppercase">{formatDate(date, { month: 'short' })}</p>
                                                        <p className="font-display text-lg text-ritual-bone leading-none">{date.getDate()}</p>
                                                    </div>
                                                    <p className="flex-1 font-dense font-extrabold text-ritual-bone truncate text-sm">{ev.name || artists[0] || 'Recital'}</p>
                                                </Link>
                                            </li>
                                        )
                                    })}
                                </ul>
                            </section>
                        </div>
                    </>
                )}
            </div>
        </main>
    )
}

function StatBox({ label, value }: { label: string; value: string | number }) {
    return (
        <div className="border border-ritual-border bg-ritual-surface p-4">
            <p className="font-display text-2xl text-ritual-bone truncate">{value}</p>
            <p className="font-label text-[9px] tracking-[0.14em] uppercase text-ritual-gray-text mt-1">{label}</p>
        </div>
    )
}

function buildSlides(data: {
    selectedYear: number
    showCount: number
    topArtist: readonly [string, number] | null
    bestNight: Awaited<ReturnType<typeof getEventsWithAttendance>>[number] | null
    uniqueVenues: number
    spentThisYear: number
}): WrappedSlide[] {
    const slides: WrappedSlide[] = [
        {
            kind: 'cover',
            content: (
                <div className="text-center">
                    <p className="font-label text-[10px] tracking-[0.3em] uppercase text-ritual-red-hover mb-3">Tu resumen</p>
                    <p className="font-display text-8xl text-ritual-bone leading-none">{data.selectedYear}</p>
                </div>
            ),
        },
        {
            kind: 'shows',
            content: (
                <div className="text-center">
                    <p className="font-display text-9xl text-ritual-bone leading-none">{data.showCount}</p>
                    <p className="font-label text-xs tracking-[0.2em] uppercase text-ritual-gray-light-3 mt-4">
                        show{data.showCount !== 1 ? 's' : ''} en {data.selectedYear}
                    </p>
                </div>
            ),
        },
    ]

    if (data.topArtist) {
        slides.push({
            kind: 'artist',
            content: (
                <div className="text-center">
                    <p className="font-label text-[10px] tracking-[0.3em] uppercase text-ritual-red-hover mb-3">Tu banda del año</p>
                    <p className="font-display text-5xl uppercase text-ritual-bone leading-[0.9]">{data.topArtist[0]}</p>
                    <p className="font-label text-xs text-ritual-gray-text mt-4">{data.topArtist[1]} show{data.topArtist[1] !== 1 ? 's' : ''}</p>
                </div>
            ),
        })
    }

    if (data.bestNight) {
        const artists = data.bestNight.lineups?.map((l) => l.artists.name) ?? []
        slides.push({
            kind: 'bestNight',
            content: (
                <div className="text-center">
                    <p className="font-label text-[10px] tracking-[0.3em] uppercase text-ritual-red-hover mb-3">La mejor noche</p>
                    <p className="font-display text-4xl uppercase text-ritual-bone leading-[0.9]">{data.bestNight.name || artists[0] || 'Recital'}</p>
                    {data.bestNight.venues && <p className="font-label text-xs text-ritual-gray-text mt-4">{data.bestNight.venues.name}</p>}
                </div>
            ),
        })
    }

    slides.push({
        kind: 'venues',
        content: (
            <div className="text-center">
                <p className="font-display text-9xl text-ritual-bone leading-none">{data.uniqueVenues}</p>
                <p className="font-label text-xs tracking-[0.2em] uppercase text-ritual-gray-light-3 mt-4">
                    sede{data.uniqueVenues !== 1 ? 's' : ''} distinta{data.uniqueVenues !== 1 ? 's' : ''}
                </p>
            </div>
        ),
    })

    slides.push({
        kind: 'expenses',
        content: (
            <div className="text-center bg-ritual-red text-ritual-bone -m-8 p-8 w-full h-full flex flex-col items-center justify-center">
                <p className="font-label text-[10px] tracking-[0.3em] uppercase mb-3">Lo que gastaste</p>
                <p className="font-display text-6xl leading-none">{formatARS(data.spentThisYear)}</p>
            </div>
        ),
    })

    slides.push({
        kind: 'closing',
        content: (
            <div className="text-center">
                <p className="font-display text-4xl uppercase text-ritual-bone leading-[0.9]">Ritual</p>
                <p className="font-label text-xs text-ritual-gray-text mt-4">Nos vemos el año que viene.</p>
            </div>
        ),
    })

    return slides
}
