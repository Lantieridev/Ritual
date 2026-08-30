import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn(),
}))

import { getEvents, getEventsWithAttendance, getEventIdsForSitemap, getUpcomingEventsInCity, MAX_EVENTS } from '@/src/domains/events/data'
import { getCurrentUserId } from '@/src/core/auth/session'

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.order = vi.fn(chain)
  builder.limit = vi.fn(chain)
  builder.range = vi.fn(chain)
  builder.single = vi.fn(() => Promise.resolve(result))
  builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected)
  return builder
}

// Issue #63: getEvents/getEventsWithAttendance ya soportan paginación real
// (offset/limit → .range(), no un .limit() fijo), pero no había ningún test
// que lo probara — exactamente el tipo de corte silencioso que el propio
// issue pide evitar: sin este test, un bug en .range() (offset ignorado,
// devolver siempre la misma página) pasaría desapercibido.
describe('getEvents (paginación)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('uses .range(offset, offset+limit-1) instead of a fixed .limit() when paginating', async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    const fromMock = vi.fn(() => builder)
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    await getEvents({ limit: 20, offset: 40 })

    expect(builder.range).toHaveBeenCalledWith(40, 59)
    expect(builder.limit).not.toHaveBeenCalled()
  })

  it('requesting the next page returns different events, not a repeated/silent cutoff', async () => {
    const page1 = [{ id: 'e1' }, { id: 'e2' }]
    const page2 = [{ id: 'e3' }, { id: 'e4' }]

    const fromMock = vi.fn()
      .mockReturnValueOnce(makeQueryBuilder({ data: page1, error: null }))
      .mockReturnValueOnce(makeQueryBuilder({ data: page2, error: null }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const first = await getEvents({ limit: 2, offset: 0 })
    const second = await getEvents({ limit: 2, offset: 2 })

    expect(first.map((e) => e.id)).toEqual(['e1', 'e2'])
    expect(second.map((e) => e.id)).toEqual(['e3', 'e4'])
    expect(first).not.toEqual(second)
  })
})

describe('getEventsWithAttendance', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(
    'reads attendance through the session-aware Supabase client, not an anonymous one ' +
      '(regression test for the 2026-07-11 bug: a bare/anonymous client can never satisfy ' +
      "RLS policies scoped `to authenticated`, so attendance always read back empty even " +
      'when the write had succeeded)',
    async () => {
      const mockEvents = [
        {
          id: 'evt-1',
          name: 'Show de prueba',
          attendance: [{ id: 'att-1', status: 'going', user_id: 'user-1' }],
        },
      ]

      const fromMock = vi.fn(() => makeQueryBuilder({ data: mockEvents, error: null }))
      mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))
      vi.mocked(getCurrentUserId).mockResolvedValue('user-1')

      const result = await getEventsWithAttendance()

      expect(mockCreateClient).toHaveBeenCalledTimes(1)
      expect(fromMock).toHaveBeenCalledWith('events')
      expect(result[0].attendance).toEqual([
        { id: 'att-1', status: 'going', user_id: 'user-1' },
      ])
    }
  )

  it('returns events with an empty attendance array when there is no logged-in user', async () => {
    const mockEvents = [{ id: 'evt-1', name: 'Show de prueba', attendance: [] }]
    const fromMock = vi.fn(() => makeQueryBuilder({ data: mockEvents, error: null }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))
    vi.mocked(getCurrentUserId).mockResolvedValue(null)

    const result = await getEventsWithAttendance()

    expect(result[0].attendance).toEqual([])
  })

  // This query ran unbounded against the whole shared catalog, for every
  // visitor (logged in or not — `/` and `/wrapped` aren't behind the auth
  // middleware), unlike its sibling getPersonalStats() which was already
  // bounded by requiring a session first.
  it('caps the query with a defensive limit instead of fetching the whole catalog', async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    const fromMock = vi.fn(() => builder)
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))
    vi.mocked(getCurrentUserId).mockResolvedValue(null)

    await getEventsWithAttendance()

    expect(builder.limit).toHaveBeenCalledWith(MAX_EVENTS)
  })

  it('uses .range() instead of the fixed limit when a caller paginates explicitly', async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    const fromMock = vi.fn(() => builder)
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))
    vi.mocked(getCurrentUserId).mockResolvedValue(null)

    await getEventsWithAttendance({ limit: 10, offset: 30 })

    expect(builder.range).toHaveBeenCalledWith(30, 39)
    expect(builder.limit).not.toHaveBeenCalled()
  })

  it('returns an empty list when the query errors out', async () => {
    const fromMock = vi.fn(() =>
      makeQueryBuilder({ data: null, error: { message: 'boom' } })
    )
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')

    const result = await getEventsWithAttendance()

    expect(result).toEqual([])
  })
})

