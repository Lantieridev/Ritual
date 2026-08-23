/**
 * Pura, sin tocar la DB ni sesión — a propósito separada de data.ts (que sí
 * importa 'server-only' transitivamente vía core/auth/session). Mezclar las
 * dos hacía que cualquier import de esta función arrastrara el guard de
 * server-only, rompiendo tests o cualquier uso desde un Client Component.
 */

/**
 * `weather` es opcional y a propósito no se llena en getPersonalStats
 * todavía (issue #8): resolverlo pediría un fetch a Open-Meteo por cada
 * show pasado del usuario en cada carga de stats/Wrapped, sin cachear nada
 * — un costo que no vale la pena pagar antes de que exista una tarjeta de
 * Wrapped real que lo use. Lo que sí hace este archivo es dejar el dato
 * "enchufable": un caller que arme `weather` por evento (por ejemplo
 * llamando a getEventWeather de src/domains/weather/weather-service para
 * cada evento pasado, con su propia estrategia de caché/concurrencia) ya
 * puede pasarlo acá y aggregateEventStats lo cuenta — sin esto, el clima
 * quedaría atrapado en la ficha del evento y una futura tarjeta de Wrapped
 * tendría que reinventar esta función.
 */
export interface AggregatableEvent {
    lineups?: Array<{ artists: { name: string } | null }> | null
    venues?: { name: string; city?: string | null; country?: string | null } | null
    rating?: number | null
    weather?: { isRain: boolean } | null
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
    /** Shows con clima conocido y precipitación > 0 en el momento del show — ver issue #8. */
    rainyShows: number
    /** Cuántos de los eventos de entrada trajeron dato de clima (rainyShows es sobre este subconjunto, no sobre el total). */
    totalWithWeather: number
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

    const eventsWithWeather = events.filter((ev) => ev.weather != null)
    const rainyShows = eventsWithWeather.filter((ev) => ev.weather!.isRain).length

    return {
        uniqueArtists: artistSet.size,
        uniqueVenues: Object.keys(venueMap).length,
        uniqueCities: Array.from(citySet),
        uniqueCountries: Array.from(countrySet),
        topArtists,
        topVenues,
        averageRating,
        totalRated: ratings.length,
        rainyShows,
        totalWithWeather: eventsWithWeather.length,
    }
}
