import { describe, it, expect } from 'vitest'
import { toCandidates } from '@/src/domains/recommendations/candidates'
import type { SuggestionCandidateRow } from '@/src/domains/events/service'
import type { FutureEvent } from '@/src/core/types'
import type { TicketmasterMatch, WishlistArtist } from '@/src/domains/recommendations/types'

function catalogRow(overrides: Partial<SuggestionCandidateRow> & Pick<SuggestionCandidateRow, 'id'>): SuggestionCandidateRow {
  return {
    name: 'Show',
    date: '2026-09-20T21:00:00-03:00',
    venues: { name: 'Niceto', city: 'CABA', lat: -34.6, lng: -58.45 },
    lineups: [{ artists: { id: 'divididos', name: 'Divididos' } }],
    ...overrides,
  }
}

function wishlistArtist(overrides: Partial<WishlistArtist> = {}): WishlistArtist {
  return { id: 'divididos', name: 'Divididos', ...overrides }
}

function futureEvent(overrides: Partial<FutureEvent> = {}): FutureEvent {
  return {
    id: 'tm-1',
    title: 'Divididos en vivo',
    datetime: '2026-09-25T21:00:00-03:00',
    venue: { name: 'Groove', city: 'CABA', country: 'AR', lat: -34.58, lng: -58.43 },
    lineup: ['Divididos'],
    ...overrides,
  }
}

function tmMatch(overrides: Partial<TicketmasterMatch> = {}): TicketmasterMatch {
  return { artist: wishlistArtist(), event: futureEvent(), ...overrides }
}

describe('toCandidates — Ticketmaster lineup matching', () => {
  it('keeps a Ticketmaster result whose lineup names the wishlist artist', () => {
    const result = toCandidates([], [tmMatch()], new Set())

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ source: 'ticketmaster', artistIds: ['divididos'] })
  })

  it('matches the lineup name ignoring case, accents and surrounding whitespace', () => {
    const result = toCandidates(
      [],
      [tmMatch({ artist: wishlistArtist({ id: 'el-mato', name: 'El Mató a un Policía Motorizado' }), event: futureEvent({ lineup: ['  EL MATÓ A UN POLICÍA MOTORIZADO  '] }) })],
      new Set()
    )

    expect(result).toHaveLength(1)
    expect(result[0].artistIds).toEqual(['el-mato'])
  })

  it('drops a Ticketmaster result whose lineup does not name the wishlist artist', () => {
    const result = toCandidates([], [tmMatch({ event: futureEvent({ lineup: ['Otra Banda'] }) })], new Set())

    expect(result).toEqual([])
  })

  it('drops a Ticketmaster result with an empty lineup', () => {
    const result = toCandidates([], [tmMatch({ event: futureEvent({ lineup: [] }) })], new Set())

    expect(result).toEqual([])
  })
})

describe('toCandidates — catalog wins over a Ticketmaster duplicate', () => {
  it('drops the Ticketmaster result when a catalog event shares the artist and Argentina calendar day', () => {
    const result = toCandidates(
      [catalogRow({ id: 'cat-1', date: '2026-09-25T20:00:00-03:00' })],
      [tmMatch({ event: futureEvent({ datetime: '2026-09-25T23:30:00-03:00' }) })],
      new Set()
    )

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({ source: 'catalog', key: 'catalog:cat-1' })
  })

  it('keeps the Ticketmaster result when the shared artist plays on a different day', () => {
    const result = toCandidates(
      [catalogRow({ id: 'cat-1', date: '2026-09-20T20:00:00-03:00' })],
      [tmMatch({ event: futureEvent({ datetime: '2026-09-25T23:30:00-03:00' }) })],
      new Set()
    )

    expect(result.map((c) => c.source).sort()).toEqual(['catalog', 'ticketmaster'])
  })
})

describe('toCandidates — own attendance exclusion', () => {
  it('excludes a catalog event the user already has attendance on', () => {
    const result = toCandidates([catalogRow({ id: 'cat-1' })], [], new Set(['cat-1']))

    expect(result).toEqual([])
  })

  it('keeps a catalog event with no attendance', () => {
    const result = toCandidates([catalogRow({ id: 'cat-1' })], [], new Set(['some-other-event']))

    expect(result).toHaveLength(1)
  })
})

describe('toCandidates — candidate shape', () => {
  it('parses catalog venue coordinates and builds a detail href', () => {
    const result = toCandidates([catalogRow({ id: 'cat-1' })], [], new Set())

    expect(result[0]).toMatchObject({
      href: '/events/cat-1',
      venueName: 'Niceto',
      venueCoords: { lat: -34.6, lng: -58.45 },
    })
  })

  it('treats an unparsable catalog venue coordinate as missing', () => {
    const result = toCandidates(
      [catalogRow({ id: 'cat-1', venues: { name: 'Niceto', city: 'CABA', lat: 'no-number', lng: -58.45 } })],
      [],
      new Set()
    )

    expect(result[0].venueCoords).toBeNull()
  })

  it('falls back to the event name when the catalog lineup is empty', () => {
    const result = toCandidates([catalogRow({ id: 'cat-1', name: 'Noche sin lineup cargado', lineups: [] })], [], new Set())

    expect(result[0]).toMatchObject({ headliner: 'Noche sin lineup cargado', artistIds: [] })
  })

  it('links a Ticketmaster candidate to the "cargar show" flow, not the artist name', () => {
    const result = toCandidates([], [tmMatch()], new Set())

    expect(result[0].href).toBe('/events/nuevo')
  })
})
