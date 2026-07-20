import 'server-only'
import { createClient } from '@/src/core/lib/supabase/server'
import { escapeLikeWildcards } from '@/src/core/lib/validation'
import { findRankingContext } from '@/src/domains/taste/service'
import { haversineKm, parseCoord, type LatLng } from '@/src/core/lib/geo'

const MAX_RESULTS_PER_TYPE = 8

/**
 * Media anchura de la bounding box para "Cerca" (±1.5° ≈ 165km): un
 * pre-filtro barato en SQL antes de ordenar por distancia real en memoria —
 * no es un valor del spec, es una decisión de diseño (ver design.md, Open
 * Questions). Si la sede más cercana de un usuario cae afuera, el fallo
 * honesto es una lista `ok` vacía, nunca una distancia inventada.
 */
const NEARBY_BBOX_DEGREES = 1.5

/** Techo de filas que trae la bbox antes de ordenar/cortar en memoria — no es un valor del spec, sólo evita traer una ciudad entera sin límite. */
const NEARBY_FETCH_LIMIT = 200

export interface CatalogSearchResults {
    events: Array<{ id: string; name: string | null; date: string }>
    artists: Array<{ id: string; name: string; genre: string | null }>
    venues: Array<{ id: string; name: string; city: string | null; country: string | null }>
    festivals: Array<{ id: string; name: string; edition: string | null; city: string | null; start_date: string | null }>
}

const EMPTY: CatalogSearchResults = { events: [], artists: [], venues: [], festivals: [] }

/**
 * Búsqueda por nombre sobre las cuatro tablas del catálogo (events, artists,
 * venues, festivals), para la pestaña "en tu archivo" de /buscar y para la
 * pantalla mobile unificada.
 *
 * Vivía como una función suelta dentro de `app/buscar/page.tsx`, con su propio
 * `createClient()` — la única ruta del proyecto que salteaba la capa de
 * dominio. Además interpolaba el término crudo en el `ilike`.
 *
 * Se apoya en los índices GIN trigram de
 * 20260824205500_performance_indexes.sql.
 */
export async function searchCatalog(query: string): Promise<CatalogSearchResults> {
    const term = query.trim()
    if (!term) return EMPTY

    const pattern = `%${escapeLikeWildcards(term)}%`
    const supabase = await createClient()

    const [eventsRes, artistsRes, venuesRes, festivalsRes] = await Promise.all([
        supabase
            .from('events')
            .select('id, name, date')
            .ilike('name', pattern)
            .order('date', { ascending: false })
            .limit(MAX_RESULTS_PER_TYPE),
        supabase
            .from('artists')
            .select('id, name, genre')
            .ilike('name', pattern)
            .limit(MAX_RESULTS_PER_TYPE),
        supabase
            .from('venues')
            .select('id, name, city, country')
            .ilike('name', pattern)
            .limit(MAX_RESULTS_PER_TYPE),
        supabase
            .from('festivals')
            .select('id, name, edition, city, start_date')
            .ilike('name', pattern)
            .limit(MAX_RESULTS_PER_TYPE),
    ])

    for (const res of [eventsRes, artistsRes, venuesRes, festivalsRes]) {
        if (res.error) console.error('Error en la búsqueda del catálogo:', res.error)
    }

    return {
        events: eventsRes.data ?? [],
        artists: artistsRes.data ?? [],
        venues: venuesRes.data ?? [],
        festivals: festivalsRes.data ?? [],
    }
}

/**
 * Resultado del filtro "Cerca", con el motivo de degradación explícito en
 * vez de una lista vacía indistinguible de "no hay nada cerca" (D-4 del
 * design.md, mismo patrón que `TasteBasis` en el issue #81).
 */
export type NearbySearchResult =
    | { status: 'ok'; venues: Array<{ id: string; name: string; city: string | null; distanceKm: number }> }
    | { status: 'no-session' }
    | { status: 'no-city' }

/**
 * Ordena sedes por distancia real (`haversineKm`) desde la ciudad guardada
 * del usuario. Función separada de `searchCatalog` (D-3 del design.md): la
 * necesidad de sesión, coordenadas y bounding box no encajan en el contrato
 * "un patrón de texto → cuatro listas". Artistas y festivales nunca
 * aparecen acá — no tienen coordenadas propias (D-6).
 */
export async function searchNearby(query?: string): Promise<NearbySearchResult> {
    const supabase = await createClient()
    const {
        data: { user },
    } = await supabase.auth.getUser()
    if (!user) return { status: 'no-session' }

    const rankingContext = await findRankingContext(user.id)
    const cityCoords = rankingContext?.cityCoords
    if (!cityCoords) return { status: 'no-city' }

    const term = query?.trim()
    let venuesQuery = supabase
        .from('venues')
        .select('id, name, city, lat, lng')
        .not('lat', 'is', null)
        .not('lng', 'is', null)
        .gte('lat', cityCoords.lat - NEARBY_BBOX_DEGREES)
        .lte('lat', cityCoords.lat + NEARBY_BBOX_DEGREES)
        .gte('lng', cityCoords.lng - NEARBY_BBOX_DEGREES)
        .lte('lng', cityCoords.lng + NEARBY_BBOX_DEGREES)

    if (term) {
        venuesQuery = venuesQuery.ilike('name', `%${escapeLikeWildcards(term)}%`)
    }

    const { data, error } = await venuesQuery.limit(NEARBY_FETCH_LIMIT)
    if (error) console.error('Error en la búsqueda de sedes cercanas:', error)

    const rows: Array<{ id: string; name: string; city: string | null; lat: unknown; lng: unknown }> = data ?? []

    const withDistance = rows
        .map((row) => {
            const lat = parseCoord(row.lat, 'lat')
            const lng = parseCoord(row.lng, 'lng')
            if (lat === null || lng === null) return null
            const venueCoords: LatLng = { lat, lng }
            return { id: row.id, name: row.name, city: row.city, distanceKm: haversineKm(cityCoords, venueCoords) }
        })
        .filter((v): v is { id: string; name: string; city: string | null; distanceKm: number } => v !== null)
        .sort((a, b) => a.distanceKm - b.distanceKm)
        .slice(0, MAX_RESULTS_PER_TYPE)

    return { status: 'ok', venues: withDistance }
}
