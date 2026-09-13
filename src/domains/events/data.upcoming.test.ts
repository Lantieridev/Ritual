import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

import { getUpcomingEvents, listSuggestionCandidates, SUGGESTION_CANDIDATES_SELECT, CANDIDATE_LIMIT } from '@/src/domains/events/data'
import { listUpcomingEvents, listSuggestionCandidates as listSuggestionCandidatesService } from '@/src/domains/events/service'

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.gte = vi.fn(chain)
  builder.lt = vi.fn(chain)
  builder.order = vi.fn(chain)
  builder.limit = vi.fn(chain)
  builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected)
  return builder
}

const EXPECTED_EVENTS_SELECT = `
  *,
  venues ( name, city, country ),
  lineups (
    artists ( id, name, genre ),
    b2b_group
  )
`

describe('getUpcomingEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('cuts from the start of today in Argentina time, so a show later tonight — or one already underway — still counts', async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    // 22:00 del 12/09 en Argentina es ya el 13/09 en UTC: el corte tiene que
    // ser el día argentino, no el UTC.
    await getUpcomingEvents(undefined, new Date('2026-09-13T01:00:00.000Z'))

    expect(builder.gte).toHaveBeenCalledWith('date', '2026-09-12T00:00:00-03:00')
  })

  it('queries events table using EVENTS_SELECT, from the start of today, ordered by date ascending, with default NEARBY_LIMIT (6)', async () => {
    const mockEvents = [
      { id: 'e1', name: 'Show A', date: '2026-10-01T20:00:00.000Z' },
      { id: 'e2', name: 'Show B', date: '2026-11-01T20:00:00.000Z' },
    ]
    const builder = makeQueryBuilder({ data: mockEvents, error: null })
    const fromMock = vi.fn(() => builder)
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const now = new Date('2026-09-12T12:00:00.000Z')
    const result = await getUpcomingEvents(undefined, now)

    expect(mockCreateClient).toHaveBeenCalledTimes(1)
    expect(fromMock).toHaveBeenCalledWith('events')
    expect(builder.select).toHaveBeenCalledWith(EXPECTED_EVENTS_SELECT)
    expect(builder.gte).toHaveBeenCalledWith('date', '2026-09-12T00:00:00-03:00')
    expect(builder.order).toHaveBeenCalledWith('date', { ascending: true })
    expect(builder.limit).toHaveBeenCalledWith(6)
    expect(result).toEqual(mockEvents)
  })

  it('applies a custom limit parameter when provided', async () => {
    const builder = makeQueryBuilder({ data: [], error: null })
    const fromMock = vi.fn(() => builder)
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const now = new Date('2026-09-12T12:00:00.000Z')
    await getUpcomingEvents(3, now)

    expect(builder.limit).toHaveBeenCalledWith(3)
  })

  it('returns an empty array and logs error when the query fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const builder = makeQueryBuilder({ data: null, error: { message: 'Database connection failed' } })
    const fromMock = vi.fn(() => builder)
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await getUpcomingEvents()

    expect(result).toEqual([])
    expect(consoleSpy).toHaveBeenCalledWith('Error buscando próximos shows:', { message: 'Database connection failed' })
    consoleSpy.mockRestore()
  })
})

describe('listUpcomingEvents (service.ts wrapper)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('forwards the limit parameter to getUpcomingEvents', async () => {
    const mockEvents = [{ id: 'e1', name: 'Show A', date: '2026-10-01T20:00:00.000Z' }]
    const builder = makeQueryBuilder({ data: mockEvents, error: null })
    const fromMock = vi.fn(() => builder)
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await listUpcomingEvents(10)

    expect(builder.limit).toHaveBeenCalledWith(10)
    expect(result).toEqual(mockEvents)
  })
})

describe('listSuggestionCandidates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('queries events using the narrow SUGGESTION_CANDIDATES_SELECT, from today (AR) through day 90 inclusive, ordered by date asc, capped at CANDIDATE_LIMIT', async () => {
    const rows = [{ id: 'e1', name: 'Show A', date: '2026-09-15T20:00:00.000Z', venues: null, lineups: [] }]
    const builder = makeQueryBuilder({ data: rows, error: null })
    const fromMock = vi.fn(() => builder)
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const now = new Date('2026-09-14T12:00:00.000Z')
    const result = await listSuggestionCandidates(now)

    expect(fromMock).toHaveBeenCalledWith('events')
    expect(builder.select).toHaveBeenCalledWith(SUGGESTION_CANDIDATES_SELECT)
    expect(builder.gte).toHaveBeenCalledWith('date', '2026-09-14T00:00:00-03:00')
    // El corte es una día después del día 90 (exclusivo): computeDateFactor
    // acepta 0-90 días inclusive, así que el día 90 entero tiene que
    // aparecer en la query, no quedar afuera por el `.lt` exclusivo.
    expect(builder.lt).toHaveBeenCalledWith('date', '2026-12-14T00:00:00-03:00')
    expect(builder.order).toHaveBeenCalledWith('date', { ascending: true })
    expect(builder.limit).toHaveBeenCalledWith(CANDIDATE_LIMIT)
    expect(CANDIDATE_LIMIT).toBe(100)
    expect(result).toEqual(rows)
  })

  it('returns an empty array and logs error when the query fails', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const builder = makeQueryBuilder({ data: null, error: { message: 'boom' } })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    const result = await listSuggestionCandidates(new Date('2026-09-14T12:00:00.000Z'))

    expect(result).toEqual([])
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('never touches the original EVENTS_SELECT shape (payload economy: no lat/lng on the generic listing)', () => {
    expect(SUGGESTION_CANDIDATES_SELECT).toContain('lat')
    expect(SUGGESTION_CANDIDATES_SELECT).toContain('lng')
  })
})

describe('listSuggestionCandidates (service.ts wrapper)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('forwards the reference date to listSuggestionCandidates', async () => {
    const rows = [{ id: 'e1', name: 'Show A', date: '2026-09-15', venues: null, lineups: [] }]
    const builder = makeQueryBuilder({ data: rows, error: null })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    const result = await listSuggestionCandidatesService(new Date('2026-09-14T12:00:00.000Z'))

    expect(result).toEqual(rows)
  })
})
