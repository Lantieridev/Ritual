import 'server-only'
import { createClient } from '@/src/core/lib/supabase/server'
import { escapeLikeWildcards } from '@/src/core/lib/validation'

const MAX_RESULTS_PER_TYPE = 8

export interface CatalogSearchResults {
    events: Array<{ id: string; name: string | null; date: string }>
    artists: Array<{ id: string; name: string; genre: string | null }>
    venues: Array<{ id: string; name: string; city: string | null; country: string | null }>
}

const EMPTY: CatalogSearchResults = { events: [], artists: [], venues: [] }

/**
 * Búsqueda por nombre sobre las tres tablas del catálogo, para la pestaña
 * "en tu archivo" de /buscar.
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

    const [eventsRes, artistsRes, venuesRes] = await Promise.all([
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
    ])

    for (const res of [eventsRes, artistsRes, venuesRes]) {
        if (res.error) console.error('Error en la búsqueda del catálogo:', res.error)
    }

    return {
        events: eventsRes.data ?? [],
        artists: artistsRes.data ?? [],
        venues: venuesRes.data ?? [],
    }
}
