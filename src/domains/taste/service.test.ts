import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

vi.mock('@/src/domains/taste/data', () => ({
  listGenres: vi.fn(),
  getTasteProfileRow: vi.fn(),
  writeTasteProfile: vi.fn(),
  setLastfmUsername: vi.fn(),
  removeLastfmConnection: vi.fn(),
  getTasteProfile: vi.fn(),
  getArtistImportance: vi.fn(),
  getArtistGenres: vi.fn(),
  findRankingContext: vi.fn(),
  findArtistsByGenres: vi.fn(),
  findTopImportanceArtists: vi.fn(),
}))

vi.mock('@/src/domains/taste/importLastfmForUser', () => ({
  importLastfmForUser: vi.fn(),
}))

vi.mock('@/src/domains/taste/syncCityCoordinates', () => ({
  syncCityCoordinates: vi.fn(),
}))

import {
  updateTasteProfile,
  connectLastfm,
  disconnectLastfm,
  findTasteProfile,
  getTasteProfile,
  getArtistImportance,
  getArtistGenres,
  findRankingContext,
  findArtistsByGenres,
  findTopImportanceArtists,
  syncCityCoordinates,
} from '@/src/domains/taste/service'
import {
  listGenres,
  getTasteProfileRow,
  writeTasteProfile,
  setLastfmUsername,
  removeLastfmConnection,
  getTasteProfile as getTasteProfileData,
  getArtistImportance as getArtistImportanceData,
  getArtistGenres as getArtistGenresData,
  findRankingContext as findRankingContextData,
  findArtistsByGenres as findArtistsByGenresData,
  findTopImportanceArtists as findTopImportanceArtistsData,
} from '@/src/domains/taste/data'
import { importLastfmForUser } from '@/src/domains/taste/importLastfmForUser'
import { syncCityCoordinates as syncCityCoordinatesData } from '@/src/domains/taste/syncCityCoordinates'

function makeSupabase(user: { id: string } | null) {
  return { auth: { getUser: vi.fn(() => Promise.resolve({ data: { user } })) } }
}

describe('findTasteProfile', () => {
  beforeEach(() => vi.clearAllMocks())

  it('delegates to the data layer for the given user id', async () => {
    vi.mocked(getTasteProfileRow).mockResolvedValue({ genres: ['indie'], birthYear: 1995, lastfmUsername: null })

    const result = await findTasteProfile('u1')

    expect(getTasteProfileRow).toHaveBeenCalledWith('u1')
    expect(result).toEqual({ genres: ['indie'], birthYear: 1995, lastfmUsername: null })
  })
})

describe('updateTasteProfile', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(listGenres).mockResolvedValue([
      { key: 'indie', label: 'Indie' },
      { key: 'pop', label: 'Pop' },
    ])
  })

  it('requires a logged-in user', async () => {
    mockCreateClient.mockReturnValue(Promise.resolve(makeSupabase(null)))

    const result = await updateTasteProfile({ genres: [], birthYear: null })

    expect(result).toEqual({ error: 'No estás autenticado.' })
    expect(writeTasteProfile).not.toHaveBeenCalled()
  })

  it('rejects more than 5 genres before touching the catalog or the DB', async () => {
    mockCreateClient.mockReturnValue(Promise.resolve(makeSupabase({ id: 'u1' })))

    const result = await updateTasteProfile({ genres: ['a', 'b', 'c', 'd', 'e', 'f'], birthYear: null })

    expect(result).toEqual({ error: 'Elegí como máximo 5 géneros.' })
    expect(writeTasteProfile).not.toHaveBeenCalled()
  })

  it('rejects an implausible birth year', async () => {
    mockCreateClient.mockReturnValue(Promise.resolve(makeSupabase({ id: 'u1' })))

    const result = await updateTasteProfile({ genres: [], birthYear: 1800 })

    expect(result).toEqual({ error: 'Revisá el año de nacimiento.' })
    expect(writeTasteProfile).not.toHaveBeenCalled()
  })

  it('drops unknown genre keys and persists the valid ones with the birth year', async () => {
    mockCreateClient.mockReturnValue(Promise.resolve(makeSupabase({ id: 'u1' })))
    vi.mocked(writeTasteProfile).mockResolvedValue({})

    const result = await updateTasteProfile({ genres: ['indie', 'unknown-genre'], birthYear: 1995 })

    expect(writeTasteProfile).toHaveBeenCalledWith(expect.anything(), 'u1', { genres: ['indie'], birthYear: 1995 })
    expect(result).toEqual({})
  })

  it('allows clearing every genre and leaving the birth year blank', async () => {
    mockCreateClient.mockReturnValue(Promise.resolve(makeSupabase({ id: 'u1' })))
    vi.mocked(writeTasteProfile).mockResolvedValue({})

    const result = await updateTasteProfile({ genres: [], birthYear: null })

    expect(writeTasteProfile).toHaveBeenCalledWith(expect.anything(), 'u1', { genres: [], birthYear: null })
    expect(result).toEqual({})
  })
})

