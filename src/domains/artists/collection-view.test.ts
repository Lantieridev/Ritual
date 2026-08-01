import { describe, it, expect } from 'vitest'
import { buildArtistShelves, buildCollectionTerritory } from '@/src/domains/artists/collection-view'
import type { Artist } from '@/src/core/types'

function makeArtist(overrides: Partial<Artist> & { id: string; name: string }): Artist {
  return { genre: null, image_url: null, spotify_id: null, ...overrides }
}

describe('buildArtistShelves', () => {
  const artists: Artist[] = [
    makeArtist({ id: 'a1', name: 'Redonditos' }), // 6 shows -> core
    makeArtist({ id: 'a2', name: 'Babasónicos' }), // 3 shows -> returned
    makeArtist({ id: 'a3', name: 'Él Mató' }), // 1 show -> once
    makeArtist({ id: 'a4', name: 'Spinetta' }), // 0 shows, wishlisted -> gaps
    makeArtist({ id: 'a5', name: 'Sin relación' }), // 0 shows, not wishlisted -> catalog
  ]
  const topArtistsSeen = [
    { name: 'Redonditos', count: 6 },
    { name: 'Babasónicos', count: 3 },
    { name: 'Él Mató', count: 1 },
  ]
  const wishlistIds = new Set(['a4'])

  it('sorts a 5+ times artist into the core shelf', () => {
    const shelves = buildArtistShelves(artists, topArtistsSeen, wishlistIds)
    expect(shelves.core.map((a) => a.id)).toEqual(['a1'])
    expect(shelves.core[0].timesSeen).toBe(6)
  })

  it('sorts a 2-4 times artist into the returned shelf', () => {
    const shelves = buildArtistShelves(artists, topArtistsSeen, wishlistIds)
    expect(shelves.returned.map((a) => a.id)).toEqual(['a2'])
  })

  it('sorts an exactly-once artist into the once shelf', () => {
    const shelves = buildArtistShelves(artists, topArtistsSeen, wishlistIds)
    expect(shelves.once.map((a) => a.id)).toEqual(['a3'])
  })

  it('sorts an unseen wishlisted artist into gaps, not catalog', () => {
    const shelves = buildArtistShelves(artists, topArtistsSeen, wishlistIds)
    expect(shelves.gaps.map((a) => a.id)).toEqual(['a4'])
  })

  it('sorts an unseen, non-wishlisted artist into the plain catalog', () => {
    const shelves = buildArtistShelves(artists, topArtistsSeen, wishlistIds)
    expect(shelves.catalog.map((a) => a.id)).toEqual(['a5'])
  })

  it('is empty across every shelf for an empty catalog', () => {
    const shelves = buildArtistShelves([], [], new Set())
    expect(shelves).toEqual({ core: [], returned: [], once: [], gaps: [], catalog: [] })
  })
})

describe('buildCollectionTerritory', () => {
  const artists: Artist[] = [
    makeArtist({ id: 'a1', name: 'Redonditos', genre: 'Rock' }),
    makeArtist({ id: 'a2', name: 'Babasónicos', genre: 'Rock' }),
    makeArtist({ id: 'a3', name: 'Bandalos Chinos', genre: 'Indie' }),
  ]
  const topArtistsSeen = [
    { name: 'Redonditos', count: 6 },
    { name: 'Babasónicos', count: 3 },
    { name: 'Bandalos Chinos', count: 1 },
  ]
  const topVenuesSeen = [
    { name: 'Niceto', city: 'CABA', count: 5 },
    { name: 'Groove', city: 'CABA', count: 2 },
  ]

  it('counts unique artists seen from the aggregated list, not the whole catalog', () => {
    const territory = buildCollectionTerritory(artists, topArtistsSeen, topVenuesSeen)
    expect(territory.uniqueArtistsSeen).toBe(3)
  })

  it('counts only repeated (2+) artists as "fidelidad"', () => {
    const territory = buildCollectionTerritory(artists, topArtistsSeen, topVenuesSeen)
    expect(territory.repeatedArtists).toBe(2) // Redonditos + Babasónicos, not Bandalos Chinos
  })

  it('ranks genres by how many seen artists share them', () => {
    const territory = buildCollectionTerritory(artists, topArtistsSeen, topVenuesSeen)
    expect(territory.topGenres).toEqual([
      { genre: 'Rock', count: 2 },
      { genre: 'Indie', count: 1 },
    ])
  })

  it('picks the most-visited venue as homeVenue', () => {
    const territory = buildCollectionTerritory(artists, topArtistsSeen, topVenuesSeen)
    expect(territory.homeVenue).toEqual({ name: 'Niceto', city: 'CABA', count: 5 })
  })

  it('is null for homeVenue when nothing was attended', () => {
    const territory = buildCollectionTerritory(artists, [], [])
    expect(territory.homeVenue).toBeNull()
  })
})
