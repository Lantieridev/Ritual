import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()
const mockRedirect = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn(),
}))

vi.mock('next/navigation', () => ({
  redirect: (...args: unknown[]) => mockRedirect(...args),
}))

import { createExpense, updateExpense, deleteExpense, insertExpense, modifyExpense, removeExpense } from '@/src/domains/expenses/actions'
import { getCurrentUserId } from '@/src/core/auth/session'

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

describe('createExpense', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  it('requires a logged-in user', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)
    const result = await createExpense({ amount: 100, category: 'Entrada', date: '2024-01-01' } as never)
    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('rejects a zero or negative amount', async () => {
    const zero = await createExpense({ amount: 0, category: 'Entrada', date: '2024-01-01' } as never)
    expect(zero.error).toBeTruthy()

    const negative = await createExpense({ amount: -5, category: 'Entrada', date: '2024-01-01' } as never)
    expect(negative.error).toBeTruthy()
  })

  it('rejects an amount over the sanity cap', async () => {
    const result = await createExpense({ amount: 20_000_000, category: 'Entrada', date: '2024-01-01' } as never)
    expect(result.error).toBeTruthy()
  })

  it('rejects a missing category', async () => {
    const result = await createExpense({ amount: 100, category: '  ', date: '2024-01-01' } as never)
    expect(result.error).toBeTruthy()
  })

  it('rejects a missing or unparseable date', async () => {
    const missing = await createExpense({ amount: 100, category: 'Entrada', date: '' } as never)
    expect(missing.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()

    const bad = await createExpense({ amount: 100, category: 'Entrada', date: 'not-a-date' } as never)
    expect(bad.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('rejects an invalid event_id when provided', async () => {
    const result = await createExpense({
      amount: 100,
      category: 'Entrada',
      date: '2024-01-01',
      event_id: 'not-a-uuid',
    } as never)
    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('inserts scoped to the current user and redirects to the list', async () => {
    const builder = makeQueryBuilder({ data: { id: 'expense-1' }, error: null })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    await createExpense({
      amount: 150,
      category: '  Entrada  ',
      note: '  Con descuento  ',
      date: '2024-01-01',
      event_id: VALID_EVENT_ID,
    } as never)

    expect(builder.insert).toHaveBeenCalledWith({
      user_id: 'user-1',
      amount: 150,
      category: 'Entrada',
      note: 'Con descuento',
      event_id: VALID_EVENT_ID,
      date: '2024-01-01',
    })
    expect(mockRedirect).toHaveBeenCalledWith('/expenses')
  })

  it('returns a sanitized error when the insert fails', async () => {
    const builder = makeQueryBuilder({ data: null, error: { message: 'boom' } })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    const result = await createExpense({ amount: 100, category: 'Entrada', date: '2024-01-01' } as never)

    expect(result.error).toBeTruthy()
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})

describe('updateExpense', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  it('requires a logged-in user', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)
    const result = await updateExpense(VALID_EXPENSE_ID, {})
    expect(result.error).toBeTruthy()
  })

  it('rejects an invalid expense id', async () => {
    const result = await updateExpense('not-a-uuid', {})
    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('rejects an invalid amount when provided', async () => {
    const result = await updateExpense(VALID_EXPENSE_ID, { amount: -1 })
    expect(result.error).toBeTruthy()
  })

  it('rejects an unparseable date when provided, without touching the client', async () => {
    const result = await updateExpense(VALID_EXPENSE_ID, { date: 'not-a-date' })
    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('no-ops without touching the client when nothing was actually provided', async () => {
    const result = await updateExpense(VALID_EXPENSE_ID, {})
    expect(result).toEqual({})
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it(
    'scopes the update to both the expense id and the owning user_id ' +
      '(defense in depth against updating someone else\'s expense)',
    async () => {
      const builder = makeQueryBuilder({ data: null, error: null })
      mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

      await updateExpense(VALID_EXPENSE_ID, { category: 'Comida' })

      expect(builder.update).toHaveBeenCalledWith({ category: 'Comida' })
      expect(builder.eq).toHaveBeenCalledWith('id', VALID_EXPENSE_ID)
      expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1')
      expect(mockRedirect).toHaveBeenCalledWith(`/expenses/${VALID_EXPENSE_ID}`)
    }
  )

  it('returns a sanitized error when the update fails', async () => {
    const builder = makeQueryBuilder({ data: null, error: { message: 'boom' } })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    const result = await updateExpense(VALID_EXPENSE_ID, { category: 'Comida' })

    expect(result.error).toBeTruthy()
  })
})

describe('deleteExpense', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  it('requires a logged-in user', async () => {
    vi.mocked(getCurrentUserId).mockResolvedValue(null)
    const result = await deleteExpense(VALID_EXPENSE_ID)
    expect(result.error).toBeTruthy()
  })

  it('rejects an invalid id', async () => {
    const result = await deleteExpense('not-a-uuid')
    expect(result.error).toBeTruthy()
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('scopes the delete to both the expense id and the owning user_id', async () => {
    const builder = makeQueryBuilder({ data: null, error: null })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    await deleteExpense(VALID_EXPENSE_ID)

    expect(builder.eq).toHaveBeenCalledWith('id', VALID_EXPENSE_ID)
    expect(builder.eq).toHaveBeenCalledWith('user_id', 'user-1')
    expect(mockRedirect).toHaveBeenCalledWith('/expenses')
  })

  it('returns a sanitized error when the delete fails', async () => {
    const builder = makeQueryBuilder({ data: null, error: { message: 'boom' } })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    const result = await deleteExpense(VALID_EXPENSE_ID)

    expect(result.error).toBeTruthy()
  })
})

describe('insertExpense / modifyExpense / removeExpense', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(getCurrentUserId).mockResolvedValue('user-1')
  })

  it('insertExpense returns the new id without redirecting', async () => {
    const builder = makeQueryBuilder({ data: { id: 'expense-1' }, error: null })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    const result = await insertExpense({ amount: 100, category: 'Entrada', date: '2024-01-01' } as never)

    expect(result).toEqual({ id: 'expense-1' })
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('modifyExpense updates without redirecting', async () => {
    const builder = makeQueryBuilder({ data: null, error: null })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    const result = await modifyExpense(VALID_EXPENSE_ID, { category: 'Comida' })

    expect(result).toEqual({})
    expect(mockRedirect).not.toHaveBeenCalled()
  })

  it('modifyExpense reports noChanges when nothing was actually provided, without touching the client', async () => {
    const result = await modifyExpense(VALID_EXPENSE_ID, {})

    expect(result).toEqual({ noChanges: true })
    expect(mockCreateClient).not.toHaveBeenCalled()
  })

  it('removeExpense deletes without redirecting', async () => {
    const builder = makeQueryBuilder({ data: null, error: null })
    mockCreateClient.mockReturnValue(Promise.resolve({ from: vi.fn(() => builder) }))

    const result = await removeExpense(VALID_EXPENSE_ID)

    expect(result).toEqual({})
    expect(mockRedirect).not.toHaveBeenCalled()
  })
})
