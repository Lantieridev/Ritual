import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

import { getExpenses, getExpensesSummary, getExpensesForEvent } from '@/src/domains/expenses/data'

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.eq = vi.fn(chain)
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
