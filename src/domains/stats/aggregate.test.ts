import { describe, it, expect } from 'vitest'
import { aggregateEventStats } from '@/src/domains/stats/aggregate'

// Fase 3 (R2-005): esta lógica vivía duplicada en app/wrapped/page.tsx con
// su propia implementación de conteo — ahora getPersonalStats y Wrapped
// llaman a esta misma función, cada uno con la lista de eventos que ya
// filtró (todo el historial vs. solo el año seleccionado). Separada de
// stats/data.ts (que sí toca la DB) para que se pueda importar y testear
// sin arrastrar 'server-only' (ver comentario en aggregate.ts).
describe('aggregateEventStats', () => {
  it('counts unique artists/venues and sorts top lists by show count', () => {
    const result = aggregateEventStats([
      { lineups: [{ artists: { name: 'Bandalos Chinos' } }], venues: { name: 'Niceto', city: 'CABA', country: 'AR' }, rating: 4 },
      { lineups: [{ artists: { name: 'Bandalos Chinos' } }], venues: { name: 'Niceto', city: 'CABA', country: 'AR' }, rating: 3 },
      { lineups: [{ artists: { name: 'Usted Señálemelo' } }], venues: { name: 'Groove', city: 'CABA', country: 'AR' }, rating: null },
    ])

    expect(result.uniqueArtists).toBe(2)
    expect(result.uniqueVenues).toBe(2)
    expect(result.uniqueCities).toEqual(['CABA'])
    expect(result.topArtists[0]).toEqual({ name: 'Bandalos Chinos', count: 2 })
    expect(result.topVenues[0]).toEqual({ name: 'Niceto', city: 'CABA', count: 2 })
  })

  it('averages only the rated events, rounded to one decimal', () => {
    const result = aggregateEventStats([
      { rating: 4 },
      { rating: 5 },
      { rating: null },
    ])

    expect(result.averageRating).toBe(4.5)
    expect(result.totalRated).toBe(2)
  })

  it('returns null averageRating and zero counts for an empty list', () => {
    const result = aggregateEventStats([])

    expect(result.averageRating).toBeNull()
    expect(result.totalRated).toBe(0)
    expect(result.uniqueArtists).toBe(0)
    expect(result.topArtists).toEqual([])
  })

  it('ignores events with no venue/lineup instead of throwing', () => {
    const result = aggregateEventStats([{ rating: 5 }, { lineups: null, venues: null, rating: null }])

    expect(result.uniqueArtists).toBe(0)
    expect(result.uniqueVenues).toBe(0)
    expect(result.totalRated).toBe(1)
  })
})
