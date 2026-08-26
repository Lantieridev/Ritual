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
 * Presupuesto total para resolver la imagen, en milisegundos.
 *
 * Cada fuente usa `fetchWithTimeout`, que aborta a los 8 segundos, y Spotify
 * además pide un token antes de buscar. Encadenadas en serie, el peor caso
 * supera holgadamente el límite de ejecución de una función serverless: el
 * render se quedaría colgado hasta que la plataforma lo corte con un 504.
 *
 * Con un techo global, si las fuentes tardan la Home se dibuja sin foto —que
 * es un resultado aceptable— en vez de no dibujarse.
 */
const PRESUPUESTO_MS = 6000

/**
 * El valor entra en `style={{ backgroundImage: url(...) }}`, así que un
 * paréntesis o un punto y coma en la URL se escaparía de la declaración CSS.
 * Viene de JSON de terceros y no del usuario, pero validarlo cuesta poco y
 * evita depender de que la API remota siempre devuelva algo bien formado.
 *
 * Se exige https y una URL parseable, y se rechaza cualquier carácter que
 * pueda romper el contexto CSS o abrir un esquema distinto.
 */
export function esUrlDeImagenSegura(url: string): boolean {
    if (/["'()\\;\s<>]/.test(url)) return false
    try {
        return new URL(url).protocol === 'https:'
    } catch {
        return false
    }
}

function conPresupuesto<T>(promesa: Promise<T>, alVencer: T): Promise<T> {
    return Promise.race([
        promesa,
        new Promise<T>((resolve) => setTimeout(() => resolve(alVencer), PRESUPUESTO_MS)),
    ])
}

/**
 * Nunca tira ni propaga el error de una fuente: si todas fallan devuelve
 * `{ image: null, source: null }` y quien llama muestra el diseño sin foto.
 * Es el contrato del ADR 0003 — la información propia se muestra igual y el
 * enriquecimiento de terceros es opcional.
 */
export async function getArtistImage(name: string): Promise<ArtistImageResult> {
    const term = name?.trim()
    if (!term) return NONE

    return conPresupuesto(resolverEnCadena(term), NONE)
}

async function resolverEnCadena(term: string): Promise<ArtistImageResult> {
    if (isSpotifyConfigured()) {
        const { artist } = await searchSpotifyArtist(term)
        const image = artist ? getBestSpotifyImage(artist.images) : null
        if (image && esUrlDeImagenSegura(image)) return { image, source: 'spotify' }
    }

    const { image } = await searchDeezerArtistImage(term)
    if (image && esUrlDeImagenSegura(image)) return { image, source: 'deezer' }

    return NONE
}
