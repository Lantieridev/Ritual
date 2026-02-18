/**
 * Cliente para la Last.fm API.
 * Usado para enriquecer datos de artistas: imagen, bio, géneros, similares.
 * Solo se usa en servidor. Requiere LASTFM_API_KEY en .env.local.
 * Docs: https://www.last.fm/api
 */

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

function getApiKey(): string | undefined {
    return process.env.LASTFM_API_KEY
}

export function isLastFmConfigured(): boolean {
    return Boolean(getApiKey()?.trim())
}

/**
 * Obtiene info completa de un artista: imagen, bio, géneros, similares.
 */
export async function getLastFmArtistInfo(
    artistName: string
): Promise<{ artist: LastFmArtist | null; error?: string }> {
    const apiKey = getApiKey()
    if (!apiKey?.trim()) {
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
