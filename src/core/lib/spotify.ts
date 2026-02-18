/**
 * Cliente para la Spotify Web API (Client Credentials flow).
 * Usado para obtener imágenes HD y datos de artistas.
 * NO requiere login del usuario — usa credenciales de la app.
 * Solo se usa en servidor. Requiere SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET en .env.local.
 * Docs: https://developer.spotify.com/documentation/web-api
 */
import 'server-only'
import { getSpotifyClientId, getSpotifyClientSecret } from '@/src/core/lib/env'

const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const BASE = 'https://api.spotify.com/v1'

export interface SpotifyImage {
    url: string
    height: number | null
    width: number | null
}

export interface SpotifyArtist {
    id: string
    name: string
    genres: string[]
    popularity: number
    followers: { total: number }
    images: SpotifyImage[]
    external_urls: { spotify: string }
}

export function isSpotifyConfigured(): boolean {
    return Boolean(getSpotifyClientId() && getSpotifyClientSecret())
}

/**
 * Obtiene un access token usando Client Credentials flow.
 * No requiere login de usuario — solo credenciales de la app.
 */
async function getAccessToken(): Promise<string | null> {
    const clientId = getSpotifyClientId()
    const clientSecret = getSpotifyClientSecret()
    if (!clientId || !clientSecret) return null

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

    try {
        const res = await fetch(TOKEN_URL, {
            method: 'POST',
            headers: {
                Authorization: `Basic ${credentials}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: 'grant_type=client_credentials',
            // Token dura 1 hora — Next.js lo cachea automáticamente
            next: { revalidate: 3500 },
        })
        if (!res.ok) return null
        const data = await res.json()
        return data.access_token as string
    } catch (e) {
        console.error('Spotify token error:', e)
        return null
    }
}

/**
 * Busca un artista por nombre y devuelve el primero que coincide.
 * Incluye imágenes HD, géneros y popularidad.
 */
export async function searchSpotifyArtist(
    artistName: string
): Promise<{ artist: SpotifyArtist | null; error?: string }> {
    if (!isSpotifyConfigured()) {
        return { artist: null, error: 'Spotify no configurado.' }
    }

    const token = await getAccessToken()
    if (!token) {
        return { artist: null, error: 'No se pudo obtener token de Spotify.' }
    }

    const params = new URLSearchParams({
        q: artistName.trim(),
        type: 'artist',
        limit: '1',
    })

    try {
        const res = await fetch(`${BASE}/search?${params}`, {
            headers: { Authorization: `Bearer ${token}` },
            next: { revalidate: 3600 },
        })
        if (!res.ok) {
            return { artist: null, error: `Spotify respondió con error ${res.status}.` }
        }
        const data = await res.json()
        const artists: SpotifyArtist[] = data.artists?.items ?? []
        return { artist: artists[0] ?? null }
    } catch (e) {
        console.error('Spotify search artist:', e)
        return { artist: null, error: 'Error al conectar con Spotify.' }
    }
}

/**
 * Extrae la imagen más grande disponible de un artista de Spotify.
 */
export function getBestSpotifyImage(images: SpotifyImage[]): string | null {
    if (!images.length) return null
    // Spotify devuelve imágenes ordenadas de mayor a menor
    return images[0]?.url ?? null
}
