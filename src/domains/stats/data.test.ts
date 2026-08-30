import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn(),
}))

import { getPersonalStats } from '@/src/domains/stats/data'
import { getCurrentUserId } from '@/src/core/auth/session'

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.order = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected)
  return builder
}

type FixtureEvent = {
  id: string
  name: string | null
  date: string
  venues: unknown
  lineups: unknown
  attendance: Array<{ status: string; user_id: string; rating: number | null; used_ear_protection?: boolean | null }>
}

/**
 * Los casos siguen describiendo eventos con su attendance embebida, que es
 * como se leen mejor. La query real ahora es al revés — parte de `attendance`
 * filtrada por usuario y embebe el evento — así que el helper traduce.
 *
 * Los eventos con `attendance: []` no se traducen a ninguna fila, porque la
 * query nueva directamente no los trae: el filtro que antes ocurría en JS
 * ahora lo hace la base.
 */
function mockEvents(events: unknown[]) {
  const rows = (events as FixtureEvent[]).flatMap((ev) =>
    (ev.attendance ?? []).map((att) => ({
      status: att.status,
      user_id: att.user_id,
      rating: att.rating,
      used_ear_protection: att.used_ear_protection ?? null,
      events: { id: ev.id, name: ev.name, date: ev.date, venues: ev.venues, lineups: ev.lineups },
    }))
  )
  const fromMock = vi.fn(() => makeQueryBuilder({ data: rows, error: null }))
  mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))
  return fromMock
}

