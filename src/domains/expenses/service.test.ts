import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('./data', () => ({
  getExpenses: vi.fn(),
  getExpenseById: vi.fn(),
  getExpensesForEvent: vi.fn(),
  getExpensesSummary: vi.fn(),
  getVenueArtistSpendEstimate: vi.fn(),
  getExpenseSplitsBatch: vi.fn(),
}))

vi.mock('@/src/domains/events/service', () => ({
  listEvents: vi.fn(),
}))

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn(),
}))

import { getExpenses, getExpenseById, getExpensesForEvent, getExpensesSummary, getVenueArtistSpendEstimate } from './data'
import { listEvents } from '@/src/domains/events/service'
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
  addExpenseSplit,
  removeExpenseSplit,
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

  it('listEventOptionsForExpensePicker delegates to the events domain listEvents, with no arguments', async () => {
    vi.mocked(listEvents).mockResolvedValue([])

    const result = await listEventOptionsForExpensePicker()

    expect(listEvents).toHaveBeenCalledWith()
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

describe('addExpenseSplit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  /**
   * Un mock por tabla, para las consultas que hace addExpenseSplit. El chequeo
   * de asistencia va por RPC (user_attends_event), no por SELECT directo a
   * attendance -- esa tabla sólo tiene la policy "el dueño ve su propia fila",
   * así que un SELECT corrido con la sesión de quien comparte el gasto nunca
   * podría ver la asistencia de un tercero (bug real, encontrado en vivo).
   */
  function setUpTables(overrides: {
    expense?: { data: unknown; error: unknown }
    profile?: { data: unknown; error: unknown }
    attends?: { data: unknown; error: unknown }
    insert?: { data: unknown; error: unknown }
  }) {
    const expenseBuilder: Record<string, unknown> = {}
    expenseBuilder.select = vi.fn(() => expenseBuilder)
    expenseBuilder.eq = vi.fn(() => expenseBuilder)
    expenseBuilder.single = vi.fn(() => Promise.resolve(overrides.expense ?? { data: null, error: null }))

    const profileBuilder: Record<string, unknown> = {}
    profileBuilder.select = vi.fn(() => profileBuilder)
    profileBuilder.ilike = vi.fn(() => profileBuilder)
    profileBuilder.maybeSingle = vi.fn(() => Promise.resolve(overrides.profile ?? { data: null, error: null }))

    const splitsBuilder: Record<string, unknown> = {}
    splitsBuilder.insert = vi.fn(() => Promise.resolve(overrides.insert ?? { data: null, error: null }))

    const fromMock = vi.fn((table: string) => {
      if (table === 'expenses') return expenseBuilder
      if (table === 'profiles') return profileBuilder
      return splitsBuilder
    })
    const rpcMock = vi.fn(() => Promise.resolve(overrides.attends ?? { data: false, error: null }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock, rpc: rpcMock }))
    return { expenseBuilder, profileBuilder, splitsBuilder, fromMock, rpcMock }
  }

  it('rejects an unauthenticated caller', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)
    const result = await addExpenseSplit(VALID_EXPENSE_ID, 'lucia')
    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('rejects an empty username without touching the database', async () => {
    const result = await addExpenseSplit(VALID_EXPENSE_ID, '   ')
    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('rejects when the caller is not the expense owner', async () => {
    setUpTables({ expense: { data: { id: VALID_EXPENSE_ID, user_id: 'someone-else', event_id: VALID_EVENT_ID }, error: null } })
    const result = await addExpenseSplit(VALID_EXPENSE_ID, 'lucia')
    expect(result).toEqual({ error: 'Sólo quien cargó el gasto puede compartirlo.' })
  })

  it('rejects an expense with no event_id', async () => {
    setUpTables({ expense: { data: { id: VALID_EXPENSE_ID, user_id: 'user-1', event_id: null }, error: null } })
    const result = await addExpenseSplit(VALID_EXPENSE_ID, 'lucia')
    expect(result).toEqual({ error: 'Sólo se pueden compartir gastos atados a un show.' })
  })

  it('rejects a username that does not exist', async () => {
    setUpTables({
      expense: { data: { id: VALID_EXPENSE_ID, user_id: 'user-1', event_id: VALID_EVENT_ID }, error: null },
      profile: { data: null, error: null },
    })
    const result = await addExpenseSplit(VALID_EXPENSE_ID, 'nadie')
    expect(result).toEqual({ error: 'No existe ningún usuario "nadie".' })
  })

  it('rejects sharing an expense with yourself', async () => {
    setUpTables({
      expense: { data: { id: VALID_EXPENSE_ID, user_id: 'user-1', event_id: VALID_EVENT_ID }, error: null },
      profile: { data: { id: 'user-1' }, error: null },
    })
    const result = await addExpenseSplit(VALID_EXPENSE_ID, 'yo-mismo')
    expect(result).toEqual({ error: 'No podés compartir un gasto con vos mismo.' })
  })

  it('rejects a user without attendance on the same event', async () => {
    const { rpcMock } = setUpTables({
      expense: { data: { id: VALID_EXPENSE_ID, user_id: 'user-1', event_id: VALID_EVENT_ID }, error: null },
      profile: { data: { id: 'user-2' }, error: null },
      attends: { data: false, error: null },
    })
    const result = await addExpenseSplit(VALID_EXPENSE_ID, 'lucia')
    expect(result).toEqual({ error: '"lucia" no tiene marcada su asistencia a este show.' })
    expect(rpcMock).toHaveBeenCalledWith('user_attends_event', {
      check_event_id: VALID_EVENT_ID,
      check_user_id: 'user-2',
    })
  })

  it(
    'adds the split when every check passes, returning the real resolved user_id/username ' +
      '(not the typed username — the lookup is case-insensitive, so they can differ)',
    async () => {
      const { splitsBuilder } = setUpTables({
        expense: { data: { id: VALID_EXPENSE_ID, user_id: 'user-1', event_id: VALID_EVENT_ID }, error: null },
        profile: { data: { id: 'user-2', username: 'Lucia' }, error: null },
        attends: { data: true, error: null },
        insert: { data: null, error: null },
      })

      const result = await addExpenseSplit(VALID_EXPENSE_ID, 'lucia')

      expect(splitsBuilder.insert).toHaveBeenCalledWith({ expense_id: VALID_EXPENSE_ID, user_id: 'user-2' })
      expect(result).toEqual({ userId: 'user-2', username: 'Lucia' })
    }
  )

  it('maps a duplicate split (23505) to a friendly message', async () => {
    setUpTables({
      expense: { data: { id: VALID_EXPENSE_ID, user_id: 'user-1', event_id: VALID_EVENT_ID }, error: null },
      profile: { data: { id: 'user-2' }, error: null },
      attends: { data: true, error: null },
      insert: { data: null, error: { code: '23505', message: 'duplicate key' } },
    })

    const result = await addExpenseSplit(VALID_EXPENSE_ID, 'lucia')

    expect(result).toEqual({ error: 'Ya está compartido con "lucia".' })
  })
})

describe('removeExpenseSplit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  function makeDeleteBuilder(result: { data: unknown; error: unknown }) {
    const builder: Record<string, unknown> = {}
    const chain = () => builder
    builder.delete = vi.fn(chain)
    builder.eq = vi.fn(chain)
    builder.select = vi.fn(() => Promise.resolve(result))
    return builder
  }

  it('rejects an unauthenticated caller', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)
    const result = await removeExpenseSplit(VALID_EXPENSE_ID, 'user-2')
    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('succeeds when RLS allows the delete (caller owns the expense)', async () => {
    const builder = makeDeleteBuilder({ data: [{ id: 'split-1' }], error: null })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    const result = await removeExpenseSplit(VALID_EXPENSE_ID, 'user-2')

    expect(builder.eq).toHaveBeenCalledWith('expense_id', VALID_EXPENSE_ID)
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-2')
    expect(result).toEqual({})
  })

  it('reports an error when RLS silently blocks the delete (0 rows affected, no error)', async () => {
    const builder = makeDeleteBuilder({ data: [], error: null })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    const result = await removeExpenseSplit(VALID_EXPENSE_ID, 'user-2')

    expect(result).toEqual({ error: 'No se pudo sacar el gasto compartido.' })
  })
})