describe('connectLastfm', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requires a logged-in user', async () => {
    mockCreateClient.mockReturnValue(Promise.resolve(makeSupabase(null)))

    const result = await connectLastfm('validname')

    expect(result).toEqual({ error: 'No estás autenticado.' })
    expect(importLastfmForUser).not.toHaveBeenCalled()
  })

  it('rejects a malformed username without calling Last.fm', async () => {
    mockCreateClient.mockReturnValue(Promise.resolve(makeSupabase({ id: 'u1' })))

    const result = await connectLastfm('1bad')

    expect(result.error).toBeTruthy()
    expect(importLastfmForUser).not.toHaveBeenCalled()
  })

  it('calls the shared importLastfmForUser before saving the username', async () => {
    mockCreateClient.mockReturnValue(Promise.resolve(makeSupabase({ id: 'u1' })))
    vi.mocked(importLastfmForUser).mockResolvedValue({ imported: 10, unmatched: 2 })
    vi.mocked(setLastfmUsername).mockResolvedValue({})

    const result = await connectLastfm('realuser')

    expect(importLastfmForUser).toHaveBeenCalledWith(expect.anything(), 'u1', 'realuser')
    expect(setLastfmUsername).toHaveBeenCalledWith(expect.anything(), 'u1', 'realuser', expect.any(String))
    expect(result).toEqual({})
  })

  it('does not save an unknown Last.fm username', async () => {
    mockCreateClient.mockReturnValue(Promise.resolve(makeSupabase({ id: 'u1' })))
    vi.mocked(importLastfmForUser).mockResolvedValue({ imported: 0, unmatched: 0, notFound: true })

    const result = await connectLastfm('ghostuser')

    expect(result.error).toBeTruthy()
    expect(setLastfmUsername).not.toHaveBeenCalled()
  })

  it('saves the username even when the import no-ops without an API key', async () => {
    mockCreateClient.mockReturnValue(Promise.resolve(makeSupabase({ id: 'u1' })))
    vi.mocked(importLastfmForUser).mockResolvedValue({ imported: 0, unmatched: 0 })
    vi.mocked(setLastfmUsername).mockResolvedValue({})

    const result = await connectLastfm('realuser')

    expect(setLastfmUsername).toHaveBeenCalledWith(expect.anything(), 'u1', 'realuser', expect.any(String))
    expect(result).toEqual({})
  })
})

describe('disconnectLastfm', () => {
  beforeEach(() => vi.clearAllMocks())

  it('requires a logged-in user', async () => {
    mockCreateClient.mockReturnValue(Promise.resolve(makeSupabase(null)))

    const result = await disconnectLastfm()

    expect(result).toEqual({ error: 'No estás autenticado.' })
    expect(removeLastfmConnection).not.toHaveBeenCalled()
  })

  it('delegates to the data layer, which deletes imports then nulls the username', async () => {
    mockCreateClient.mockReturnValue(Promise.resolve(makeSupabase({ id: 'u1' })))
    vi.mocked(removeLastfmConnection).mockResolvedValue({})

    const result = await disconnectLastfm()

    expect(removeLastfmConnection).toHaveBeenCalledWith(expect.anything(), 'u1')
    expect(result).toEqual({})
  })
})

/**
 * The recommendations domain must reach every taste read (and the
 * profile-save geocoding hook) through this seam, never `./data` directly
 * (ADR 0001) — these re-exports are what makes that possible.
 */
describe('taste/service re-exports for the recommendations domain (issue #81)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('re-exports getTasteProfile', async () => {
    const profile = { artistAffinity: new Map(), genreAffinity: new Map(), realSignalCount: 0, hasAnySignal: false, basis: 'none' as const, sources: [] }
    vi.mocked(getTasteProfileData).mockResolvedValue(profile)

    const result = await getTasteProfile('u1')

    expect(getTasteProfileData).toHaveBeenCalledWith('u1', undefined)
    expect(result).toBe(profile)
  })

  it('re-exports getArtistImportance', async () => {
    const map = new Map()
    vi.mocked(getArtistImportanceData).mockResolvedValue(map)

    const result = await getArtistImportance(['a1'])

    expect(getArtistImportanceData).toHaveBeenCalledWith(['a1'])
    expect(result).toBe(map)
  })

  it('re-exports getArtistGenres', async () => {
    const map = new Map()
    vi.mocked(getArtistGenresData).mockResolvedValue(map)

    const result = await getArtistGenres(['a1'])

    expect(getArtistGenresData).toHaveBeenCalledWith(['a1'])
    expect(result).toBe(map)
  })

  it('re-exports findRankingContext', async () => {
    const ctx = { declaredGenreKeys: ['rock'], cityCoords: null }
    vi.mocked(findRankingContextData).mockResolvedValue(ctx)

    const result = await findRankingContext('u1')

    expect(findRankingContextData).toHaveBeenCalledWith('u1')
    expect(result).toBe(ctx)
  })

  it('re-exports findArtistsByGenres — first-time seed ladder tier 1 (issue #81)', async () => {
    const candidates = [{ artistId: 'a1', name: 'Bandalos Chinos', peso: 0.6 }]
    vi.mocked(findArtistsByGenresData).mockResolvedValue(candidates)

    const result = await findArtistsByGenres(['indie'])

    expect(findArtistsByGenresData).toHaveBeenCalledWith(['indie'])
    expect(result).toBe(candidates)
  })

  it('re-exports findTopImportanceArtists — first-time seed ladder tier 2 (issue #81)', async () => {
    const candidates = [{ artistId: 'a1', name: 'Divididos', peso: 0.9 }]
    vi.mocked(findTopImportanceArtistsData).mockResolvedValue(candidates)

    const result = await findTopImportanceArtists(10)

    expect(findTopImportanceArtistsData).toHaveBeenCalledWith(10)
    expect(result).toBe(candidates)
  })

  it('re-exports syncCityCoordinates — the seam auth/service.ts now imports through', async () => {
    vi.mocked(syncCityCoordinatesData).mockResolvedValue(undefined)
    const supabase = {} as never

    await syncCityCoordinates(supabase, 'u1', 'La Plata')

    expect(syncCityCoordinatesData).toHaveBeenCalledWith(supabase, 'u1', 'La Plata')
  })
})
