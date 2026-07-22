/**
 * Pura, sin tocar la DB ni sesión — a propósito separada de data.ts (que sí
 * importa 'server-only' transitivamente vía core/auth/session). Mezclar las
 * dos hacía que cualquier import de esta función arrastrara el guard de
 * server-only, rompiendo tests o cualquier uso desde un Client Component.
 */

/** Forma mínima que necesita aggregateEventStats — cualquier lista de eventos con esta forma sirve. */
export interface AggregatableEvent {
    lineups?: Array<{ artists: { name: string } | null }> | null
    venues?: { name: string; city?: string | null; country?: string | null } | null
    rating?: number | null
}

export interface AggregatedEventStats {
    uniqueArtists: number
    uniqueVenues: number
    uniqueCities: string[]
    uniqueCountries: string[]
    /** Ordenados de más a menos shows — el caller decide cuántos mostrar. */
    topArtists: Array<{ name: string; count: number }>
    topVenues: Array<{ name: string; city: string | null; count: number }>
    averageRating: number | null
    totalRated: number
}

/**
 * Cuenta artistas/venues/rating promedio sobre una lista de eventos ya
 * filtrada por el caller (todo el historial, o solo un año — ver
 * getPersonalStats vs WrappedPage). Única fuente de esta lógica: antes vivía
 * duplicada en stats/data.ts y en app/wrapped/page.tsx con dos
 * implementaciones que iban a divergir tarde o temprano.
 */
export function aggregateEventStats(events: AggregatableEvent[]): AggregatedEventStats {
    const artistSet = new Set<string>()
    const artistCount: Record<string, number> = {}
    for (const ev of events) {
        for (const l of ev.lineups ?? []) {
            const name = l.artists?.name
            if (name) {
                artistSet.add(name)
                artistCount[name] = (artistCount[name] ?? 0) + 1
            }
        }
    }

    const venueMap: Record<string, { name: string; city: string | null; count: number }> = {}
    const citySet = new Set<string>()
    const countrySet = new Set<string>()
    for (const ev of events) {
        const v = ev.venues
        if (v?.name) {
            if (!venueMap[v.name]) venueMap[v.name] = { name: v.name, city: v.city ?? null, count: 0 }
            venueMap[v.name].count++
            if (v.city) citySet.add(v.city)
            if (v.country) countrySet.add(v.country)
        }
    }

    const ratings: number[] = []
    for (const ev of events) {
        if (ev.rating) ratings.push(ev.rating)
    }
    const averageRating = ratings.length > 0
        ? Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 10) / 10
        : null

    const topArtists = Object.entries(artistCount)
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => b.count - a.count)

    const topVenues = Object.values(venueMap).sort((a, b) => b.count - a.count)

    return {
        uniqueArtists: artistSet.size,
        uniqueVenues: Object.keys(venueMap).length,
        uniqueCities: Array.from(citySet),
        uniqueCountries: Array.from(countrySet),
        topArtists,
        topVenues,
        averageRating,
        totalRated: ratings.length,
    }
}
