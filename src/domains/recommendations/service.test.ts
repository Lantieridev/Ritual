import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/domains/events/service', () => ({
  listSuggestionCandidates: vi.fn(),
}))

vi.mock('@/src/domains/taste/service', () => ({
  getTasteProfile: vi.fn(),
  findRankingContext: vi.fn(),
  listGenres: vi.fn(),
  getArtistImportance: vi.fn(),
  getArtistGenres: vi.fn(),
}))

vi.mock('@/src/core/lib/ticketmaster', () => ({
  searchTicketmasterEvents: vi.fn(),
}))

vi.mock('@/src/core/lib/artist-image', () => ({
  getArtistImage: vi.fn(),
}))

import { getHomeSuggestions } from '@/src/domains/recommendations/service'
import { listSuggestionCandidates } from '@/src/domains/events/service'
import { getTasteProfile, findRankingContext, listGenres, getArtistImportance, getArtistGenres } from '@/src/domains/taste/service'
import { searchTicketmasterEvents } from '@/src/core/lib/ticketmaster'
import { getArtistImage } from '@/src/core/lib/artist-image'
import type { SuggestionCandidateRow, EventWithAttendance } from '@/src/domains/events/service'
import type { FutureEvent } from '@/src/core/types'
import type { WishlistArtist } from '@/src/domains/recommendations/types'

const NOW = new Date('2026-09-14T12:00:00-03:00')

function catalogRow(overrides: Partial<SuggestionCandidateRow> & Pick<SuggestionCandidateRow, 'id'>): SuggestionCandidateRow {
  return {
    name: 'Show',
    date: '2026-09-20T21:00:00-03:00',
    venues: { name: 'Niceto', city: 'CABA', lat: -34.6, lng: -58.45 },
    lineups: [{ artists: { id: 'divididos', name: 'Divididos' } }],
    ...overrides,
  }
}

function tmEvent(overrides: Partial<FutureEvent> = {}): FutureEvent {
  return {
    id: 'tm-1',
    title: 'Show TM',
    datetime: '2026-09-22T21:00:00-03:00',
    venue: { name: 'Groove', city: 'CABA', country: 'AR', lat: null, lng: null },
    lineup: [],
    ...overrides,
  }
}

const EMPTY_TASTE_PROFILE = {
  artistAffinity: new Map(),
  genreAffinity: new Map(),
  realSignalCount: 0,
  hasAnySignal: true,
  basis: 'behavior' as const,
  sources: ['attendance' as const],
}

function setupDefaults() {
  vi.mocked(listSuggestionCandidates).mockResolvedValue([])
  vi.mocked(getTasteProfile).mockResolvedValue(EMPTY_TASTE_PROFILE)
  vi.mocked(findRankingContext).mockResolvedValue({ declaredGenreKeys: [], cityCoords: null })
  vi.mocked(listGenres).mockResolvedValue([])
  vi.mocked(getArtistImportance).mockResolvedValue(new Map())
  vi.mocked(getArtistGenres).mockResolvedValue(new Map())
  vi.mocked(searchTicketmasterEvents).mockResolvedValue({ events: [], total: 0 })
  vi.mocked(getArtistImage).mockResolvedValue({ image: null, source: null })
}

describe('getHomeSuggestions — never throws on source rejection', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaults()
  })

  it('degrades to an empty candidate list when listSuggestionCandidates rejects', async () => {
    vi.mocked(listSuggestionCandidates).mockRejectedValue(new Error('db down'))

    const result = await getHomeSuggestions('u1', [], [], NOW)

    expect(result.candidates).toEqual([])
  })

  it('degrades to basis none / general mode when getTasteProfile rejects', async () => {
    vi.mocked(listSuggestionCandidates).mockResolvedValue([catalogRow({ id: 'cat-1' })])
    vi.mocked(getTasteProfile).mockRejectedValue(new Error('rls denied'))

    const result = await getHomeSuggestions('u1', [], [], NOW)

    expect(result.heading.basis).toBe('none')
    expect(result.heading.sources).toEqual([])
  })

  it('degrades to null coordinates and no declared genres when findRankingContext rejects', async () => {
    vi.mocked(findRankingContext).mockRejectedValue(new Error('rls denied'))

    const result = await getHomeSuggestions('u1', [], [], NOW)

    expect(result.heading.hasCoords).toBe(false)
  })

  it('degrades to no declared-genre labels when listGenres rejects', async () => {
    vi.mocked(findRankingContext).mockResolvedValue({ declaredGenreKeys: ['rock'], cityCoords: null })
    vi.mocked(listGenres).mockRejectedValue(new Error('boom'))

    const result = await getHomeSuggestions('u1', [], [], NOW)

    expect(result.heading.declaredGenreLabels).toEqual([])
  })

  it('drops only the rejecting artist’s Ticketmaster search, keeping the others', async () => {
    vi.mocked(searchTicketmasterEvents)
      .mockRejectedValueOnce(new Error('timeout'))
      .mockResolvedValueOnce({ events: [tmEvent({ id: 'tm-b', lineup: ['Bandb'] })], total: 1 })
    const artists: WishlistArtist[] = [
      { id: 'banda-a', name: 'BandA' },
      { id: 'banda-b', name: 'BandB' },
    ]

    const result = await getHomeSuggestions('u1', artists, [], NOW)

    expect(result.candidates.map((c) => c.key)).toEqual(['ticketmaster:tm-b'])
  })

  it('never rejects even when every source rejects at once', async () => {
    vi.mocked(listSuggestionCandidates).mockRejectedValue(new Error('a'))
    vi.mocked(getTasteProfile).mockRejectedValue(new Error('b'))
    vi.mocked(findRankingContext).mockRejectedValue(new Error('c'))
    vi.mocked(listGenres).mockRejectedValue(new Error('d'))
    vi.mocked(searchTicketmasterEvents).mockRejectedValue(new Error('e'))

    await expect(getHomeSuggestions('u1', [{ id: 'a1', name: 'A' }], [], NOW)).resolves.toMatchObject({ candidates: [] })
  })
})

