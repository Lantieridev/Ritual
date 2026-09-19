import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()
const mockFindRankingContext = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

vi.mock('@/src/domains/taste/service', () => ({
  findRankingContext: (userId: string) => mockFindRankingContext(userId),
}))

import { searchCatalog, searchNearby } from '@/src/domains/search/service'
import { haversineKm } from '@/src/core/lib/geo'

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.ilike = vi.fn(chain)
  builder.order = vi.fn(chain)
  builder.limit = vi.fn(() => Promise.resolve(result))
  return builder
}

function makeSupabase(overrides: Partial<Record<'events' | 'artists' | 'venues' | 'festivals', { data: unknown; error: unknown }>> = {}) {
  const defaults = { data: [], error: null }
  const byTable: Record<string, { data: unknown; error: unknown }> = {
    events: overrides.events ?? defaults,
    artists: overrides.artists ?? defaults,
    venues: overrides.venues ?? defaults,
    festivals: overrides.festivals ?? defaults,
  }
  const fromMock = vi.fn((table: string) => makeQueryBuilder(byTable[table]))
  return { from: fromMock }
}

describe('searchCatalog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('queries all tables (events, artists, venues, festivals) by name in parallel', async () => {
    const festivalRows = [{ id: 'f1', name: 'Cosquín Rock', edition: '2026', city: 'Córdoba', start_date: '2026-02-14' }]
    const eventRows = [{ id: 'e1', name: 'Rock Show', date: '2026-01-01' }]
    const artistRows = [{ id: 'a1', name: 'Band', genre: 'Rock' }]
    const venueRows = [{ id: 'v1', name: 'Stadium', city: 'City', country: 'AR' }]

    const supabase = makeSupabase({ 
      festivals: { data: festivalRows, error: null },
      events: { data: eventRows, error: null },
      artists: { data: artistRows, error: null },
      venues: { data: venueRows, error: null }
    })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await searchCatalog('rock')

    expect(supabase.from).toHaveBeenCalledWith('festivals')
    expect(supabase.from).toHaveBeenCalledWith('events')
    expect(supabase.from).toHaveBeenCalledWith('artists')
    expect(supabase.from).toHaveBeenCalledWith('venues')

    expect(result.festivals).toEqual(festivalRows)
    expect(result.events).toEqual(eventRows)
    expect(result.artists).toEqual(artistRows)
    expect(result.venues).toEqual(venueRows)
  })

  it('caps all queries at MAX_RESULTS_PER_TYPE (8)', async () => {
    const supabase = makeSupabase()
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))
    const builders: Record<string, ReturnType<typeof makeQueryBuilder>> = {}
    supabase.from = vi.fn((table: string) => {
      const builder = makeQueryBuilder({ data: [], error: null })
      builders[table] = builder
      return builder
    })

    await searchCatalog('rock')

    expect(builders.festivals.limit).toHaveBeenCalledWith(8)
    expect(builders.events.limit).toHaveBeenCalledWith(8)
    expect(builders.artists.limit).toHaveBeenCalledWith(8)
    expect(builders.venues.limit).toHaveBeenCalledWith(8)
  })

  it('escapes % and _ wildcards before querying all tables', async () => {
    const supabase = makeSupabase()
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))
    const patterns: Record<string, string> = {}
    supabase.from = vi.fn((table: string) => {
      const builder = makeQueryBuilder({ data: [], error: null })
      builder.ilike = vi.fn((_col: string, pattern: string) => {
        patterns[table] = pattern
        return builder
      })
      return builder
    })

    await searchCatalog('100% rock_show')

    const expectedPattern = '%100\\% rock\\_show%'
    expect(patterns.festivals).toBe(expectedPattern)
    expect(patterns.events).toBe(expectedPattern)
    expect(patterns.artists).toBe(expectedPattern)
    expect(patterns.venues).toBe(expectedPattern)
  })

  it('returns empty arrays when queries error, logging them without throwing', async () => {
    const supabase = makeSupabase({ 
      festivals: { data: null, error: { message: 'boom festivals' } },
      events: { data: null, error: { message: 'boom events' } },
      artists: { data: null, error: { message: 'boom artists' } },
      venues: { data: null, error: { message: 'boom venues' } }
    })
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await searchCatalog('rock')

    expect(console.error).toHaveBeenCalledTimes(4)
    expect(result).toEqual({ events: [], artists: [], venues: [], festivals: [] })
  })

  it('returns EMPTY for a blank query, without hitting the database', async () => {
    const supabase = makeSupabase()
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await searchCatalog('   ')

    expect(result).toEqual({ events: [], artists: [], venues: [], festivals: [] })
    expect(supabase.from).not.toHaveBeenCalled()
  })
})

function makeVenuesQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.not = vi.fn(chain)
  builder.gte = vi.fn(chain)
  builder.lte = vi.fn(chain)
  builder.ilike = vi.fn(chain)
  builder.limit = vi.fn(() => Promise.resolve(result))
  return builder
}

const CORDOBA = { lat: -31.4, lng: -64.2 }

describe('searchNearby', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns {status: "no-session"} when there is no active session, without reading taste data', async () => {
    const supabase = { auth: { getUser: vi.fn(async () => ({ data: { user: null } })) }, from: vi.fn() }
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))

    const result = await searchNearby('obras')

    expect(result).toEqual({ status: 'no-session' })
    expect(mockFindRankingContext).not.toHaveBeenCalled()
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('returns {status: "no-city"} when the signed-in user has no city coordinates', async () => {
    const supabase = { auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } } })) }, from: vi.fn() }
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))
    mockFindRankingContext.mockResolvedValue({ declaredGenreKeys: [], cityCoords: null })

    const result = await searchNearby()

    expect(result).toEqual({ status: 'no-city' })
    expect(supabase.from).not.toHaveBeenCalled()
  })

  it('orders venues by ascending real distance and never queries artists or festivals', async () => {
    const near = { id: 'v-near', name: 'Club Cercano', city: 'Córdoba', lat: -31.41, lng: -64.21 }
    const far = { id: 'v-far', name: 'Club Lejano', city: 'Córdoba', lat: -31.9, lng: -64.9 }
    const venuesBuilder = makeVenuesQueryBuilder({ data: [far, near], error: null })
    const supabase = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } } })) },
      from: vi.fn((table: string) => {
        if (table === 'venues') return venuesBuilder
        throw new Error(`unexpected table: ${table}`)
      }),
    }
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))
    mockFindRankingContext.mockResolvedValue({ declaredGenreKeys: [], cityCoords: CORDOBA })

    const result = await searchNearby()

    expect(supabase.from).toHaveBeenCalledWith('venues')
    expect(supabase.from).not.toHaveBeenCalledWith('artists')
    expect(supabase.from).not.toHaveBeenCalledWith('festivals')
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error('expected ok')
    expect(result.venues.map((v) => v.id)).toEqual(['v-near', 'v-far'])
    expect(result.venues[0].distanceKm).toBeCloseTo(haversineKm(CORDOBA, { lat: near.lat, lng: near.lng }), 5)
    expect(venuesBuilder.ilike).not.toHaveBeenCalled()
  })

  it('applies an ilike filter and the ±1.5° bbox when a query is present, capped at 8', async () => {
    const rows = Array.from({ length: 10 }, (_, i) => ({
      id: `v${i}`,
      name: `Venue ${i}`,
      city: 'Córdoba',
      lat: CORDOBA.lat + i * 0.01,
      lng: CORDOBA.lng,
    }))
    const venuesBuilder = makeVenuesQueryBuilder({ data: rows, error: null })
    const supabase = {
      auth: { getUser: vi.fn(async () => ({ data: { user: { id: 'u1' } } })) },
      from: vi.fn(() => venuesBuilder),
    }
    mockCreateClient.mockReturnValue(Promise.resolve(supabase))
    mockFindRankingContext.mockResolvedValue({ declaredGenreKeys: [], cityCoords: CORDOBA })

    const result = await searchNearby('club')

    expect(venuesBuilder.ilike).toHaveBeenCalledWith('name', '%club%')
    expect(venuesBuilder.gte).toHaveBeenCalledWith('lat', CORDOBA.lat - 1.5)
    expect(venuesBuilder.lte).toHaveBeenCalledWith('lat', CORDOBA.lat + 1.5)
    expect(venuesBuilder.gte).toHaveBeenCalledWith('lng', CORDOBA.lng - 1.5)
    expect(venuesBuilder.lte).toHaveBeenCalledWith('lng', CORDOBA.lng + 1.5)
    expect(result.status).toBe('ok')
    if (result.status !== 'ok') throw new Error('expected ok')
    expect(result.venues).toHaveLength(8)
  })
})
