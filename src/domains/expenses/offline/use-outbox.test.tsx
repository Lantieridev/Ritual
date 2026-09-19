// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor, act } from '@testing-library/react'
import { IDBFactory } from 'fake-indexeddb'
import { enqueue, removeEntry } from './outbox'
import { setOutboxOwner } from './outbox-owner'

const createExpenseMock = vi.fn()
vi.mock('urql', async () => {
  const actual = await vi.importActual<typeof import('urql')>('urql')
  return { ...actual, useMutation: () => [{ fetching: false }, createExpenseMock] }
})

import { usePendingExpenses, useOutboxFlush } from './use-outbox'

const payload = { amount: 100, category: 'Entrada', date: '2024-01-01' }
const OWNER = 'user-1'

beforeEach(() => {
  vi.clearAllMocks()
  globalThis.indexedDB = new IDBFactory()
  setOutboxOwner(OWNER)
})

describe('usePendingExpenses', () => {
  it('lists entries and refreshes when the outbox changes', async () => {
    const { result } = renderHook(() => usePendingExpenses())
    await waitFor(() => expect(result.current).toEqual([]))

    let entry!: Awaited<ReturnType<typeof enqueue>>
    await act(async () => {
      entry = await enqueue(payload, OWNER)
    })
    await waitFor(() => expect(result.current).toHaveLength(1))

    await act(async () => {
      await removeEntry(entry.clientId)
    })
    await waitFor(() => expect(result.current).toEqual([]))
  })

  it('filters by eventId when given', async () => {
    await enqueue({ ...payload, eventId: 'e1' }, OWNER)
    await enqueue({ ...payload, eventId: 'e2' }, OWNER)
    await enqueue(payload, OWNER)

    const { result } = renderHook(() => usePendingExpenses('e1'))

    await waitFor(() => expect(result.current).toHaveLength(1))
    expect(result.current[0].payload.eventId).toBe('e1')
  })

  it('shows only the current owner entries, and re-reads when the owner changes', async () => {
    await enqueue({ ...payload, note: 'mine' }, OWNER)
    await enqueue({ ...payload, note: 'theirs' }, 'user-2')

    const { result } = renderHook(() => usePendingExpenses())
    await waitFor(() => expect(result.current).toHaveLength(1))
    expect(result.current[0].payload.note).toBe('mine')

    act(() => setOutboxOwner('user-2'))
    await waitFor(() => expect(result.current[0]?.payload.note).toBe('theirs'))

    act(() => setOutboxOwner(null))
    await waitFor(() => expect(result.current).toEqual([]))
  })
})

describe('useOutboxFlush', () => {
  it('flushes the outbox through the CreateExpense mutation', async () => {
    createExpenseMock.mockResolvedValue({ data: { createExpense: { id: 'srv-1' } } })
    await enqueue(payload, OWNER)
    const { result } = renderHook(() => useOutboxFlush())

    const summary = await result.current()

    expect(summary).toMatchObject({ synced: 1, remaining: 0 })
  })

  it('does nothing when no user is known', async () => {
    await enqueue(payload, OWNER)
    setOutboxOwner(null)
    const { result } = renderHook(() => useOutboxFlush())

    const summary = await result.current()

    expect(summary).toMatchObject({ synced: 0, skipped: true })
    expect(createExpenseMock).not.toHaveBeenCalled()
  })
})
