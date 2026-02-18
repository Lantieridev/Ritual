/**
 * Cliente para la Setlist.fm API.
 * Usado para buscar shows PASADOS de un artista (historial + setlists).
 * Solo se usa en servidor. Requiere SETLISTFM_API_KEY en .env.local.
 * Docs: https://api.setlist.fm/docs/1.0/index.html
 *
 * NOTA DE SEGURIDAD: Este archivo exporta tipos y utilidades puras que son importados
 * por Client Components. La API key NUNCA se expone al cliente porque:
 * 1. Solo se accede en funciones async que solo se llaman desde Server Components.
 * 2. Las variables de entorno sin NEXT_PUBLIC_ nunca se incluyen en el bundle del cliente.
 */
import { getSetlistFmApiKey } from '@/src/core/lib/env'

const BASE = 'https://api.setlist.fm/rest/1.0'

export interface SetlistVenue {
    id: string
    name: string
    city: {
        id: string
        name: string
        state?: string
        stateCode?: string
        country: { code: string; name: string }
        coords?: { lat: number; long: number }
    }
    url?: string
}

export interface SetlistSong {
    name: string
    with?: { mbid: string; name: string }
    cover?: { mbid: string; name: string }
    info?: string
    tape?: boolean
}

export interface SetlistSet {
    name?: string
    encore?: number
    song: SetlistSong[]
}

export interface Setlist {
    id: string
    eventDate: string // "DD-MM-YYYY"
    artist: {
        mbid: string
        name: string
        sortName: string
        url: string
    }
    venue: SetlistVenue
    sets: { set: SetlistSet[] }
    url: string
    info?: string
    lastUpdated: string
}

export function isSetlistFmConfigured(): boolean {
    return Boolean(getSetlistFmApiKey())
}

/**
 * Busca setlists pasados de un artista por nombre.
 * Devuelve los shows más recientes primero.
 */
export async function getSetlistsByArtist(
    artistName: string,
    page = 1
): Promise<{ setlists: Setlist[]; total: number; error?: string }> {
    const apiKey = getSetlistFmApiKey()
    if (!apiKey) {
        return { setlists: [], total: 0, error: 'SETLISTFM_API_KEY no configurado.' }
    }

    const params = new URLSearchParams({
        artistName: artistName.trim(),
        p: String(page),
    })

    try {
        const res = await fetch(`${BASE}/search/setlists?${params}`, {
            headers: {
                'x-api-key': apiKey,
                Accept: 'application/json',
            },
            next: { revalidate: 600 },
        })
        if (res.status === 401 || res.status === 403) {
            return { setlists: [], total: 0, error: 'API Key inválida. Verificá SETLISTFM_API_KEY en .env.local.' }
        }
        if (res.status === 404) {
            return { setlists: [], total: 0 }
        }
        if (!res.ok) {
            return { setlists: [], total: 0, error: `Setlist.fm respondió con error ${res.status}.` }
        }
        const data = await res.json()
        return {
            setlists: data.setlist ?? [],
            total: data.total ?? 0,
        }
    } catch (e) {
        console.error('Setlist.fm artist setlists:', e)
        return { setlists: [], total: 0, error: 'Error al conectar con Setlist.fm.' }
    }
}

/**
 * Convierte la fecha de Setlist.fm "DD-MM-YYYY" a ISO "YYYY-MM-DD".
 */
export function parseSetlistDate(dateStr: string): string {
    const [day, month, year] = dateStr.split('-')
    return `${year}-${month}-${day}`
}

/**
 * Normaliza un setlist al formato compatible con BandsintownEvent
 * para poder importarlo con addEventFromBandsintown.
 */
export function normalizeSetlist(setlist: Setlist) {
    const allSongs = setlist.sets.set.flatMap((s) => s.song.map((song) => song.name))
    return {
        id: setlist.id,
        title: `${setlist.artist.name} @ ${setlist.venue.name}`,
        datetime: parseSetlistDate(setlist.eventDate) + 'T00:00:00Z',
        venue: {
            name: setlist.venue.name,
            city: setlist.venue.city.name,
            country: setlist.venue.city.country.name,
        },
        lineup: [setlist.artist.name],
        url: setlist.url,
        // Datos extra de Setlist.fm
        setlist: allSongs,
        totalSongs: allSongs.length,
    }
}
