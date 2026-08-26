/**
 * Resuelve la foto de un artista probando las fuentes disponibles en orden.
 *
 * El hero de la Home dependía sólo de Spotify, que necesita
 * SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET. Sin esas dos variables el fondo
 * quedaba vacío, que es la situación por defecto de cualquiera que clone el
 * repo — y también la del deploy hoy. Deezer no pide credenciales, así que
 * sirve de piso: siempre hay al menos una fuente disponible.
 *
 * El orden no es arbitrario. Spotify va primero cuando está configurado
 * porque sus imágenes son de mayor resolución y su catálogo de artistas
 * argentinos es más completo; Deezer entra cuando la primera no está
 * disponible o no encontró nada.
 */
import 'server-only'
import { isSpotifyConfigured, searchSpotifyArtist, getBestSpotifyImage } from '@/src/core/lib/spotify'
import { searchDeezerArtistImage } from '@/src/core/lib/deezer'

export interface ArtistImageResult {
    image: string | null
    /** Qué fuente resolvió la imagen, para poder diagnosticar sin adivinar. */
    source: 'spotify' | 'deezer' | null
}

const NONE: ArtistImageResult = { image: null, source: null }

/**
 * Nunca tira ni propaga el error de una fuente: si todas fallan devuelve
 * `{ image: null, source: null }` y quien llama muestra el diseño sin foto.
 * Es el contrato del ADR 0003 — la información propia se muestra igual y el
 * enriquecimiento de terceros es opcional.
 */
export async function getArtistImage(name: string): Promise<ArtistImageResult> {
    const term = name?.trim()
    if (!term) return NONE

    if (isSpotifyConfigured()) {
        const { artist } = await searchSpotifyArtist(term)
        const image = artist ? getBestSpotifyImage(artist.images) : null
        if (image) return { image, source: 'spotify' }
    }

    const { image } = await searchDeezerArtistImage(term)
    if (image) return { image, source: 'deezer' }

    return NONE
}
