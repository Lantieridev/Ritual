import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

import { getExpenses, getExpensesSummary, getExpensesForEvent, getVenueArtistSpendEstimate } from '@/src/domains/expenses/data'

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.neq = vi.fn(chain)
  builder.in = vi.fn(chain)
  builder.order = vi.fn(chain)
  builder.single = vi.fn(() => Promise.resolve(result))
  builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected)
  return builder
}

describe('getExpenses', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(
    'reads expenses through the session-aware Supabase client, not an anonymous one ' +
      "(regression test for the 2026-07-11 bug: RLS on expenses is scoped `to authenticated`, " +
      'so an anonymous client always read back zero rows even for a logged-in user)',
    async () => {
      const mockExpenses = [
        { id: 'exp-1', user_id: 'user-1', amount: 5000, category: 'Entrada', note: null, event_id: null, date: '2026-07-01', created_at: '2026-07-01' },
      ]
      const fromMock = vi.fn(() => makeQueryBuilder({ data: mockExpenses, error: null }))
      mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

      const result = await getExpenses('user-1')

      expect(mockCreateClient).toHaveBeenCalledTimes(1)
      expect(fromMock).toHaveBeenCalledWith('expenses')
      expect(result).toEqual(mockExpenses)
    }
  )

  it('returns an empty list without touching the client when there is no user id', async () => {
    const result = await getExpenses(null)

    expect(mockCreateClient).not.toHaveBeenCalled()
    expect(result).toEqual([])
  })
})

describe('getExpensesForEvent', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads only the expenses linked to the given event, through the session-aware client', async () => {
    const mockExpenses = [
      { id: 'exp-1', user_id: 'user-1', amount: 5000, category: 'Entrada', note: null, event_id: 'ev-1', date: '2026-07-01', created_at: '2026-07-01' },
    ]
    const fromMock = vi.fn(() => makeQueryBuilder({ data: mockExpenses, error: null }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await getExpensesForEvent('ev-1', 'user-1')

    expect(mockCreateClient).toHaveBeenCalledTimes(1)
    expect(fromMock).toHaveBeenCalledWith('expenses')
    expect(result).toEqual(mockExpenses)
  })

  it('returns an empty list without touching the client when there is no user id', async () => {
    const result = await getExpensesForEvent('ev-1', null)

    expect(mockCreateClient).not.toHaveBeenCalled()
    expect(result).toEqual([])
  })
})

describe('getExpensesSummary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('aggregates total, by category and by year through the session-aware client', async () => {
    const mockExpenses = [
      { amount: 1000, category: 'Entrada', date: '2026-01-15' },
      { amount: 500, category: 'Transporte', date: '2026-01-20' },
      { amount: 2000, category: 'Entrada', date: '2027-03-01' },
    ]
    const fromMock = vi.fn(() => makeQueryBuilder({ data: mockExpenses, error: null }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const summary = await getExpensesSummary('user-1')

    expect(mockCreateClient).toHaveBeenCalledTimes(1)
    expect(summary.total).toBe(3500)
    expect(summary.byCategory['Entrada']).toBe(3000)
    expect(summary.byCategory['Transporte']).toBe(500)
    expect(summary.byYear['2026']).toBe(1500)
    expect(summary.byYear['2027']).toBe(2000)
    expect(summary.count).toBe(3)
  })
})

describe('getVenueArtistSpendEstimate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns null without querying when there is no user id', async () => {
    const result = await getVenueArtistSpendEstimate(null, 'venue-1', [], 'ev-1')
    expect(mockCreateClient).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })

  it('returns null without querying when neither a venue nor any artists are given', async () => {
    const result = await getVenueArtistSpendEstimate('user-1', null, [], 'ev-1')
    expect(mockCreateClient).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })

  it('averages total spend per past event at the same venue', async () => {
    const fromMock = vi.fn((table: string) => {
      if (table === 'events') return makeQueryBuilder({ data: [{ id: 'ev-2' }, { id: 'ev-3' }], error: null })
      if (table === 'expenses') {
        return makeQueryBuilder({
          data: [
            { amount: 3000, event_id: 'ev-2' },
            { amount: 5000, event_id: 'ev-2' },
            { amount: 4000, event_id: 'ev-3' },
          ],
          error: null,
        })
      }
      return makeQueryBuilder({ data: [], error: null })
    })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await getVenueArtistSpendEstimate('user-1', 'venue-1', [], 'ev-1')

    expect(fromMock).toHaveBeenCalledWith('events')
    expect(fromMock).toHaveBeenCalledWith('expenses')
    expect(fromMock).not.toHaveBeenCalledWith('lineups')
    // ev-2 totals 8000, ev-3 totals 4000 -> average 6000 across 2 events
    expect(result).toEqual({ averageTotal: 6000, eventsConsidered: 2 })
  })

  it('unions venue and artist matches, deduping overlaps and excluding the current event, before querying expenses', async () => {
    const expensesBuilder = makeQueryBuilder({
      data: [
        { amount: 1000, event_id: 'ev-2' },
        { amount: 2000, event_id: 'ev-4' },
      ],
      error: null,
    })
    const fromMock = vi.fn((table: string) => {
      if (table === 'events') return makeQueryBuilder({ data: [{ id: 'ev-2' }], error: null })
      // ev-2 overlaps with the venue match (must be deduped, not double-counted),
      // ev-1 is the current event itself (must be excluded).
      if (table === 'lineups') {
        return makeQueryBuilder({
          data: [{ event_id: 'ev-2' }, { event_id: 'ev-4' }, { event_id: 'ev-1' }],
          error: null,
        })
      }
      if (table === 'expenses') return expensesBuilder
      return makeQueryBuilder({ data: [], error: null })
    })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await getVenueArtistSpendEstimate('user-1', 'venue-1', ['artist-1'], 'ev-1')

    const queriedIds = (expensesBuilder.in as ReturnType<typeof vi.fn>).mock.calls[0][1] as string[]
    expect(new Set(queriedIds)).toEqual(new Set(['ev-2', 'ev-4']))
    expect(result).toEqual({ averageTotal: 1500, eventsConsidered: 2 })
  })

  it('returns null when no past events match the venue or artists', async () => {
    const fromMock = vi.fn(() => makeQueryBuilder({ data: [], error: null }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await getVenueArtistSpendEstimate('user-1', 'venue-1', [], 'ev-1')
    expect(result).toBeNull()
  })

  it('returns null when matching events exist but none have any recorded expenses', async () => {
    const fromMock = vi.fn((table: string) => {
      if (table === 'events') return makeQueryBuilder({ data: [{ id: 'ev-2' }], error: null })
      if (table === 'expenses') return makeQueryBuilder({ data: [], error: null })
      return makeQueryBuilder({ data: [], error: null })
    })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await getVenueArtistSpendEstimate('user-1', 'venue-1', [], 'ev-1')
    expect(result).toBeNull()
  })

  it('returns null (without throwing) when the events lookup errors', async () => {
    const fromMock = vi.fn((table: string) => {
      if (table === 'events') return makeQueryBuilder({ data: null, error: { message: 'boom' } })
      return makeQueryBuilder({ data: [], error: null })
    })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await getVenueArtistSpendEstimate('user-1', 'venue-1', [], 'ev-1')
    expect(result).toBeNull()
  })
})
