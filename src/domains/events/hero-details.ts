import 'server-only'
import type { Event } from '@/src/core/types'
import { getVenueLocation } from '@/src/domains/venues/service'
import { getEventWeatherCached, type EventWeather } from '@/src/domains/weather/weather-service'

/**
 * Dirección y clima ya resueltos del show que protagoniza el hero de Hoy
 * mobile (issue #82/#8) — pensado para pasarse como Promise a `HomeHero` y
 * resolverse en su propio `<Suspense fallback={null}>` (R1-008), así el
 * resto del hero (foto, headliner, CTA) nunca espera al clima.
 */
export interface HeroVenueDetails {
    address: string | null
    weather: EventWeather | null
}

export const NO_VENUE_DETAILS: HeroVenueDetails = { address: null, weather: null }

/**
 * Nunca rechaza: cualquier falla al buscar la sede o el clima degrada a
 * `NO_VENUE_DETAILS` en vez de tirar el Suspense que la envuelve — la misma
 * regla de "sin dato inventado" que ya sigue `getEventWeather`.
 */
export async function getHeroVenueDetails(
    event: Pick<Event, 'date' | 'venue_id'>
): Promise<HeroVenueDetails> {
    try {
        if (!event.venue_id) return NO_VENUE_DETAILS

        const venue = await getVenueLocation(event.venue_id)
        if (!venue) return NO_VENUE_DETAILS

        const weather =
            venue.lat != null && venue.lng != null
                ? await getEventWeatherCached(event.date, venue.lat, venue.lng)
                : null

        return { address: venue.address ?? null, weather }
    } catch (e) {
        console.error('Error resolviendo dirección/clima del hero de Hoy:', e)
        return NO_VENUE_DETAILS
    }
}