describe('getPersonalStats', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  it(
    'only counts events the user actually has attendance for, not the whole shared catalog ' +
      '(regression test: the catalog table is globally RLS-readable, so before this fix ' +
      'totalShows/uniqueArtists/uniqueVenues/showsByYear/topArtists/topVenues/recentActivity ' +
      'were all silently computed over every event in the app, not the ones the user logged)',
    async () => {
      const events = [
        {
          id: 'evt-mine',
          name: 'Show que fui',
          date: '2024-05-01',
          venues: { name: 'Niceto', city: 'Buenos Aires', country: 'AR' },
          lineups: [{ artists: { name: 'Bandalos Chinos' } }],
          attendance: [{ status: 'went', user_id: 'user-1', rating: 4 }],
        },
        {
          id: 'evt-not-mine',
          name: 'Show que no fui, ajeno al catálogo',
          date: '2024-06-01',
          venues: { name: 'Luna Park', city: 'Buenos Aires', country: 'AR' },
          lineups: [{ artists: { name: 'Otro Artista' } }],
          attendance: [],
        },
      ]
      mockEvents(events)

      const stats = await getPersonalStats()

      expect(stats.totalShows).toBe(1)
      expect(stats.uniqueArtists).toBe(1)
      expect(stats.uniqueVenues).toBe(1)
      expect(stats.uniqueCities).toEqual(['Buenos Aires'])
      expect(stats.showsByYear).toEqual({ '2024': 1 })
      expect(stats.topArtists).toEqual([{ name: 'Bandalos Chinos', count: 1 }])
      expect(stats.topVenues).toEqual([{ name: 'Niceto', city: 'Buenos Aires', count: 1 }])
      expect(stats.recentActivity).toHaveLength(1)
      expect(stats.recentActivity[0].id).toBe('evt-mine')
    }
  )

  it('breaks down showsAttended/showsGoing/showsInterested by attendance status', async () => {
    const events = [
      {
        id: 'evt-went',
        name: 'Fui',
        date: '2023-01-01',
        venues: null,
        lineups: [],
        attendance: [{ status: 'went', user_id: 'user-1', rating: null }],
      },
      {
        id: 'evt-going',
        name: 'Voy a ir',
        date: '2099-01-01',
        venues: null,
        lineups: [],
        attendance: [{ status: 'going', user_id: 'user-1', rating: null }],
      },
      {
        id: 'evt-interested',
        name: 'Me interesa',
        date: '2099-02-01',
        venues: null,
        lineups: [],
        attendance: [{ status: 'interested', user_id: 'user-1', rating: null }],
      },
    ]
    mockEvents(events)

    const stats = await getPersonalStats()

    expect(stats.totalShows).toBe(3)
    expect(stats.showsAttended).toBe(1)
    expect(stats.showsGoing).toBe(1)
    expect(stats.showsInterested).toBe(1)
  })

  it('computes averageRating only from rated attendance on my own attended shows', async () => {
    const events = [
      {
        id: 'evt-1',
        name: 'Show 1',
        date: '2023-01-01',
        venues: null,
        lineups: [],
        attendance: [{ status: 'went', user_id: 'user-1', rating: 4 }],
      },
      {
        id: 'evt-2',
        name: 'Show 2',
        date: '2023-02-01',
        venues: null,
        lineups: [],
        attendance: [{ status: 'went', user_id: 'user-1', rating: 5 }],
      },
      {
        id: 'evt-3-unrated',
        name: 'Show sin rating',
        date: '2023-03-01',
        venues: null,
        lineups: [],
        attendance: [{ status: 'went', user_id: 'user-1', rating: null }],
      },
    ]
    mockEvents(events)

    const stats = await getPersonalStats()

    expect(stats.averageRating).toBe(4.5)
    expect(stats.totalRated).toBe(2)
  })

  it('returns null averageRating when no shows have a rating', async () => {
    mockEvents([
      {
        id: 'evt-1',
        name: 'Show',
        date: '2023-01-01',
        venues: null,
        lineups: [],
        attendance: [{ status: 'went', user_id: 'user-1', rating: null }],
      },
    ])

    const stats = await getPersonalStats()

    expect(stats.averageRating).toBeNull()
    expect(stats.totalRated).toBe(0)
  })

  it('excludes future shows from recentActivity but keeps them in totalShows', async () => {
    mockEvents([
      {
        id: 'evt-future',
        name: 'Show futuro',
        date: '2099-01-01',
        venues: null,
        lineups: [],
        attendance: [{ status: 'going', user_id: 'user-1', rating: null }],
      },
      {
        id: 'evt-past',
        name: 'Show pasado',
        date: '2020-01-01',
        venues: null,
        lineups: [],
        attendance: [{ status: 'went', user_id: 'user-1', rating: null }],
      },
    ])

    const stats = await getPersonalStats()

    expect(stats.totalShows).toBe(2)
    expect(stats.recentActivity).toHaveLength(1)
    expect(stats.recentActivity[0].id).toBe('evt-past')
  })

  it('caps recentActivity at the 10 most recent past shows', async () => {
    const events = Array.from({ length: 15 }, (_, i) => ({
      id: `evt-${i}`,
      name: `Show ${i}`,
      date: `20${10 + i}-01-01`,
      venues: null,
      lineups: [],
      attendance: [{ status: 'went', user_id: 'user-1', rating: null }],
    }))
    mockEvents(events)

    const stats = await getPersonalStats()

    expect(stats.recentActivity).toHaveLength(10)
  })

  it('returns empty stats when there is no logged-in user, without querying the catalog', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)
    mockEvents([
      {
        id: 'evt-1',
        name: 'Show',
        date: '2023-01-01',
        venues: { name: 'Niceto', city: 'Buenos Aires', country: 'AR' },
        lineups: [{ artists: { name: 'Artista' } }],
        attendance: [],
      },
    ])

    const stats = await getPersonalStats()

    expect(stats.totalShows).toBe(0)
    expect(stats.uniqueArtists).toBe(0)
    expect(stats.recentActivity).toEqual([])
    // Resilience fix: an anonymous visitor (e.g. /wrapped, which isn't behind
    // the auth middleware) shouldn't trigger a full app-wide catalog fetch
    // that's guaranteed to be discarded a moment later.
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('returns empty stats when the query errors out', async () => {
    const fromMock = vi.fn(() => makeQueryBuilder({ data: null, error: { message: 'boom' } }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const stats = await getPersonalStats()

    expect(stats.totalShows).toBe(0)
    expect(stats.showsAttended).toBe(0)
    expect(stats.averageRating).toBeNull()
  })

  // Issue #62: reducción de daños.
  it('flows used_ear_protection through into earProtectionShows/totalWithEarProtectionAnswer', async () => {
    mockEvents([
      {
        id: 'evt-1',
        name: 'Show 1',
        date: '2024-05-01',
        venues: { name: 'Niceto', city: 'CABA', country: 'AR' },
        lineups: [{ artists: { name: 'Artista' } }],
        attendance: [{ status: 'went', user_id: 'user-1', rating: 4, used_ear_protection: true }],
      },
      {
        id: 'evt-2',
        name: 'Show 2',
        date: '2024-06-01',
        venues: { name: 'Groove', city: 'CABA', country: 'AR' },
        lineups: [{ artists: { name: 'Otro' } }],
        attendance: [{ status: 'went', user_id: 'user-1', rating: 3, used_ear_protection: false }],
      },
      {
        id: 'evt-3',
        name: 'Show 3, sin contestar',
        date: '2024-07-01',
        venues: { name: 'Crobar', city: 'CABA', country: 'AR' },
        lineups: [{ artists: { name: 'Otro Más' } }],
        attendance: [{ status: 'went', user_id: 'user-1', rating: 5 }],
      },
    ])

    const stats = await getPersonalStats()

    expect(stats.earProtectionShows).toBe(1)
    expect(stats.totalWithEarProtectionAnswer).toBe(2)
  })
})
