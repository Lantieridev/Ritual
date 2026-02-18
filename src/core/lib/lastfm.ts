/**
 * Cliente para la Last.fm API.
 * Usado para enriquecer datos de artistas: imagen, bio, géneros, similares.
 * Solo se usa en servidor. Requiere LASTFM_API_KEY en .env.local.
 * Docs: https://www.last.fm/api
 */
import 'server-only'
import { getLastFmApiKey } from '@/src/core/lib/env'

const BASE = 'https://ws.audioscrobbler.com/2.0'

export interface LastFmImage {
    '#text': string
    size: 'small' | 'medium' | 'large' | 'extralarge' | 'mega' | ''
}

export interface LastFmArtist {
    name: string
    mbid?: string
    url: string
    image: LastFmImage[]
    stats?: {
        listeners: string
        playcount: string
    }
    bio?: {
        summary: string
        content: string
        published: string
    }
    tags?: {
        tag: Array<{ name: string; url: string }>
    }
    similar?: {
        artist: Array<{ name: string; url: string; image: LastFmImage[] }>
    }
}

export function isLastFmConfigured(): boolean {
    return Boolean(getLastFmApiKey())
}

/**
 * Obtiene info completa de un artista: imagen, bio, géneros, similares.
 */
export async function getLastFmArtistInfo(
    artistName: string
): Promise<{ artist: LastFmArtist | null; error?: string }> {
    const apiKey = getLastFmApiKey()
    if (!apiKey) {
        return { artist: null, error: 'LASTFM_API_KEY no configurado.' }
    }

    const params = new URLSearchParams({
        method: 'artist.getinfo',
        artist: artistName.trim(),
        api_key: apiKey,
        format: 'json',
        autocorrect: '1',
    })

    try {
        const res = await fetch(`${BASE}/?${params}`, {
            next: { revalidate: 3600 }, // 1 hora — datos de artistas cambian poco
        })
        if (!res.ok) {
            return { artist: null, error: `Last.fm respondió con error ${res.status}.` }
        }
        const data = await res.json()
        if (data.error) {
            // Last.fm devuelve errores en el body con código 6 = "Artist not found"
            return { artist: null, error: data.message }
        }
        return { artist: data.artist as LastFmArtist }
    } catch (e) {
        console.error('Last.fm artist info:', e)
        return { artist: null, error: 'Error al conectar con Last.fm.' }
    }
}

/**
 * Extrae la imagen más grande disponible de un artista de Last.fm.
 */
export function getBestLastFmImage(images: LastFmImage[]): string | null {
    const priority = ['extralarge', 'mega', 'large', 'medium', 'small']
    for (const size of priority) {
        const img = images.find((i) => i.size === size && i['#text'])
        if (img) return img['#text']
    }
    return null
}

/**
 * Extrae los géneros/tags de un artista de Last.fm (máx. 5).
 */
export function getLastFmTags(artist: LastFmArtist, max = 5): string[] {
    return (artist.tags?.tag ?? []).slice(0, max).map((t) => t.name)
}

/**
 * Busca eventos futuros de un artista en Last.fm.
 * Mapea la respuesta al formato unificado FutureEvent.
 */
import { FutureEvent } from '@/src/core/types'

interface LastFmEventResponse {
    events: {
        event: Array<{
            id: string
            title: string
            artists: {
                artist: string // headliner name
                headliner: string
            }
            venue: {
                name: string
                location: {
                    city: string
                    country: string
                    street: string
                    postalcode: string
                    'geo:point': {
                        'geo:lat': string
                        'geo:long': string
                    }
                }
                url: string
            }
            startDate: string // "Thu, 07 Apr 2022 20:00:00"
            description: string
            image: LastFmImage[]
            url: string
            tag: { tag: string[] } | null
        }>
        '@attr': {
            artist: string
            total: string
            page: string
            perPage: string
            totalPages: string
        }
    }
}

export async function getArtistEvents(
    artistName: string
): Promise<{ events: FutureEvent[]; error?: string }> {
    const apiKey = getLastFmApiKey()
    if (!apiKey) {
        return { events: [], error: 'LASTFM_API_KEY no configurado.' }
    }

    const params = new URLSearchParams({
        method: 'artist.getevents',
        artist: artistName.trim(),
        api_key: apiKey,
        format: 'json',
        autocorrect: '1',
        limit: '20', // Reasonable limit
    })

    try {
        const res = await fetch(`${BASE}/?${params}`, {
            next: { revalidate: 3600 },
        })

        if (res.status === 404) {
            // Artist not found likely
            return { events: [] }
        }

        if (!res.ok) {
            return { events: [], error: `Last.fm respondió con error ${res.status}.` }
        }

        const data = await res.json()

        if (data.error) {
            if (data.error === 6) return { events: [] } // Artist not found
            return { events: [], error: data.message }
        }

        const rawEvents = data.events?.event
        if (!rawEvents || !Array.isArray(rawEvents)) {
            return { events: [] }
        }

        type LastFmEvent = LastFmEventResponse['events']['event'][number]

        const events: FutureEvent[] = rawEvents.map((ev: LastFmEvent) => {
            // Parse date. Last.fm format: "Thu, 07 Apr 2022 20:00:00" -> ISO
            // But sometimes it's just a date. JS Date() usually parses it fine.
            const date = new Date(ev.startDate)
            const isoDate = !isNaN(date.getTime()) ? date.toISOString() : ev.startDate

            const venue = ev.venue
            const location = venue?.location

            // Helper to find valid city
            const validCity = location?.city || ''
            const validCountry = location?.country || ''

            return {
                id: String(ev.id), // Last.fm numeric ID
                title: ev.title || `${ev.artists.headliner} en ${venue?.name}`,
                datetime: isoDate,
                venue: {
                    name: venue?.name || 'Sede desconocida',
                    city: validCity,
                    country: validCountry,
                },
                lineup: [ev.artists.headliner], // Start with headliner
                url: ev.url,
                image: getBestLastFmImage(ev.image || []) || undefined,
                // No price range in Last.fm
            }
        })

        // Filter out past events if Last.fm returns them? Last.fm usually returns future by default.
        // We can filter just in case.
        const now = new Date()
        const futureEvents = events.filter(e => new Date(e.datetime) >= now)

        return { events: futureEvents }

    } catch (e) {
        console.error('Last.fm artist events:', e)
        return { events: [], error: 'Error al conectar con Last.fm.' }
    }
}
