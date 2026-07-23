import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/domains/expenses/data', () => ({
  getExpenses: vi.fn(),
  getExpenseById: vi.fn(),
  getExpensesSummary: vi.fn(),
}))

vi.mock('@/src/domains/expenses/actions', () => ({
  insertExpense: vi.fn(),
  modifyExpense: vi.fn(),
  removeExpense: vi.fn(),
}))

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({}),
}))

const mockGetCurrentUserId = vi.fn()
vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
}))

import { getExpenses, getExpenseById, getExpensesSummary } from '@/src/domains/expenses/data'
import { insertExpense, modifyExpense, removeExpense } from '@/src/domains/expenses/actions'
import { POST } from '@/app/api/graphql/route'

async function query(source: string) {
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

describe('expenses GraphQL mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('creates an expense, mapping camelCase input to the domain snake_case shape', async () => {
    vi.mocked(insertExpense).mockResolvedValue({ id: 'ex-new' })

    const body = await query(`mutation {
      createExpense(input: { amount: 5000, category: "Entrada", date: "2026-03-01", eventId: "e1" }) { id error }
    }`)

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ createExpense: { id: 'ex-new', error: null } })
    expect(insertExpense).toHaveBeenCalledWith({
      amount: 5000,
      category: 'Entrada',
      note: undefined,
      event_id: 'e1',
      date: '2026-03-01',
    })
  })

  it('updates an expense, translating ActionResult into {success, error}', async () => {
    vi.mocked(modifyExpense).mockResolvedValue({})

    const body = await query(`mutation {
      updateExpense(id: "ex1", input: { category: "Comida" }) { success error }
    }`)

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ updateExpense: { success: true, error: null } })
    expect(modifyExpense).toHaveBeenCalledWith('ex1', {
      amount: undefined,
      category: 'Comida',
      note: undefined,
      event_id: undefined,
      date: undefined,
    })
  })

  it('reports a no-op update as success, same as the Server Action does', async () => {
    vi.mocked(modifyExpense).mockResolvedValue({ noChanges: true })

    const body = await query('mutation { updateExpense(id: "ex1", input: {}) { success error } }')

    expect(body.data).toEqual({ updateExpense: { success: true, error: null } })
  })

  it('deletes an expense', async () => {
    vi.mocked(removeExpense).mockResolvedValue({})

    const body = await query('mutation { deleteExpense(id: "ex1") { success error } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ deleteExpense: { success: true, error: null } })
    expect(removeExpense).toHaveBeenCalledWith('ex1')
  })

  it('reports failure through success:false, not a thrown GraphQL error', async () => {
    vi.mocked(removeExpense).mockResolvedValue({ error: 'boom' })

    const body = await query('mutation { deleteExpense(id: "ex1") { success error } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ deleteExpense: { success: false, error: 'boom' } })
  })
})
