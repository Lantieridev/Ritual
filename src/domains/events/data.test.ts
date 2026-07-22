import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn(),
}))

import { getEventsWithAttendance, MAX_EVENTS } from '@/src/domains/events/data'
import { getCurrentUserId } from '@/src/core/auth/session'

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.order = vi.fn(chain)
  builder.limit = vi.fn(chain)
  builder.single = vi.fn(() => Promise.resolve(result))
  builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected)
  return builder
}

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

  // Regression test found during the Fase 2 checkpoint re-audit: this query
  // ran unbounded against the whole shared catalog, for every visitor
  // (logged in or not — `/` and `/wrapped` aren't behind the auth
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
