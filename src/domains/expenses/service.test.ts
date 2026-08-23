import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('./data', () => ({
  getExpenses: vi.fn(),
  getExpenseById: vi.fn(),
  getExpensesForEvent: vi.fn(),
  getExpensesSummary: vi.fn(),
  getVenueArtistSpendEstimate: vi.fn(),
}))

vi.mock('@/src/domains/events/data', () => ({
  getEvents: vi.fn(),
}))

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn(),
}))

import { getExpenses, getExpenseById, getExpensesForEvent, getExpensesSummary, getVenueArtistSpendEstimate } from './data'
import { getEvents } from '@/src/domains/events/data'
import { getCurrentUserId } from '@/src/core/auth/session'
import {
  listExpenses,
  findExpenseById,
  listExpensesForEvent,
  summarizeExpenses,
  listEventOptionsForExpensePicker,
  estimateSpendForEvent,
  insertExpense,
  modifyExpense,
  removeExpense,
} from './service'
import type { EventWithRelations } from '@/src/core/types'

const VALID_EXPENSE_ID = '11111111-1111-1111-1111-111111111111'
const VALID_EVENT_ID = '22222222-2222-2222-2222-222222222222'

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.insert = vi.fn(chain)
  builder.update = vi.fn(chain)
  builder.delete = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.select = vi.fn(chain)
  builder.single = vi.fn(() => Promise.resolve(result))
  builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected)
  return builder
}

/**
 * This service is the seam introduced for issue #25: Server Components and
 * the GraphQL resolver call these functions instead of importing ./data (or,
 * for the picker, the events domain's data.ts) directly. These tests only
 * need to prove each use case delegates to the right data-layer call with
 * the right arguments — the actual Supabase behavior is already covered by
 * data.test.ts.
 */
describe('expenses service (use-case layer)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('listExpenses delegates to getExpenses with the given userId', async () => {
    vi.mocked(getExpenses).mockResolvedValue([{ id: 'e1', user_id: 'u1', amount: 100, category: 'Otro', date: '2026-01-01' }])

    const result = await listExpenses('u1')

    expect(getExpenses).toHaveBeenCalledWith('u1')
    expect(result).toEqual([{ id: 'e1', user_id: 'u1', amount: 100, category: 'Otro', date: '2026-01-01' }])
  })

  it('findExpenseById delegates to getExpenseById with id and userId', async () => {
    vi.mocked(getExpenseById).mockResolvedValue(null)

    const result = await findExpenseById('e1', 'u1')

    expect(getExpenseById).toHaveBeenCalledWith('e1', 'u1')
    expect(result).toBeNull()
  })

  it('listExpensesForEvent delegates to getExpensesForEvent with eventId and userId', async () => {
    vi.mocked(getExpensesForEvent).mockResolvedValue([])

    const result = await listExpensesForEvent('ev1', 'u1')

    expect(getExpensesForEvent).toHaveBeenCalledWith('ev1', 'u1')
    expect(result).toEqual([])
  })

  it('summarizeExpenses delegates to getExpensesSummary with the given userId', async () => {
    const summary = { total: 100, byCategory: {}, byYear: {}, count: 1 }
    vi.mocked(getExpensesSummary).mockResolvedValue(summary)

    const result = await summarizeExpenses('u1')

    expect(getExpensesSummary).toHaveBeenCalledWith('u1')
    expect(result).toBe(summary)
  })

  it('listEventOptionsForExpensePicker delegates to the events domain getEvents, with no arguments', async () => {
    vi.mocked(getEvents).mockResolvedValue([])

    const result = await listEventOptionsForExpensePicker()

    expect(getEvents).toHaveBeenCalledWith()
    expect(result).toEqual([])
  })

  it('estimateSpendForEvent extracts venue_id and lineup artist ids from the event before delegating', async () => {
    const estimate = { averageTotal: 6000, eventsConsidered: 2 }
    vi.mocked(getVenueArtistSpendEstimate).mockResolvedValue(estimate)
    const event = {
      id: 'ev-1',
      venue_id: 'venue-1',
      lineups: [
        { artists: { id: 'artist-1', name: 'Band A' } },
        { artists: { id: 'artist-2', name: 'Band B' } },
      ],
    } as unknown as EventWithRelations

    const result = await estimateSpendForEvent(event, 'u1')

    expect(getVenueArtistSpendEstimate).toHaveBeenCalledWith('u1', 'venue-1', ['artist-1', 'artist-2'], 'ev-1')
    expect(result).toBe(estimate)
  })

  it('estimateSpendForEvent passes an empty artist list when the event has no lineup', async () => {
    vi.mocked(getVenueArtistSpendEstimate).mockResolvedValue(null)
    const event = { id: 'ev-1', venue_id: null, lineups: null } as unknown as EventWithRelations

    await estimateSpendForEvent(event, 'u1')

    expect(getVenueArtistSpendEstimate).toHaveBeenCalledWith('u1', null, [], 'ev-1')
  })
})

/**
 * Write side. These use cases lived in actions.ts until the GraphQL
 * migration (#44) folded them into this module: the Server Actions that
 * wrapped them — createExpense/updateExpense/deleteExpense, which redirected
 * — are gone, and the GraphQL mutations now call these directly. The
 * validation, sanitization and user-scoping rules did not change, so they
 * are asserted here at their new home.
 *
 * The redirect assertions those Server Actions used to carry now belong to
 * the components that navigate instead — ExpenseForm.test.tsx for
 * create/edit and DeleteExpenseAction.test.tsx for delete.
 */