describe('getHomeSuggestions — Ticketmaster search bounds', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaults()
  })

  it('only searches Ticketmaster for the first 6 wishlist artists', async () => {
    const artists: WishlistArtist[] = Array.from({ length: 8 }, (_, i) => ({ id: `a${i}`, name: `Artist${i}` }))

    await getHomeSuggestions('u1', artists, [], NOW)

    expect(searchTicketmasterEvents).toHaveBeenCalledTimes(6)
  })
})

describe('getHomeSuggestions — image fetch bound to the top 6', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaults()
  })

  it('fetches an image only for each of the top 6 ranked candidates, not the rest', async () => {
    const rows = Array.from({ length: 9 }, (_, i) =>
      catalogRow({ id: `cat-${i}`, date: '2026-09-20T21:00:00-03:00', lineups: [{ artists: { id: `artist-${i}`, name: `Artist ${i}` } }] })
    )
    vi.mocked(listSuggestionCandidates).mockResolvedValue(rows)

    const result = await getHomeSuggestions('u1', [], [], NOW)

    expect(result.candidates).toHaveLength(6)
    expect(getArtistImage).toHaveBeenCalledTimes(6)
    expect(result.candidates.every((c) => 'image' in c)).toBe(true)
  })
})

describe('getHomeSuggestions — guest (no userId)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaults()
  })

  it('never calls the user-scoped taste reads and produces the general/none heading', async () => {
    const result = await getHomeSuggestions(null, [], [], NOW)

    expect(getTasteProfile).not.toHaveBeenCalled()
    expect(findRankingContext).not.toHaveBeenCalled()
    expect(result.heading.basis).toBe('none')
  })
})

describe('getHomeSuggestions — attendance wiring (own-event exclusion + seen reason)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupDefaults()
  })

  it('excludes a catalog event the user already has attendance on', async () => {
    vi.mocked(listSuggestionCandidates).mockResolvedValue([catalogRow({ id: 'cat-1' })])
    const allEvents: EventWithAttendance[] = [
      {
        id: 'cat-1',
        name: 'Show',
        date: '2026-09-20T21:00:00-03:00',
        venue_id: 'v1',
        venues: { name: 'Niceto', city: 'CABA', country: 'AR', lat: null, lng: null },
        lineups: [],
        attendance: [{ id: 'att-1', status: 'going', user_id: 'u1', rating: null, review: null }],
      },
    ]

    const result = await getHomeSuggestions('u1', [], allEvents, NOW)

    expect(result.candidates).toEqual([])
  })

  it('derives a "seen" reason from the user’s own \'went\' attendance history', async () => {
    vi.mocked(listSuggestionCandidates).mockResolvedValue([
      catalogRow({ id: 'cat-1', lineups: [{ artists: { id: 'divididos', name: 'Divididos' } }] }),
    ])
    vi.mocked(getTasteProfile).mockResolvedValue({ ...EMPTY_TASTE_PROFILE, basis: 'declared-genres' })
    const allEvents: EventWithAttendance[] = [
      {
        id: 'past-1',
        name: 'Show pasado',
        date: '2026-01-10T21:00:00-03:00',
        venue_id: 'v2',
        venues: { name: 'Groove', city: 'CABA', country: 'AR', lat: null, lng: null },
        lineups: [{ artists: { id: 'divididos', name: 'Divididos', genre: null } }],
        attendance: [{ id: 'att-2', status: 'went', user_id: 'u1', rating: 5, review: null }],
      },
    ]

    const result = await getHomeSuggestions('u1', [], allEvents, NOW)

    expect(result.candidates).toHaveLength(1)
    expect(result.candidates[0].reason).toEqual({ kind: 'seen', times: 1 })
  })
})
