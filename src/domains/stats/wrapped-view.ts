import { eventYear, eventMonth } from '@/src/core/lib/dates'
import { formatDate } from '@/src/core/lib/utils'
import { aggregateEventStats } from '@/src/domains/stats/aggregate'
import type { StatsData } from '@/src/domains/stats/data'
import type { EventWithAttendance } from '@/src/domains/events/data'

export interface WrappedSummary {
    /** Shows "fui" del año, ordenados ascendente por fecha — listos para la timeline. */
    attendedThisYear: EventWithAttendance[]
    uniqueArtists: number
    uniqueVenues: number
    totalRated: number
    topArtists: Array<readonly [name: string, count: number]>
    topVenues: Array<readonly [name: string, count: number]>
    avgRating: string | null
    busiestMonth: string | null
    availableYears: number[]
    hasData: boolean
}

/**
 * Lógica de agregación separada del fetch y del JSX de app/wrapped/page.tsx
 * para que sea testeable sin renderizar la página. Reutiliza
 * aggregateEventStats para no recalcular artistas/venues/rating con una
 * segunda implementación propia.
 */
export function buildWrappedSummary(
    allEvents: EventWithAttendance[],
    lifetimeStats: StatsData,
    selectedYear: number
): WrappedSummary {
    const attendedThisYear = allEvents
        .filter((ev) => eventYear(ev.date) === selectedYear && ev.attendance?.[0]?.status === 'went')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

    const agg = aggregateEventStats(
        attendedThisYear.map((ev) => ({
            lineups: ev.lineups?.map((l) => ({ artists: l.artists })) ?? null,
            venues: ev.venues,
            rating: ev.attendance?.[0]?.rating ?? null,
        }))
    )

    const monthCount: Record<number, number> = {}
    for (const ev of attendedThisYear) {
        const m = eventMonth(ev.date)
        monthCount[m] = (monthCount[m] ?? 0) + 1
    }
    const busiestMonthEntry = Object.entries(monthCount).sort((a, b) => b[1] - a[1])[0]
    const busiestMonth = busiestMonthEntry
        ? formatDate(new Date(selectedYear, parseInt(busiestMonthEntry[0])), { month: 'long' })
        : null

    const availableYears = Object.keys(lifetimeStats.showsByYear)
        .map(Number)
        .sort((a, b) => b - a)

    return {
        attendedThisYear,
        uniqueArtists: agg.uniqueArtists,
        uniqueVenues: agg.uniqueVenues,
        totalRated: agg.totalRated,
        topArtists: agg.topArtists.slice(0, 5).map((a) => [a.name, a.count] as const),
        topVenues: agg.topVenues.slice(0, 3).map((v) => [v.name, v.count] as const),
        avgRating: agg.averageRating !== null ? agg.averageRating.toFixed(1) : null,
        busiestMonth,
        availableYears,
        hasData: attendedThisYear.length > 0,
    }
}
