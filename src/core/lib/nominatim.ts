/**
 * Geocodificación de sedes vía Nominatim (OpenStreetMap).
 *
 * Las columnas `lat`/`lng` de `venues` existen desde el issue #8 pero nunca se
 * llenaron: el alta de sede sólo pide nombre, ciudad, dirección y país. Sin
 * coordenadas `getEventWeather` corta y devuelve null, así que el clima del
 * show —construido y testeado— quedaba apagado en todos los eventos.
 *
 * Como Deezer, no necesita credenciales: es la única fuente de geocodificación
 * usable sin registrarse ni pagar. Medido sobre sedes argentinas reales
 * (Vorterix, Niceto, Luna Park, El Teatro Flores, Obras, Quality Córdoba):
 * 6 de 6, con el tipo de lugar correcto.
 *
 * Su política de uso exige dos cosas, y las dos se cumplen acá:
 *   1. Un User-Agent identificatorio con forma de contacto — sin él bloquean.
 *   2. Máximo 1 request por segundo. Por eso esto NO se llama en bucle sobre
 *      un listado: se geocodifica una sede al crearla, y el backfill de las
 *      existentes va espaciado (ver scripts/geocode-venues.ts).
 *
 * Docs: https://operations.osmfoundation.org/policies/nominatim/
 */
import 'server-only'
import { fetchWithTimeout, isTimeoutError } from '@/src/core/lib/http'

const BASE = 'https://nominatim.openstreetmap.org'

/**
 * Nominatim rechaza clientes sin User-Agent propio. Identifica a la app y deja
 * una vía de contacto, que es literalmente lo que pide su política.
 */
const USER_AGENT = 'Ritual/1.0 (https://github.com/Lantieridev/Ritual)'

/**
 * Techo propio, más bajo que los 8s por defecto de `fetchWithTimeout`: el alta
 * de sede es interactiva —el usuario está esperando frente al combobox— y las
 * coordenadas son un extra. Es preferible crear la sede sin ellas y dejar que
 * el backfill las complete después, antes que hacerlo esperar 8 segundos.
 */
const TIMEOUT_INTERACTIVO_MS = 3000

export interface GeocodeResult {
    lat: number | null
    lng: number | null
    error?: string
}

const NONE: GeocodeResult = { lat: null, lng: null }

interface NominatimPlace {
    lat?: string
    lon?: string
}

/**
 * Nominatim devuelve lat/lon como strings. Una respuesta con un valor no
 * numérico o fuera de rango es peor que ninguna: se guardaría una coordenada
 * inválida que después le pide a Open-Meteo el clima de un punto inexistente.
 */
function toCoord(raw: string | undefined, limite: number): number | null {
    if (!raw) return null
    const n = Number(raw)
    if (!Number.isFinite(n) || Math.abs(n) > limite) return null
    return n
}

/**
 * Arma la consulta con lo que se sepa de la sede. La dirección primero porque
 * es lo más específico; el nombre solo alcanza para lugares conocidos, pero
 * para un bar chico sin página de OSM no resuelve nada.
 */
function buildQuery(venue: { name: string; address?: string | null; city?: string | null }): string {
    return [venue.address?.trim(), venue.name.trim(), venue.city?.trim()]
        .filter(Boolean)
        .join(', ')
}

/**
 * Coordenadas de una sede. Nunca tira: ante timeout, error de red o respuesta
 * inesperada devuelve `{ lat: null, lng: null, error }`, igual que el resto de
 * los clientes externos — ver el ADR 0003. Quien llama decide si guarda la
 * sede sin coordenadas (que es lo que corresponde: la sede vale igual).
 */
export async function geocodeVenue(
    venue: {
        name: string
        address?: string | null
        city?: string | null
        country?: string | null
    },
    timeoutMs: number = TIMEOUT_INTERACTIVO_MS
): Promise<GeocodeResult> {
    const q = buildQuery(venue)
    if (!q) return NONE

    const params = new URLSearchParams({ q, format: 'json', limit: '1' })
    // Acotar por país cuando se conoce evita que "Luna Park" resuelva al de
    // otro continente. Nominatim espera el código ISO en minúscula.
    const cc = venue.country?.trim().toLowerCase()
    if (cc && cc.length === 2) params.set('countrycodes', cc)

    try {
        const res = await fetchWithTimeout(
            `${BASE}/search?${params.toString()}`,
            { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' } },
            timeoutMs
        )
        if (!res.ok) {
            return { ...NONE, error: `Nominatim respondió con error ${res.status}.` }
        }

        const body = (await res.json()) as NominatimPlace[]
        const place = Array.isArray(body) ? body[0] : undefined
        if (!place) return NONE

        const lat = toCoord(place.lat, 90)
        const lng = toCoord(place.lon, 180)
        // Media coordenada no sirve: el clima necesita las dos.
        if (lat === null || lng === null) return NONE

        return { lat, lng }
    } catch (e) {
        if (isTimeoutError(e)) {
            return { ...NONE, error: 'Nominatim tardó demasiado en responder.' }
        }
        console.error('Error consultando Nominatim:', e)
        return { ...NONE, error: 'Error al conectar con Nominatim.' }
    }
}
