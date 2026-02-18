/**
 * Cliente para la Ticketmaster Discovery API.
 * Usado para buscar eventos futuros y presentes.
 * Solo se usa en servidor. Requiere TICKETMASTER_API_KEY en .env.local.
 * Docs: https://developer.ticketmaster.com/products-and-docs/apis/discovery-api/v2/
 *
 * NOTA DE SEGURIDAD: Este archivo exporta tipos que son importados por Client Components.
 * La API key NUNCA se expone al cliente: las variables sin NEXT_PUBLIC_ no se incluyen
 * en el bundle del cliente, y las funciones async solo se llaman desde Server Components.
 */
import { getTicketmasterApiKey } from '@/src/core/lib/env'

const BASE = 'https://app.ticketmaster.com/discovery/v2'


export interface TicketmasterVenue {
    id: string
    name: string
    city?: { name: string }
    country?: { name: string; countryCode: string }
    address?: { line1: string }
    location?: { longitude: string; latitude: string }
}

export interface TicketmasterArtist {
    id: string
    name: string
    images?: Array<{ url: string; width: number; height: number }>
    url?: string
}

export interface TicketmasterEvent {
    id: string
    name: string
    dates: {
        start: {
            localDate: string
            localTime?: string
            dateTime?: string
        }
        status?: { code: string }
    }
    _embedded?: {
        venues?: TicketmasterVenue[]
        attractions?: TicketmasterArtist[]
    }
    url?: string
    images?: Array<{ url: string; width: number; height: number }>
    priceRanges?: Array<{ min: number; max: number; currency: string }>
    classifications?: Array<{
        segment?: { name: string }
        genre?: { name: string }
        subGenre?: { name: string }
    }>
}

export function isTicketmasterConfigured(): boolean {
    return Boolean(getTicketmasterApiKey())
}

/**
 * Busca eventos por nombre de artista.
 * Devuelve eventos futuros y presentes ordenados por fecha.
 */
export async function getTicketmasterEventsByArtist(
    artistName: string,
    countryCode = 'AR'
): Promise<{ events: TicketmasterEvent[]; error?: string }> {
    const apiKey = getTicketmasterApiKey()
    if (!apiKey) {
        return { events: [], error: 'TICKETMASTER_API_KEY no configurado.' }
    }

    // API key sent as header (not query param) to avoid exposure in server/proxy logs
    const params = new URLSearchParams({
        keyword: artistName.trim(),
        countryCode,
        sort: 'date,asc',
        size: '20',
        classificationName: 'music',
    })

    try {
        const res = await fetch(`${BASE}/events.json?${params}`, {
            headers: { 'X-Api-Key': apiKey },
            next: { revalidate: 300 },
        })
        if (res.status === 401) {
            return { events: [], error: 'API Key inválida (401). Verificá TICKETMASTER_API_KEY en .env.local.' }
        }
        if (!res.ok) {
            return { events: [], error: `Ticketmaster respondió con error ${res.status}.` }
        }
        const data = await res.json()
        const events: TicketmasterEvent[] = data._embedded?.events ?? []
        return { events }
    } catch (e) {
        console.error('Ticketmaster artist events:', e)
        return { events: [], error: 'Error al conectar con Ticketmaster. Verificá tu conexión.' }
    }
}

/**
 * Busca eventos por ciudad/país.
 */
export async function getTicketmasterEventsByLocation(
    city: string,
    countryCode = 'AR'
): Promise<{ events: TicketmasterEvent[]; error?: string }> {
    const apiKey = getTicketmasterApiKey()
    if (!apiKey) {
        return { events: [], error: 'TICKETMASTER_API_KEY no configurado.' }
    }

    const params = new URLSearchParams({
        city: city.trim(),
        countryCode,
        sort: 'date,asc',
        size: '20',
        classificationName: 'music',
    })

    try {
        const res = await fetch(`${BASE}/events.json?${params}`, {
            headers: { 'X-Api-Key': apiKey },
            next: { revalidate: 300 },
        })
        if (res.status === 401) {
            return { events: [], error: 'API Key inválida (401). Verificá TICKETMASTER_API_KEY en .env.local.' }
        }
        if (!res.ok) {
            return { events: [], error: `Ticketmaster respondió con error ${res.status}.` }
        }
        const data = await res.json()
        const events: TicketmasterEvent[] = data._embedded?.events ?? []
        return { events }
    } catch (e) {
        console.error('Ticketmaster location events:', e)
        return { events: [], error: 'Error al conectar con Ticketmaster. Verificá tu conexión.' }
    }
}

/**
 * Normaliza un evento de Ticketmaster al formato BandsintownEvent
 * para mantener compatibilidad con el componente BandsintownResults existente.
 */
export function normalizeTicketmasterEvent(ev: TicketmasterEvent) {
    const venue = ev._embedded?.venues?.[0]
    const artists = ev._embedded?.attractions ?? []
    return {
        id: ev.id,
        title: ev.name,
        datetime: ev.dates.start.dateTime ?? `${ev.dates.start.localDate}T00:00:00Z`,
        venue: {
            name: venue?.name ?? 'Sede por confirmar',
            city: venue?.city?.name,
            country: venue?.country?.name,
        },
        lineup: artists.map((a) => a.name),
        url: ev.url,
        // Datos extra de Ticketmaster
        image: ev.images?.find((img) => img.width > 500)?.url,
        priceRange: ev.priceRanges?.[0],
        genre: ev.classifications?.[0]?.genre?.name,
        status: ev.dates.status?.code,
    }
}
