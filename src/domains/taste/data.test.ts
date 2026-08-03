import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

vi.mock('@/src/domains/taste/adapters/profilePrior', () => ({ profilePriorSource: { id: 'profile-prior', collect: vi.fn() } }))
vi.mock('@/src/domains/taste/adapters/attendance', () => ({ attendanceSource: { id: 'attendance', collect: vi.fn() } }))
vi.mock('@/src/domains/taste/adapters/wishlist', () => ({ wishlistSource: { id: 'wishlist', collect: vi.fn() } }))
vi.mock('@/src/domains/taste/adapters/lastfm', () => ({ lastfmSource: { id: 'lastfm', collect: vi.fn() } }))

import {
  listGenres,
  getTasteProfile,
  getArtistImportance,
  getArtistGenres,
  findRankingContext,
  getTasteProfileRow,
  writeTasteProfile,
  setLastfmUsername,
  removeLastfmConnection,
} from '@/src/domains/taste/data'
import { profilePriorSource } from '@/src/domains/taste/adapters/profilePrior'
import { attendanceSource } from '@/src/domains/taste/adapters/attendance'
import { wishlistSource } from '@/src/domains/taste/adapters/wishlist'
import { lastfmSource } from '@/src/domains/taste/adapters/lastfm'
import type { TasteSignal } from '@/src/domains/taste/types'

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.order = vi.fn(() => Promise.resolve(result))
  return builder
}

describe('listGenres', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps the canonical genre rows to key/label, sorted by the catalog order', async () => {
    const rows = [
      { key: 'rock-nacional', label_es: 'Rock Nacional', sort: 10 },
      { key: 'indie', label_es: 'Indie', sort: 20 },
    ]
    const fromMock = vi.fn(() => makeQueryBuilder({ data: rows, error: null }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await listGenres()

    expect(fromMock).toHaveBeenCalledWith('genres')
    expect(result).toEqual([
      { key: 'rock-nacional', label: 'Rock Nacional' },
      { key: 'indie', label: 'Indie' },
    ])
  })

  it('returns an empty list when the query errors out', async () => {
    const fromMock = vi.fn(() => makeQueryBuilder({ data: null, error: { message: 'boom' } }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await listGenres()

    expect(result).toEqual([])
  })
})

function makeArtistGenresSupabase(rows: Array<{ artist_id: string; genre_key: string }>) {
  const artistGenresBuilder: Record<string, unknown> = {}
  artistGenresBuilder.select = vi.fn(() => artistGenresBuilder)
  artistGenresBuilder.in = vi.fn(() => Promise.resolve({ data: rows, error: null }))

  return { from: vi.fn(() => artistGenresBuilder) }
}

function signal(overrides: Partial<TasteSignal>): TasteSignal {
  return {
    source: 'wishlist',
    kind: 'artist',
    ref: 'a1',
    weight: 1,
    observedAt: null,
    halfLifeDays: null,
    prior: false,
    ...overrides,
  }
}

describe('getTasteProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCreateClient.mockReturnValue(Promise.resolve(makeArtistGenresSupabase([])))
    vi.mocked(profilePriorSource.collect).mockResolvedValue([])
    vi.mocked(attendanceSource.collect).mockResolvedValue([])
    vi.mocked(wishlistSource.collect).mockResolvedValue([])
    vi.mocked(lastfmSource.collect).mockResolvedValue([])
  })

  it('blends every source\'s signals into one profile, marked as real behavior', async () => {
    vi.mocked(attendanceSource.collect).mockResolvedValue([
      signal({ source: 'attendance', ref: 'a1', weight: 5, halfLifeDays: null }),
    ])
    vi.mocked(wishlistSource.collect).mockResolvedValue([signal({ source: 'wishlist', ref: 'a2' })])

    const profile = await getTasteProfile('u1', new Date('2025-01-01'))

    expect(profile.hasAnySignal).toBe(true)
    expect(profile.basis).toBe('behavior')
    expect(profile.sources.sort()).toEqual(['attendance', 'wishlist'])
    expect(profile.artistAffinity.get('a1')).toBe(5)
  })

  it('splits an artist signal into its catalog genres', async () => {
    mockCreateClient.mockReturnValue(
      Promise.resolve(makeArtistGenresSupabase([{ artist_id: 'a1', genre_key: 'indie' }]))
    )
    vi.mocked(wishlistSource.collect).mockResolvedValue([signal({ source: 'wishlist', ref: 'a1', weight: 2 })])

    const profile = await getTasteProfile('u1')

    expect(profile.genreAffinity.get('indie')).toBe(2)
  })

  it('omits a source that rejects, never throwing, and keeps the rest of the profile intact', async () => {
    vi.mocked(wishlistSource.collect).mockRejectedValue(new Error('wishlist RLS boom'))
    vi.mocked(attendanceSource.collect).mockResolvedValue([signal({ source: 'attendance', ref: 'a1' })])

    const profile = await getTasteProfile('u1')

    expect(profile.sources).toEqual(['attendance'])
    expect(profile.hasAnySignal).toBe(true)
  })

  it('reports no signal and basis "none" when every source is empty', async () => {
    const profile = await getTasteProfile('u1')

    expect(profile).toMatchObject({ hasAnySignal: false, basis: 'none', realSignalCount: 0 })
  })
})

