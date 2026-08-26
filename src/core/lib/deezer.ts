/**
 * Cliente para la API pública de Deezer, usado como fuente de fotos de
 * artista cuando Spotify no está configurado.
 *
 * A diferencia de las otras cuatro integraciones externas, ésta no necesita
 * credenciales: la búsqueda de artistas es pública, sin key ni OAuth. Por eso
 * `isDeezerConfigured()` no existe — está siempre disponible, y es lo que
 * permite que la app muestre imágenes en una instalación recién clonada, sin
 * que el colaborador consiga una sola API key.
 *
 * Docs: https://developers.deezer.com/api/search
 */
import 'server-only'
import { fetchWithTimeout, isTimeoutError } from '@/src/core/lib/http'

const BASE = 'https://api.deezer.com'

/**
 * Deezer devuelve la foto en varios tamaños fijos. Se prefiere la más grande
 * porque el hero la usa a pantalla completa; las chicas se ven borrosas.
 */
interface DeezerArtist {
    id: number
    name: string
    picture_xl?: string
    picture_big?: string
    picture_medium?: string
    picture?: string
}

interface DeezerSearchResponse {
    data?: DeezerArtist[]
    error?: { message?: string }
}

export interface DeezerImageResult {
    image: string | null
    error?: string
}

/**
 * Deezer devuelve una URL de placeholder genérica cuando el artista no tiene
 * foto cargada. Mostrarla sería peor que no mostrar nada: es una silueta gris
 * igual para todos.
 */
function isPlaceholder(url: string): boolean {
    return /\/images\/artist\/?$/.test(url) || url.includes('/artist//')
}

function bestPicture(artist: DeezerArtist): string | null {
    const candidate =
        artist.picture_xl || artist.picture_big || artist.picture_medium || artist.picture
    if (!candidate || isPlaceholder(candidate)) return null
    return candidate
}

/**
 * Foto del artista por nombre. Nunca tira: ante timeout, error de red o
 * respuesta inesperada devuelve `{ image: null, error }`, igual que el resto
 * de los clientes externos — ver el ADR 0003. Quien llama decide si degradar
 * en silencio o mostrar el motivo.
 */
export async function searchDeezerArtistImage(name: string): Promise<DeezerImageResult> {
    const term = name.trim()
    if (!term) return { image: null }

    const url = `${BASE}/search/artist?${new URLSearchParams({ q: term, limit: '1' }).toString()}`

    try {
        const res = await fetchWithTimeout(url)
        if (!res.ok) {
            return { image: null, error: `Deezer respondió con error ${res.status}.` }
        }

        const body = (await res.json()) as DeezerSearchResponse
        if (body.error) {
            return { image: null, error: body.error.message ?? 'Deezer devolvió un error.' }
        }

        const artist = body.data?.[0]
        if (!artist) return { image: null }

        return { image: bestPicture(artist) }
    } catch (e) {
        if (isTimeoutError(e)) {
            return { image: null, error: 'Deezer tardó demasiado en responder.' }
        }
        console.error('Error consultando Deezer:', e)
        return { image: null, error: 'Error al conectar con Deezer.' }
    }
}