describe('getEventIdsForSitemap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // Issue #63: MAX_EVENTS (1000, pensado para páginas normales) hacía que
  // shows viejos desaparecieran del sitemap.xml en silencio ni bien el
  // catálogo lo superara. El límite real de un sitemap es 50.000 URLs.
  it('caps at the real sitemap URL limit (50,000), not the page-sized MAX_EVENTS', async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    const fromMock = vi.fn(() => builder)
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    await getEventIdsForSitemap()

    expect(builder.limit).toHaveBeenCalledWith(50_000)
    expect(builder.limit).not.toHaveBeenCalledWith(MAX_EVENTS)
  })
})

describe('getUpcomingEventsInCity', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function makeCityBuilder(result: { data: unknown; error: unknown }) {
    const builder: Record<string, unknown> = {}
    const chain = () => builder
    builder.select = vi.fn(chain)
    builder.ilike = vi.fn(chain)
    builder.in = vi.fn(chain)
    builder.gte = vi.fn(chain)
    builder.order = vi.fn(chain)
    builder.limit = vi.fn(chain)
    builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected)
    return builder
  }

  it('busca sedes por ciudad y después eventos futuros en esas sedes', async () => {
    const venuesBuilder = makeCityBuilder({ data: [{ id: 'v1' }, { id: 'v2' }], error: null })
    const eventsBuilder = makeCityBuilder({ data: [{ id: 'e1', name: 'Show en tu ciudad' }], error: null })
    const fromMock = vi.fn((table: string) => (table === 'venues' ? venuesBuilder : eventsBuilder))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const now = new Date('2026-01-01T00:00:00Z')
    const result = await getUpcomingEventsInCity('Córdoba', now)

    expect(venuesBuilder.ilike).toHaveBeenCalledWith('city', 'Córdoba')
    expect(eventsBuilder.in).toHaveBeenCalledWith('venue_id', ['v1', 'v2'])
    expect(eventsBuilder.gte).toHaveBeenCalledWith('date', now.toISOString())
    expect(result).toEqual([{ id: 'e1', name: 'Show en tu ciudad' }])
  })

  it('no consulta eventos si ninguna sede matchea la ciudad', async () => {
    const venuesBuilder = makeCityBuilder({ data: [], error: null })
    const fromMock = vi.fn(() => venuesBuilder)
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await getUpcomingEventsInCity('Ushuaia')

    expect(result).toEqual([])
    expect(fromMock).toHaveBeenCalledTimes(1)
  })

  it('devuelve lista vacía sin consultar nada si la ciudad viene vacía', async () => {
    const fromMock = vi.fn()
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await getUpcomingEventsInCity('   ')

    expect(result).toEqual([])
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('devuelve lista vacía si falla la consulta de sedes', async () => {
    const venuesBuilder = makeCityBuilder({ data: null, error: { message: 'boom' } })
    const fromMock = vi.fn(() => venuesBuilder)
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await getUpcomingEventsInCity('CABA')

    expect(result).toEqual([])
  })

  it('devuelve lista vacía si falla la consulta de eventos', async () => {
    const venuesBuilder = makeCityBuilder({ data: [{ id: 'v1' }], error: null })
    const eventsBuilder = makeCityBuilder({ data: null, error: { message: 'boom' } })
    const fromMock = vi.fn((table: string) => (table === 'venues' ? venuesBuilder : eventsBuilder))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await getUpcomingEventsInCity('CABA')

    expect(result).toEqual([])
  })
})