describe('getArtistImportance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns an importance map keyed by artist id, for the requested ids only', async () => {
    const importanceBuilder: Record<string, unknown> = {}
    importanceBuilder.select = vi.fn(() => importanceBuilder)
    importanceBuilder.in = vi.fn(() =>
      Promise.resolve({
        data: [{ artist_id: 'a1', peso: 0.8, geo_rank: 3, went_count: 5 }],
        error: null,
      })
    )
    const fromMock = vi.fn(() => importanceBuilder)
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await getArtistImportance(['a1', 'a2'])

    expect(fromMock).toHaveBeenCalledWith('artist_importance')
    expect(importanceBuilder.in).toHaveBeenCalledWith('artist_id', ['a1', 'a2'])
    expect(result.get('a1')).toEqual({ artistId: 'a1', peso: 0.8, geoRank: 3, wentCount: 5 })
    expect(result.has('a2')).toBe(false)
  })

  it('short-circuits without a query when no artist ids are requested', async () => {
    const result = await getArtistImportance([])

    expect(mockCreateClient).not.toHaveBeenCalled()
    expect(result.size).toBe(0)
  })
})

describe('getArtistGenres', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reuses the same query loadArtistGenres runs internally, keyed by artist id', async () => {
    mockCreateClient.mockReturnValue(
      Promise.resolve(makeArtistGenresSupabase([
        { artist_id: 'a1', genre_key: 'rock' },
        { artist_id: 'a1', genre_key: 'indie' },
        { artist_id: 'a2', genre_key: 'pop' },
      ]))
    )

    const result = await getArtistGenres(['a1', 'a2'])

    expect(result.get('a1')).toEqual(['rock', 'indie'])
    expect(result.get('a2')).toEqual(['pop'])
  })

  it('short-circuits without a query when no artist ids are requested', async () => {
    const result = await getArtistGenres([])

    expect(mockCreateClient).not.toHaveBeenCalled()
    expect(result.size).toBe(0)
  })
})

describe('findRankingContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads the owner-RLS declared genres and city coordinates for the given user', async () => {
    const builder: Record<string, unknown> = {}
    builder.select = vi.fn(() => builder)
    builder.eq = vi.fn(() => builder)
    builder.single = vi.fn(() =>
      Promise.resolve({
        data: { favorite_genre_keys: ['rock'], city_lat: '-34.6', city_lng: -58.4 },
        error: null,
      })
    )
    const fromMock = vi.fn(() => builder)
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await findRankingContext('u1')

    expect(fromMock).toHaveBeenCalledWith('taste_profiles')
    expect(builder.select).toHaveBeenCalledWith('favorite_genre_keys, city_lat, city_lng')
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(result).toEqual({ declaredGenreKeys: ['rock'], cityCoords: { lat: -34.6, lng: -58.4 } })
  })

  it('is null coordinates when the city has not been geocoded yet', async () => {
    const builder: Record<string, unknown> = {}
    builder.select = vi.fn(() => builder)
    builder.eq = vi.fn(() => builder)
    builder.single = vi.fn(() =>
      Promise.resolve({ data: { favorite_genre_keys: [], city_lat: null, city_lng: null }, error: null })
    )
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    const result = await findRankingContext('u1')

    expect(result).toEqual({ declaredGenreKeys: [], cityCoords: null })
  })

  it('returns null when the row does not exist yet', async () => {
    const builder: Record<string, unknown> = {}
    builder.select = vi.fn(() => builder)
    builder.eq = vi.fn(() => builder)
    builder.single = vi.fn(() => Promise.resolve({ data: null, error: { message: 'no rows' } }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    const result = await findRankingContext('u1')

    expect(result).toBeNull()
  })
})

