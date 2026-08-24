import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/src/domains/expenses/service', () => ({
  listExpenses: vi.fn(),
  listExpensesForEvent: vi.fn(),
  findExpenseById: vi.fn(),
  summarizeExpenses: vi.fn(),
  estimateSpendForEvent: vi.fn(),
  insertExpense: vi.fn(),
  modifyExpense: vi.fn(),
  removeExpense: vi.fn(),
}))

vi.mock('@/src/domains/events/data', () => ({
  getEvents: vi.fn(),
  getEventsWithAttendance: vi.fn(),
  getEventById: vi.fn(),
}))

vi.mock('@/src/core/lib/supabase/server', () => ({
  // rpc must resolve, not be missing — createGraphQLContext() now calls
  // supabase.rpc('get_user_role', ...) for any authenticated request, and an
  // empty mock object here throws (`rpc is not a function`) inside every
  // resolver, which yoga swallows into an opaque "Unexpected error".
  createClient: vi.fn().mockResolvedValue({
    rpc: vi.fn().mockResolvedValue({ data: 'usuario', error: null }),
  }),
}))

const mockGetCurrentUserId = vi.fn()
vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: () => mockGetCurrentUserId(),
}))

import {
  listExpenses,
  listExpensesForEvent,
  findExpenseById,
  summarizeExpenses,
  estimateSpendForEvent,
  insertExpense,
  modifyExpense,
  removeExpense,
} from '@/src/domains/expenses/service'
import { getEventById } from '@/src/domains/events/data'
import type { EventWithRelations } from '@/src/core/types'
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
    mockGetCurrentUserId.mockResolvedValue('user-1')
  })

  it('resolves expenses using the userId from the request context, not an argument', async () => {
    vi.mocked(listExpenses).mockResolvedValue([
      { id: 'ex1', user_id: 'user-1', amount: 5000, category: 'Entrada', date: '2026-03-01' },
    ])

    const body = await query('{ expenses { id amount category } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ expenses: [{ id: 'ex1', amount: 5000, category: 'Entrada' }] })
    expect(listExpenses).toHaveBeenCalledWith('user-1')
  })

  // Sin sesión el resolver no inventa un usuario: pasa null y deja que el
  // data layer devuelva vacío, igual que hacía la Server Action anónima.
  it('passes null when there is no session', async () => {
    mockGetCurrentUserId.mockResolvedValue(null)
    vi.mocked(listExpenses).mockResolvedValue([])

    await query('{ expenses { id } }')

    expect(listExpenses).toHaveBeenCalledWith(null)
  })

  // El filtro por recital entró con la migración: el panel del evento pide
  // la misma query con eventId en vez de tener su propia.
  it('narrows the expenses query to one event when given an eventId, still scoped to the session user', async () => {
    vi.mocked(listExpensesForEvent).mockResolvedValue([
      { id: 'ex1', user_id: 'user-1', amount: 5000, category: 'Entrada', event_id: 'ev-1', date: '2026-03-01' },
    ])

    const body = await query('{ expenses(eventId: "ev-1") { id eventId } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ expenses: [{ id: 'ex1', eventId: 'ev-1' }] })
    expect(listExpensesForEvent).toHaveBeenCalledWith('ev-1', 'user-1')
    expect(listExpenses).not.toHaveBeenCalled()
  })

  it('resolves the aggregated summary, including the byCategory/byYear maps', async () => {
    vi.mocked(summarizeExpenses).mockResolvedValue({
      total: 15000,
      count: 3,
      byCategory: { Entrada: 10000, 'Comida y bebida': 5000 },
      byYear: { '2026': 15000 },
    })

    const body = await query('{ expensesSummary { total count byCategory byYear } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({
      expensesSummary: {
        total: 15000,
        count: 3,
        byCategory: { Entrada: 10000, 'Comida y bebida': 5000 },
        byYear: { '2026': 15000 },
      },
    })
    expect(summarizeExpenses).toHaveBeenCalledWith('user-1')
  })

  it('resolves a single expense by id, null when it does not belong to the user', async () => {
    vi.mocked(findExpenseById).mockResolvedValue(null)

    const body = await query('{ expense(id: "missing") { id } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ expense: null })
    expect(findExpenseById).toHaveBeenCalledWith('missing', 'user-1')
  })

  it('exposes the snake_case row through camelCase fields', async () => {
    vi.mocked(findExpenseById).mockResolvedValue({
      id: 'ex1',
      user_id: 'user-1',
      amount: 5000,
      category: 'Entrada',
      note: 'Con descuento',
      event_id: 'ev-1',
      date: '2026-03-01',
      created_at: '2026-03-01T10:00:00Z',
    })

    const body = await query('{ expense(id: "ex1") { id userId amount category note eventId date createdAt } }')

    expect(body.errors).toBeUndefined()
    expect(body.data.expense).toEqual({
      id: 'ex1',
      userId: 'user-1',
      amount: 5000,
      category: 'Entrada',
      note: 'Con descuento',
      eventId: 'ev-1',
      date: '2026-03-01',
      createdAt: '2026-03-01T10:00:00Z',
    })
  })

  // La sugerencia blanda del panel de gastos (issue #7) también se sirve por
  // GraphQL: primero busca el recital y recién ahí estima, scopeado al usuario.
  it('estimates spend for an event through the service, scoped to the session user', async () => {
    const event = { id: 'ev-1', venue_id: 'v-1', lineups: [] } as unknown as EventWithRelations
    vi.mocked(getEventById).mockResolvedValue(event)
    vi.mocked(estimateSpendForEvent).mockResolvedValue({ averageTotal: 12000, eventsConsidered: 3 })

    const body = await query('{ estimateSpendForEvent(eventId: "ev-1") { averageTotal eventsConsidered } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ estimateSpendForEvent: { averageTotal: 12000, eventsConsidered: 3 } })
    expect(estimateSpendForEvent).toHaveBeenCalledWith(event, 'user-1')
  })

  it('returns null instead of estimating when the event does not exist', async () => {
    vi.mocked(getEventById).mockResolvedValue(null)

    const body = await query('{ estimateSpendForEvent(eventId: "missing") { averageTotal } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ estimateSpendForEvent: null })
    expect(estimateSpendForEvent).not.toHaveBeenCalled()
  })
})

describe('expenses GraphQL mutations', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCurrentUserId.mockResolvedValue('user-1')
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

  it('leaves event_id undefined when the expense is not linked to a show', async () => {
    vi.mocked(insertExpense).mockResolvedValue({ id: 'ex-new' })

    await query(`mutation {
      createExpense(input: { amount: 5000, category: "Entrada", date: "2026-03-01" }) { id }
    }`)

    expect(insertExpense).toHaveBeenCalledWith(expect.objectContaining({ event_id: undefined }))
  })

  it('surfaces a rejected create through the error field, not a thrown GraphQL error', async () => {
    vi.mocked(insertExpense).mockResolvedValue({ error: 'El monto debe ser mayor a 0.' })

    const body = await query(`mutation {
      createExpense(input: { amount: 0, category: "Entrada", date: "2026-03-01" }) { id error }
    }`)

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ createExpense: { id: null, error: 'El monto debe ser mayor a 0.' } })
  })

  it('updates an expense, translating ActionResult into {success, error}', async () => {
    vi.mocked(modifyExpense).mockResolvedValue({})

    const body = await query(`mutation {
      updateExpense(id: "ex1", input: { category: "Comida y bebida" }) { success error }
    }`)

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ updateExpense: { success: true, error: null } })
    expect(modifyExpense).toHaveBeenCalledWith('ex1', {
      amount: undefined,
      category: 'Comida y bebida',
      note: undefined,
      event_id: undefined,
      date: undefined,
    })
  })

  it('reports a no-op update as success, same as the service does', async () => {
    vi.mocked(modifyExpense).mockResolvedValue({ noChanges: true })

    const body = await query('mutation { updateExpense(id: "ex1", input: {}) { success error } }')

    expect(body.data).toEqual({ updateExpense: { success: true, error: null } })
  })

  it('reports a rejected update through success:false', async () => {
    vi.mocked(modifyExpense).mockResolvedValue({ error: 'Gasto inválido.' })

    const body = await query('mutation { updateExpense(id: "nope", input: { amount: 1 }) { success error } }')

    expect(body.errors).toBeUndefined()
    expect(body.data).toEqual({ updateExpense: { success: false, error: 'Gasto inválido.' } })
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

  // Las mutations no aceptan un userId por argumento: el dueño sale siempre
  // de la sesión dentro del service, así que un cliente no puede escribir
  // sobre el gasto de otro pidiéndolo por parámetro.
  it('exposes no userId argument on any expense mutation', async () => {
    const body = await query(`mutation {
      createExpense(input: { amount: 1, category: "Entrada", date: "2026-03-01", userId: "someone-else" }) { id }
    }`)

    expect(body.errors).toBeDefined()
    expect(insertExpense).not.toHaveBeenCalled()
  })
})
