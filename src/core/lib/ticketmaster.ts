/**
 * Cliente para la Ticketmaster Discovery API.
 * Usado para buscar shows FUTUROS por artista o por ciudad.
 * Solo se usa en servidor. Requiere TICKETMASTER_API_KEY en .env.local.
 * Docs: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
 */
import 'server-only'
import { getTicketmasterApiKey } from '@/src/core/lib/env'
import { fetchWithRetry, isTimeoutError } from '@/src/core/lib/http'
import { FutureEvent } from '@/src/core/types'

const BASE = 'https://app.ticketmaster.com/discovery/v2'

interface TicketmasterEventResponse {
    _embedded?: {
        events: Array<{
            id: string
            name: string
            url?: string
            dates: {
                start: {
                    localDate?: string
                    localTime?: string
                    dateTime?: string
                }
            }
            priceRanges?: Array<{ min: number; max: number; currency: string }>
            classifications?: Array<{ genre?: { name: string } }>
            images?: Array<{ url: string; width: number; ratio?: string }>
            _embedded?: {
                venues?: Array<{
                    name: string
                    city?: { name: string }
                    country?: { name: string }
                }>
                attractions?: Array<{ name: string }>
            }
        }>
    }
    page: {
        size: number
        totalElements: number
        totalPages: number
        number: number
    }
}

export function isTicketmasterConfigured(): boolean {
    return Boolean(getTicketmasterApiKey())
}

function bestImage(images?: Array<{ url: string; width: number; ratio?: string }>): string | undefined {
    if (!images?.length) return undefined
    const landscape = images.filter((img) => img.ratio === '16_9')
    const pool = landscape.length > 0 ? landscape : images
    return pool.reduce((best, img) => (img.width > best.width ? img : best), pool[0]).url
}

/**
 * Busca shows futuros por artista y/o ciudad en Ticketmaster.
 * Al menos uno de los dos parámetros debe estar presente.
 */
export async function searchTicketmasterEvents(
    query: { keyword?: string; city?: string },
    page = 0
): Promise<{ events: FutureEvent[]; total: number; error?: string }> {
    const apiKey = getTicketmasterApiKey()
    if (!apiKey) {
        return { events: [], total: 0, error: 'TICKETMASTER_API_KEY no configurado.' }
    }

    const keyword = query.keyword?.trim()
    const city = query.city?.trim()
    if (!keyword && !city) {
        return { events: [], total: 0 }
    }

    const params = new URLSearchParams({
        apikey: apiKey,
        size: '20',
        page: String(page),
        sort: 'date,asc',
        classificationName: 'music',
    })
    if (keyword) params.set('keyword', keyword)
    if (city) params.set('city', city)

    try {
        const res = await fetchWithRetry(`${BASE}/events.json?${params}`, {
            next: { revalidate: 1800 },
        })

        if (res.status === 401 || res.status === 403) {
            return { events: [], total: 0, error: 'API Key inválida. Verificá TICKETMASTER_API_KEY en .env.local.' }
        }
        if (res.status === 429) {
            return { events: [], total: 0, error: 'Límite de la API de Ticketmaster alcanzado. Probá de nuevo en un momento.' }
        }
        if (!res.ok) {
            return { events: [], total: 0, error: `Ticketmaster respondió con error ${res.status}.` }
        }

        const data: TicketmasterEventResponse = await res.json()
        const rawEvents = data._embedded?.events ?? []

        const events: FutureEvent[] = rawEvents.map((ev) => {
            const venue = ev._embedded?.venues?.[0]
            const priceRange = ev.priceRanges?.[0]
            // `dateTime` (cuando Ticketmaster lo manda) ya es un instante UTC
            // real con 'Z' -sin ambigüedad. El fallback a localDate/localTime
            // no tiene marca de timezone en absoluto: sin el "-03:00" acá,
            // quien lo parsee (parseExternalDateTime) lo interpreta como hora
            // LOCAL del proceso -en Vercel (UTC) un show a las 21:00 en
            // Argentina se guardaba como 21:00 UTC, es decir 18:00 ART. Bug
            // real, confirmado forzando TZ=UTC localmente.
            const dateTime = ev.dates.start.dateTime
                ?? (ev.dates.start.localDate
                    ? `${ev.dates.start.localDate}T${ev.dates.start.localTime ?? '00:00:00'}-03:00`
                    : '')

            return {
                id: ev.id,
                title: ev.name,
                datetime: dateTime,
                venue: {
                    name: venue?.name ?? 'Sede desconocida',
                    city: venue?.city?.name ?? null,
                    country: venue?.country?.name ?? null,
                },
                lineup: ev._embedded?.attractions?.map((a) => a.name) ?? [],
                url: ev.url,
                image: bestImage(ev.images),
                priceRange: priceRange
                    ? { min: priceRange.min, max: priceRange.max, currency: priceRange.currency }
                    : undefined,
                genre: ev.classifications?.[0]?.genre?.name,
            }
        })

        return { events, total: data.page.totalElements }
    } catch (e) {
        console.error('Ticketmaster search events:', e)
        if (isTimeoutError(e)) {
            return { events: [], total: 0, error: 'Ticketmaster tardó demasiado en responder. Probá de nuevo.' }
        }
        return { events: [], total: 0, error: 'Error al conectar con Ticketmaster.' }
    }
}