describe('getTasteProfileRow', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('maps the editable taste_profiles columns for the given user', async () => {
    const builder: Record<string, unknown> = {}
    builder.select = vi.fn(() => builder)
    builder.eq = vi.fn(() => builder)
    builder.single = vi.fn(() =>
      Promise.resolve({
        data: { favorite_genre_keys: ['indie', 'pop'], birth_year: 1995, lastfm_username: 'rj' },
        error: null,
      })
    )
    const fromMock = vi.fn(() => builder)
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await getTasteProfileRow('u1')

    expect(fromMock).toHaveBeenCalledWith('taste_profiles')
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'u1')
    expect(result).toEqual({ genres: ['indie', 'pop'], birthYear: 1995, lastfmUsername: 'rj' })
  })

  it('returns null when the row does not exist yet', async () => {
    const builder: Record<string, unknown> = {}
    builder.select = vi.fn(() => builder)
    builder.eq = vi.fn(() => builder)
    builder.single = vi.fn(() => Promise.resolve({ data: null, error: { message: 'no rows' } }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    const result = await getTasteProfileRow('u1')

    expect(result).toBeNull()
  })
})

describe('writeTasteProfile', () => {
  it('upserts the full replace of genres and birth year for the given user', async () => {
    const upsertMock = vi.fn(() => Promise.resolve({ error: null }))
    const supabase = { from: vi.fn(() => ({ upsert: upsertMock })) }

    const result = await writeTasteProfile(supabase as never, 'u1', { genres: ['indie'], birthYear: 1995 })

    expect(supabase.from).toHaveBeenCalledWith('taste_profiles')
    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ user_id: 'u1', favorite_genre_keys: ['indie'], birth_year: 1995 })
    )
    expect(result).toEqual({})
  })

  it('returns a friendly error when the write fails', async () => {
    const supabase = { from: vi.fn(() => ({ upsert: vi.fn(() => Promise.resolve({ error: { message: 'boom' } })) })) }

    const result = await writeTasteProfile(supabase as never, 'u1', { genres: [], birthYear: null })

    expect(result).toEqual({ error: 'No pudimos guardar tus preferencias.' })
  })
})

describe('setLastfmUsername', () => {
  it('updates the username and the sync timestamp for the given user', async () => {
    const eqMock = vi.fn(() => Promise.resolve({ error: null }))
    const updateMock = vi.fn(() => ({ eq: eqMock }))
    const supabase = { from: vi.fn(() => ({ update: updateMock })) }

    const result = await setLastfmUsername(supabase as never, 'u1', 'realuser', '2026-01-01T00:00:00.000Z')

    expect(supabase.from).toHaveBeenCalledWith('taste_profiles')
    expect(updateMock).toHaveBeenCalledWith({ lastfm_username: 'realuser', lastfm_synced_at: '2026-01-01T00:00:00.000Z' })
    expect(eqMock).toHaveBeenCalledWith('user_id', 'u1')
    expect(result).toEqual({})
  })

  it('returns a friendly error when the update fails', async () => {
    const supabase = {
      from: vi.fn(() => ({ update: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: { message: 'boom' } })) })) })),
    }

    const result = await setLastfmUsername(supabase as never, 'u1', 'realuser', '2026-01-01T00:00:00.000Z')

    expect(result.error).toBeTruthy()
  })
})

describe('removeLastfmConnection', () => {
  it('deletes lastfm_imports before nulling the username, never the reverse', async () => {
    const order: string[] = []
    const deleteEq = vi.fn(() => {
      order.push('delete-imports')
      return Promise.resolve({ error: null })
    })
    const updateEq = vi.fn(() => {
      order.push('null-username')
      return Promise.resolve({ error: null })
    })
    const supabase = {
      from: vi.fn((table: string) =>
        table === 'lastfm_imports'
          ? { delete: vi.fn(() => ({ eq: deleteEq })) }
          : { update: vi.fn(() => ({ eq: updateEq })) }
      ),
    }

    const result = await removeLastfmConnection(supabase as never, 'u1')

    expect(supabase.from).toHaveBeenCalledWith('lastfm_imports')
    expect(supabase.from).toHaveBeenCalledWith('taste_profiles')
    expect(order).toEqual(['delete-imports', 'null-username'])
    expect(result).toEqual({})
  })

  it('stops before touching the username if deleting the imports fails', async () => {
    const supabase = {
      from: vi.fn(() => ({ delete: vi.fn(() => ({ eq: vi.fn(() => Promise.resolve({ error: { message: 'boom' } })) })) })),
    }

    const result = await removeLastfmConnection(supabase as never, 'u1')

    expect(result.error).toBeTruthy()
    expect(supabase.from).toHaveBeenCalledTimes(1)
  })
})