describe('insertExpense', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  it('requires a logged-in user', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)

    const result = await insertExpense({ amount: 100, category: 'Entrada', date: '2024-01-01' })

    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('rejects a zero or negative amount', async () => {
    const zero = await insertExpense({ amount: 0, category: 'Entrada', date: '2024-01-01' })
    expect(zero.error).toBeTruthy()

    const negative = await insertExpense({ amount: -5, category: 'Entrada', date: '2024-01-01' })
    expect(negative.error).toBeTruthy()

    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('rejects an amount over the sanity cap', async () => {
    const result = await insertExpense({ amount: 20_000_000, category: 'Entrada', date: '2024-01-01' })

    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('rejects a missing category', async () => {
    const result = await insertExpense({ amount: 100, category: '  ', date: '2024-01-01' })

    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('rejects a missing or unparseable date', async () => {
    const missing = await insertExpense({ amount: 100, category: 'Entrada', date: '' })
    expect(missing.error).toBeTruthy()

    const bad = await insertExpense({ amount: 100, category: 'Entrada', date: 'not-a-date' })
    expect(bad.error).toBeTruthy()

    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('rejects an invalid event_id when provided', async () => {
    const result = await insertExpense({
      amount: 100,
      category: 'Entrada',
      date: '2024-01-01',
      event_id: 'not-a-uuid',
    })

    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('inserts trimmed values scoped to the current user, and returns the new id', async () => {
    const builder = makeQueryBuilder({ data: { id: 'expense-1' }, error: null })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    const result = await insertExpense({
      amount: 150,
      category: '  Entrada  ',
      note: '  Con descuento  ',
      date: '2024-01-01',
      event_id: VALID_EVENT_ID,
    })

    expect(builder.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      amount: 150,
      category: 'Entrada',
      note: 'Con descuento',
      event_id: VALID_EVENT_ID,
      date: '2024-01-01',
    })
    expect(result).toEqual({ id: 'expense-1' })
  })

  it('stores a null event_id and note when the expense carries neither', async () => {
    const builder = makeQueryBuilder({ data: { id: 'expense-1' }, error: null })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    await insertExpense({ amount: 150, category: 'Entrada', date: '2024-01-01' })

    expect(builder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ event_id: null, note: null })
    )
  })

  it('returns a sanitized error when the insert fails, never the raw DB message', async () => {
    const builder = makeQueryBuilder({ data: null, error: { message: 'boom' } })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    const result = await insertExpense({ amount: 100, category: 'Entrada', date: '2024-01-01' })

    expect(result.error).toBeTruthy()
    expect(result.error).not.toContain('boom')
  })
})

describe('modifyExpense', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  it('requires a logged-in user', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)

    const result = await modifyExpense(VALID_EXPENSE_ID, {})

    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('rejects an invalid expense id', async () => {
    const result = await modifyExpense('not-a-uuid', {})

    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('rejects an invalid amount when provided', async () => {
    const result = await modifyExpense(VALID_EXPENSE_ID, { amount: -1 })

    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('rejects an invalid event_id when provided', async () => {
    const result = await modifyExpense(VALID_EXPENSE_ID, { event_id: 'not-a-uuid' })

    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('rejects an unparseable date when provided, without touching the client', async () => {
    const result = await modifyExpense(VALID_EXPENSE_ID, { date: 'not-a-date' })

    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('reports noChanges when nothing was actually provided, without touching the client', async () => {
    const result = await modifyExpense(VALID_EXPENSE_ID, {})

    expect(result).toEqual({ noChanges: true })
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it(
    'scopes the update to both the expense id and the owning user_id ' +
      "(defense in depth against updating someone else's expense)",
    async () => {
      const builder = makeQueryBuilder({ data: null, error: null })
      mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

      const result = await modifyExpense(VALID_EXPENSE_ID, { category: 'Comida y bebida' })

      expect(builder.update).toHaveBeenCalledWith({ category: 'Comida y bebida' })
      expect(builder.eq).toHaveBeenCalledWith('id', VALID_EXPENSE_ID)
      expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1')
      expect(result).toEqual({})
    }
  )

  it('only writes the fields that were actually provided', async () => {
    const builder = makeQueryBuilder({ data: null, error: null })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    await modifyExpense(VALID_EXPENSE_ID, { amount: 2500 })

    expect(builder.update).toHaveBeenCalledWith({ amount: 2500 })
  })

  it('returns a sanitized error when the update fails', async () => {
    const builder = makeQueryBuilder({ data: null, error: { message: 'boom' } })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    const result = await modifyExpense(VALID_EXPENSE_ID, { category: 'Comida y bebida' })

    expect(result.error).toBeTruthy()
    expect(result.error).not.toContain('boom')
  })
})

describe('removeExpense', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  it('requires a logged-in user', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)

    const result = await removeExpense(VALID_EXPENSE_ID)

    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('rejects an invalid id', async () => {
    const result = await removeExpense('not-a-uuid')

    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('scopes the delete to both the expense id and the owning user_id', async () => {
    const builder = makeQueryBuilder({ data: null, error: null })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    const result = await removeExpense(VALID_EXPENSE_ID)

    expect(builder.eq).toHaveBeenCalledWith('id', VALID_EXPENSE_ID)
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(result).toEqual({})
  })

  it('returns a sanitized error when the delete fails', async () => {
    const builder = makeQueryBuilder({ data: null, error: { message: 'boom' } })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    const result = await removeExpense(VALID_EXPENSE_ID)

    expect(result.error).toBeTruthy()
    expect(result.error).not.toContain('boom')
  })
})
