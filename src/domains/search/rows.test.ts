import { describe, it, expect } from 'vitest'
import { toSearchRows, nearbyToSearchRows, buscarHref, filterLabel, parseSearchFilter } from '@/src/domains/search/rows'
import type { CatalogSearchResults } from '@/src/domains/search/service'
import { routes } from '@/src/core/lib/routes'

const CATALOG: CatalogSearchResults = {
  events: [{ id: 'e1', name: 'Show en Obras', date: '2026-02-14' }],
  artists: [
    { id: 'a1', name: 'Divididos', genre: 'Rock' },
    { id: 'a2', name: 'Artista sin género', genre: null },
  ],
  venues: [
    { id: 'v1', name: 'Estadio Obras', city: 'CABA', country: 'AR' },
    { id: 'v2', name: 'Sede sin ciudad', city: null, country: null },
  ],
  festivals: [
    { id: 'f1', name: 'Cosquín Rock', edition: '2026', city: 'Córdoba', start_date: '2026-02-14' },
    { id: 'f2', name: 'Sin edición', edition: null, city: 'Rosario', start_date: null },
    { id: 'f3', name: 'Sin nada', edition: null, city: null, start_date: null },
  ],
}

describe('toSearchRows', () => {
  it('filtro "todo": incluye las cuatro entidades', () => {
    const rows = toSearchRows(CATALOG, 'todo')
    expect(rows.map((r) => r.kind)).toEqual(['event', 'artist', 'artist', 'venue', 'venue', 'festival', 'festival', 'festival'])
  })

  it('filtro "artistas": sólo artistas, con href a la ruta de detalle', () => {
    const rows = toSearchRows(CATALOG, 'artistas')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ kind: 'artist', id: 'a1', title: 'Divididos', meta: 'Rock', href: routes.artists.detail('a1') })
  })

  it('filtro "sedes": sólo venues, con href a la ruta de detalle', () => {
    const rows = toSearchRows(CATALOG, 'sedes')
    expect(rows).toHaveLength(2)
    expect(rows[0]).toMatchObject({ kind: 'venue', id: 'v1', title: 'Estadio Obras', href: routes.venues.detail('v1') })
  })

  it('filtro "festivales": sólo festivales, con href a la ruta de detalle', () => {
    const rows = toSearchRows(CATALOG, 'festivales')
    expect(rows).toHaveLength(3)
    expect(rows[0].href).toBe(routes.festivals.detail('f1'))
  })

  it('filtro "cerca": no aplica a resultados de catálogo — devuelve vacío (usa nearbyToSearchRows)', () => {
    expect(toSearchRows(CATALOG, 'cerca')).toEqual([])
  })

  it('meta es null cuando no hay ningún dato real — nunca se inventa', () => {
    const rows = toSearchRows(CATALOG, 'artistas')
    expect(rows.find((r) => r.id === 'a2')!.meta).toBeNull()

    const venueRows = toSearchRows(CATALOG, 'sedes')
    expect(venueRows.find((r) => r.id === 'v2')!.meta).toBeNull()
  })

  it('ninguna fila de catálogo lleva distanceKm — sólo lo agrega nearbyToSearchRows', () => {
    const rows = toSearchRows(CATALOG, 'todo')
    expect(rows.every((r) => r.distanceKm === undefined)).toBe(true)
  })

  it('meta de festival sigue la regla edición → ciudad → null (misma regla que festivalMetaLine)', () => {
    const rows = toSearchRows(CATALOG, 'festivales')
    expect(rows.find((r) => r.id === 'f1')!.meta).toBe('Festival · 2026')
    expect(rows.find((r) => r.id === 'f2')!.meta).toBe('Festival · Rosario')
    expect(rows.find((r) => r.id === 'f3')!.meta).toBeNull()
  })
})

describe('nearbyToSearchRows', () => {
  it('mapea sedes cercanas con distanceKm y kind "venue"', () => {
    const rows = nearbyToSearchRows([
      { id: 'v1', name: 'Estadio Obras', city: 'CABA', distanceKm: 3.42 },
      { id: 'v2', name: 'Teatro Colón', city: null, distanceKm: 5.1 },
    ])
    expect(rows).toEqual([
      { kind: 'venue', id: 'v1', title: 'Estadio Obras', meta: 'CABA', href: routes.venues.detail('v1'), distanceKm: 3.42 },
      { kind: 'venue', id: 'v2', title: 'Teatro Colón', meta: null, href: routes.venues.detail('v2'), distanceKm: 5.1 },
    ])
  })
})

describe('buscarHref', () => {
  it('arma la URL de /buscar con tab=archivo, q y filtro', () => {
    expect(buscarHref({ q: 'obras', filtro: 'artistas' })).toBe(`${routes.events.search}?tab=archivo&q=obras&filtro=artistas`)
  })

  it('omite q cuando está vacío', () => {
    expect(buscarHref({ q: '', filtro: 'cerca' })).toBe(`${routes.events.search}?tab=archivo&filtro=cerca`)
  })
})

describe('parseSearchFilter', () => {
  it('acepta cualquiera de los 5 valores válidos', () => {
    expect(parseSearchFilter('artistas')).toBe('artistas')
    expect(parseSearchFilter('sedes')).toBe('sedes')
    expect(parseSearchFilter('festivales')).toBe('festivales')
    expect(parseSearchFilter('cerca')).toBe('cerca')
    expect(parseSearchFilter('todo')).toBe('todo')
  })

  it('cualquier valor inválido o ausente cae a "todo"', () => {
    expect(parseSearchFilter(undefined)).toBe('todo')
    expect(parseSearchFilter('cualquier-cosa')).toBe('todo')
  })
})

describe('filterLabel', () => {
  it('devuelve null para "todo" — sin label de chip', () => {
    expect(filterLabel('todo')).toBeNull()
  })

  it('devuelve el nombre del chip para los demás filtros', () => {
    expect(filterLabel('artistas')).toBe('Artistas')
    expect(filterLabel('sedes')).toBe('Sedes')
    expect(filterLabel('festivales')).toBe('Festivales')
    expect(filterLabel('cerca')).toBe('Cerca')
  })
})
