import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/domains/expenses/data', () => ({
  getExpenses: vi.fn(),
  getExpenseById: vi.fn(),
  getExpensesSummary: vi.fn(),
}))

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({}),
}))

const mockGetCurrentUserId = vi.fn()
vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
}))

import { getExpenses, getExpenseById, getExpensesSummary } from '@/src/domains/expenses/data'

async function query(source: string) {
  const { POST } = await import('@/app/api/graphql/route')
  const response = await POST(
    new Request('http://localhost/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: source }),
    })
  )
  return response.json()
}

describe('expenses GraphQL schema', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('resolves expenses using the userId from the request context, not an argument', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1')
    vi.mocked(getExpenses).mockResolvedValue([
      { id: 'ex1', user_id: 'user-1', amount: 5000, category: 'Entrada', date: '2026-03-01' },
    ])

    const body = await query('{ expenses { id amount category } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ expenses: [{ id: 'ex1', amount: 5000, category: 'Entrada' }] })
    expect(getExpenses).toHaveBeenCalledWith('user-1')
  })

  it('passes null when there is no session, matching the anonymous behavior of the Server Action', async () => {
    mockGetCurrentUserId.mockResolvedValue(null)
    vi.mocked(getExpenses).mockResolvedValue([])

    await query('{ expenses { id } }')

    expect(getExpenses).toHaveBeenCalledWith(null)
  })

  it('resolves the aggregated summary, including the byCategory/byYear maps', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1')
    vi.mocked(getExpensesSummary).mockResolvedValue({
      total: 15000,
      count: 3,
      byCategory: { Entrada: 10000, Comida: 5000 },
      byYear: { '2026': 15000 },
    })

    const body = await query('{ expensesSummary { total count byCategory byYear } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({
      expensesSummary: {
        total: 15000,
        count: 3,
        byCategory: { Entrada: 10000, Comida: 5000 },
        byYear: { '2026': 15000 },
      },
    })
  })

  it('resolves a single expense by id, null when it does not belong to the user', async () => {
    mockGetCurrentUserId.mockResolvedValue('user-1')
    vi.mocked(getExpenseById).mockResolvedValue(null)

    const body = await query('{ expense(id: "missing") { id } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ expense: null })
    expect(getExpenseById).toHaveBeenCalledWith('missing', 'user-1')
  })
})
