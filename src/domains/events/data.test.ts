import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn(),
}))

import { getEvents, getEventsWithAttendance, getEventIdsForSitemap, getShowTonight, MAX_EVENTS } from '@/src/domains/events/data'
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

describe('getShowTonight', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function makeAttendanceBuilder(result: { data: unknown; error: unknown }) {
    const builder: Record<string, unknown> = {}
    const chain = () => builder
    builder.select = vi.fn(chain)
    builder.eq = vi.fn(chain)
    builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected)
    return builder
  }

  // Query "attendance-first": acotada a las propias filas 'going' del
  // usuario (tabla chica), sin filtro de fecha en SQL (pickShowTonight ya
  // filtra el día calendario) y sin `!inner` (el repo lo evita en general
  // para no depender de que Supabase-js resuelva bien un filtro anidado
  // sobre una tabla embebida — acá directamente no aplica porque no hay
  // filtro anidado). R1-003.
  it('consulta attendance filtrando sólo por user_id y status=going, sin filtro de fecha', async () => {
    const builder = makeAttendanceBuilder({ data: [], error: null })
    const fromMock = vi.fn(() => builder)
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    await getShowTonight('user-1')

    expect(fromMock).toHaveBeenCalledWith('attendance')
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(builder.eq).toHaveBeenCalledWith('status', 'going')
    expect(builder.eq).toHaveBeenCalledTimes(2)
  })

  it('devuelve el show de esta noche cuando pickShowTonight encuentra uno', async () => {
    const now = new Date('2026-07-21T15:00:00Z')
    const rows = [
      {
        status: 'going',
        events: { id: 'e1', name: 'Show de esta noche', date: '2026-07-21T21:00:00-03:00', lineups: null },
      },
    ]
    const builder = makeAttendanceBuilder({ data: rows, error: null })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    const result = await getShowTonight('user-1', now)

    expect(result).toEqual({ id: 'e1', headliner: 'Show de esta noche', date: '2026-07-21T21:00:00-03:00', timeKnown: true })
  })

  it('devuelve null cuando no hay ningún show hoy', async () => {
    const builder = makeAttendanceBuilder({ data: [], error: null })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    const result = await getShowTonight('user-1')

    expect(result).toBeNull()
  })

  it('devuelve null cuando la consulta falla', async () => {
    const builder = makeAttendanceBuilder({ data: null, error: { message: 'boom' } })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    const result = await getShowTonight('user-1')

    expect(result).toBeNull()
  })
})
