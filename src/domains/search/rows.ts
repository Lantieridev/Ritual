import { routes } from '@/src/core/lib/routes'
import { formatDate } from '@/src/core/lib/utils'
import { festivalMetaLine } from './festivalMeta'
import type { CatalogSearchResults } from './service'

/**
 * Fila normalizada para la pantalla mobile de búsqueda (D-1 del design.md):
 * un solo shape plano para las cuatro entidades en vez de una unión
 * discriminada — la fila pinta siempre los mismos tres slots (thumb /
 * título / meta), así que el componente presentacional no necesita saber
 * de qué tabla vino cada resultado.
 */
export type SearchRowKind = 'event' | 'artist' | 'venue' | 'festival'
export type SearchFilter = 'todo' | 'artistas' | 'sedes' | 'festivales' | 'cerca'

export interface SearchRow {
    kind: SearchRowKind
    id: string
    /** Big Shoulders 900 22px */
    title: string
    /** Segunda línea; `null` cuando no hay ningún dato real que mostrar — nunca se inventa. */
    meta: string | null
    href: string
    /** Sólo viene de `searchNearby` — su ausencia es, en sí misma, la promesa de no reclamar una distancia que no se calculó. */
    distanceKm?: number
}

function eventRow(ev: CatalogSearchResults['events'][number]): SearchRow {
    return {
        kind: 'event',
        id: ev.id,
        title: ev.name || 'Recital',
        meta: formatDate(ev.date, { day: 'numeric', month: 'short', year: 'numeric' }),
        href: routes.events.detail(ev.id),
    }
}

function artistRow(a: CatalogSearchResults['artists'][number]): SearchRow {
    return { kind: 'artist', id: a.id, title: a.name, meta: a.genre ?? null, href: routes.artists.detail(a.id) }
}

function venueRow(v: CatalogSearchResults['venues'][number]): SearchRow {
    const meta = [v.city, v.country].filter(Boolean).join(', ')
    return { kind: 'venue', id: v.id, title: v.name, meta: meta || null, href: routes.venues.detail(v.id) }
}

function festivalRow(f: CatalogSearchResults['festivals'][number]): SearchRow {
    return {
        kind: 'festival',
        id: f.id,
        title: f.name,
        meta: festivalMetaLine(f.edition, f.city),
        href: routes.festivals.detail(f.id),
    }
}

/** Mapea los resultados de `searchCatalog` a filas, filtradas por el chip activo. `cerca` no aplica acá — usa `nearbyToSearchRows`. */
export function toSearchRows(r: CatalogSearchResults, f: SearchFilter): SearchRow[] {
    switch (f) {
        case 'artistas':
            return r.artists.map(artistRow)
        case 'sedes':
            return r.venues.map(venueRow)
        case 'festivales':
            return r.festivals.map(festivalRow)
        case 'cerca':
            return []
        case 'todo':
            return [...r.events.map(eventRow), ...r.artists.map(artistRow), ...r.venues.map(venueRow), ...r.festivals.map(festivalRow)]
    }
}

/** Mapea las sedes de `searchNearby` (status: 'ok') a filas — la única fuente que puede llevar `distanceKm`. */
export function nearbyToSearchRows(venues: Array<{ id: string; name: string; city: string | null; distanceKm: number }>): SearchRow[] {
    return venues.map((v) => ({
        kind: 'venue',
        id: v.id,
        title: v.name,
        meta: v.city,
        href: routes.venues.detail(v.id),
        distanceKm: v.distanceKm,
    }))
}

/** Construye la URL de `/buscar` para el form/los chips mobile — siempre con `tab=archivo` (D-5 del design.md). */
export function buscarHref(p: { q: string; filtro: SearchFilter }): string {
    const usp = new URLSearchParams()
    usp.set('tab', 'archivo')
    if (p.q) usp.set('q', p.q)
    usp.set('filtro', p.filtro)
    return `${routes.events.search}?${usp.toString()}`
}

const VALID_FILTERS: readonly SearchFilter[] = ['todo', 'artistas', 'sedes', 'festivales', 'cerca']

/** Valida el `filtro` de la URL contra los 5 valores conocidos — cualquier otra cosa (ausente, viejo, manipulado) cae a `'todo'`, nunca revienta la página. */
export function parseSearchFilter(raw: string | undefined): SearchFilter {
    return (VALID_FILTERS as readonly string[]).includes(raw ?? '') ? (raw as SearchFilter) : 'todo'
}

const FILTER_LABELS: Record<SearchFilter, string | null> = {
    todo: null,
    artistas: 'Artistas',
    sedes: 'Sedes',
    festivales: 'Festivales',
    cerca: 'Cerca',
}

/** Etiqueta del header de resultados por chip activo — `null` para "Todo" (spec: sin label cuando se ven todos los tipos). */
export function filterLabel(f: SearchFilter): string | null {
    return FILTER_LABELS[f]
}
