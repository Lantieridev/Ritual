/**
 * Cliente para la API de Bandsintown (recitales y artistas).
 * Solo se usa en servidor. Requiere BANDSINTOWN_APP_ID en .env.local.
 * Así la búsqueda no sobrecarga la base: se consulta la API y solo se persiste lo que el usuario agrega.
 */

const BASE = 'https://rest.bandsintown.com'

/** Respuesta de venue en un evento Bandsintown. */
export interface BandsintownVenue {
  name: string
  city?: string
  country?: string
  region?: string
  latitude?: string
  longitude?: string
}

/** Un evento devuelto por la API. */
export interface BandsintownEvent {
  id: string
  datetime: string
  title?: string
  venue: BandsintownVenue
  lineup?: string[]
  url?: string
  offers?: Array<{ type: string; url: string; status: string }>
}

function getAppId(): string | undefined {
  return process.env.BANDSINTOWN_APP_ID
}

/**
 * Devuelve si la API está configurada (hay app_id).
 */
export function isBandsintownConfigured(): boolean {
  return Boolean(getAppId()?.trim())
}

/**
 * Eventos de un artista por nombre.
 * GET /artists/{artist_name}/events
 */
export async function getBandsintownEventsByArtist(
  artistName: string
): Promise<{ events: BandsintownEvent[]; error?: string }> {
  const appId = getAppId()
  if (!appId?.trim()) {
    return { events: [], error: 'BANDSINTOWN_APP_ID no configurado.' }
  }

  const encoded = encodeURIComponent(artistName.trim())
  const url = `${BASE}/artists/${encoded}/events?app_id=${appId}`

  try {
    const res = await fetch(url, { next: { revalidate: 300 } })
    if (res.status === 403) {
      return { events: [], error: 'App ID inválido o sin permisos (403). Verificá que BANDSINTOWN_APP_ID en .env.local sea correcto y esté activo.' }
    }
    if (!res.ok) {
      return { events: [], error: `La API respondió con error ${res.status}. Intentá de nuevo más tarde.` }
    }
    const data = await res.json()
    const events = Array.isArray(data) ? (data as BandsintownEvent[]) : []
    return { events }
  } catch (e) {
    console.error('Bandsintown artist events:', e)
    return { events: [], error: 'Error al conectar con la API. Verificá tu conexión.' }
  }
}

/**
 * Eventos por ubicación (ciudad, país o "Ciudad,Región").
 * GET /events?location=...&app_id=...
 */
export async function getBandsintownEventsByLocation(
  location: string
): Promise<{ events: BandsintownEvent[]; error?: string }> {
  const appId = getAppId()
  if (!appId?.trim()) {
    return { events: [], error: 'BANDSINTOWN_APP_ID no configurado.' }
  }

  const encoded = encodeURIComponent(location.trim())
  const url = `${BASE}/events?app_id=${appId}&location=${encoded}`

  try {
    const res = await fetch(url, { next: { revalidate: 300 } })
    if (res.status === 403) {
      return { events: [], error: 'App ID inválido o sin permisos (403). Verificá que BANDSINTOWN_APP_ID en .env.local sea correcto y esté activo.' }
    }
    if (!res.ok) {
      return { events: [], error: `La API respondió con error ${res.status}. Intentá de nuevo más tarde.` }
    }
    const data = await res.json()
    const events = Array.isArray(data) ? (data as BandsintownEvent[]) : []
    return { events }
  } catch (e) {
    console.error('Bandsintown location events:', e)
    return { events: [], error: 'Error al conectar con la API. Verificá tu conexión.' }
  }
}
