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

  const emptySummary = { total: 0, byCategory: {}, byYear: {}, count: 0 }

  function mockRpc(result: { data: unknown; error: unknown }) {
    const rpc = vi.fn().mockResolvedValue(result)
    mockCreateClient.mockReturnValue(Promise.resolve({ rpc }))
    return rpc
  }

  it('returns an empty summary without querying when there is no user', async () => {
    const summary = await getExpensesSummary(null)

    expect(mockCreateClient).not.toHaveBeenCalled()
    expect(summary).toEqual(emptySummary)
  })

  it('delegates the aggregation to the RPC and returns what it produced', async () => {
    const aggregated = {
      total: 3500,
      byCategory: { Entrada: 3000, Transporte: 500 },
      byYear: { '2026': 1500, '2027': 2000 },
      count: 3,
    }
    const rpc = mockRpc({ data: aggregated, error: null })

    const summary = await getExpensesSummary('user-1')

    expect(rpc).toHaveBeenCalledWith('get_expenses_summary', { user_uuid: 'user-1' })
    expect(summary).toEqual(aggregated)
  })

  it('falls back to an empty summary when the RPC errors', async () => {
    mockRpc({ data: null, error: { message: 'boom' } })

    await expect(getExpensesSummary('user-1')).resolves.toEqual(emptySummary)
  })

  it('falls back to an empty summary when the RPC returns no data', async () => {
    mockRpc({ data: null, error: null })

    await expect(getExpensesSummary('user-1')).resolves.toEqual(emptySummary)
  })
})

describe('getVenueArtistSpendEstimate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function mockRpc(result: { data: unknown; error: unknown }) {
    const rpc = vi.fn().mockResolvedValue(result)
    mockCreateClient.mockReturnValue(Promise.resolve({ rpc }))
    return rpc
  }

  it('returns null without querying when there is no user', async () => {
    const result = await getVenueArtistSpendEstimate(null, 'venue-1', ['artist-1'], 'ev-1')
    expect(mockCreateClient).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })

  it('returns null without querying when neither a venue nor any artists are given', async () => {
    const result = await getVenueArtistSpendEstimate('user-1', null, [], 'ev-1')
    expect(mockCreateClient).not.toHaveBeenCalled()
    expect(result).toBeNull()
  })

  it('delegates the aggregation to the RPC, passing the current event as the exclusion', async () => {
    const rpc = mockRpc({ data: { averageTotal: 6000, eventsConsidered: 2 }, error: null })

    await getVenueArtistSpendEstimate('user-1', 'venue-1', ['artist-1'], 'ev-1')

    expect(rpc).toHaveBeenCalledWith('get_venue_artist_spend_estimate', {
      p_user_id: 'user-1',
      p_venue_id: 'venue-1',
      p_artist_ids: ['artist-1'],
      p_exclude_event_id: 'ev-1',
    })
  })

  it('returns the estimate the RPC produced', async () => {
    mockRpc({ data: { averageTotal: 6000, eventsConsidered: 2 }, error: null })

    const result = await getVenueArtistSpendEstimate('user-1', 'venue-1', [], 'ev-1')

    expect(result).toEqual({ averageTotal: 6000, eventsConsidered: 2 })
  })

  it('returns null when the RPC finds no past events to average', async () => {
    mockRpc({ data: null, error: null })

    const result = await getVenueArtistSpendEstimate('user-1', 'venue-1', [], 'ev-1')

    expect(result).toBeNull()
  })

  it('returns null (without throwing) when the RPC errors', async () => {
    mockRpc({ data: null, error: { message: 'boom' } })

    const result = await getVenueArtistSpendEstimate('user-1', 'venue-1', [], 'ev-1')

    expect(result).toBeNull()
  })
})
