// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { IDBFactory } from 'fake-indexeddb'
import { listEntries } from './outbox'
import { setOutboxOwner } from './outbox-owner'
import { transportError } from '@/src/graphql/transport-failure.testing'
import { EXPENSES_AUTH_REQUIRED_MESSAGE } from '@/src/domains/expenses/messages'

const createExpenseMock = vi.fn()
vi.mock('urql', async () => {
  const actual = await vi.importActual<typeof import('urql')>('urql')
  return { ...actual, useMutation: () => [{ fetching: false }, createExpenseMock] }
})

import { useCreateExpense } from './use-create-expense'

const payload = { amount: 100, category: 'Entrada', date: '2024-01-01' }
const OWNER = 'user-1'

beforeEach(() => {
  vi.clearAllMocks()
  globalThis.indexedDB = new IDBFactory()
  setOutboxOwner(OWNER)
})

describe('useCreateExpense', () => {
  it('returns synced and leaves the outbox empty when the server accepts it', async () => {
    createExpenseMock.mockResolvedValue({ data: { createExpense: { id: 'srv-1' } } })
    const { result } = renderHook(() => useCreateExpense())

    const outcome = await result.current(payload)

    expect(outcome).toEqual({ status: 'synced', id: 'srv-1' })
    expect(await listEntries(OWNER)).toEqual([])
  })

  it('sends a clientId and writes to the outbox before the network call', async () => {
    let entriesAtSendTime = 0
    createExpenseMock.mockImplementation(async () => {
      entriesAtSendTime = (await listEntries(OWNER)).length
      return { data: { createExpense: { id: 'srv-1' } } }
    })
    const { result } = renderHook(() => useCreateExpense())

    await result.current(payload)

    expect(entriesAtSendTime).toBe(1)
    expect(createExpenseMock).toHaveBeenCalledWith({
      input: expect.objectContaining({ amount: 100, clientId: expect.any(String) }),
    })
  })

  it('queues the expense when the network is down', async () => {
    createExpenseMock.mockResolvedValue({ data: undefined, error: transportError() })
    const { result } = renderHook(() => useCreateExpense())

    const outcome = await result.current(payload)

    expect(outcome).toMatchObject({ status: 'queued' })
    const [entry] = await listEntries(OWNER)
    expect(entry.status).toBe('pending')
    expect(entry.payload).toEqual(payload)
  })

  it('queues the expense when the session expired', async () => {
    createExpenseMock.mockResolvedValue({ data: { createExpense: { error: EXPENSES_AUTH_REQUIRED_MESSAGE } } })
    const { result } = renderHook(() => useCreateExpense())

    const outcome = await result.current(payload)

    expect(outcome).toMatchObject({ status: 'queued' })
    expect(await listEntries(OWNER)).toHaveLength(1)
  })

  it('returns rejected and does not keep the entry when the server refuses it', async () => {
    createExpenseMock.mockResolvedValue({ data: { createExpense: { error: 'El monto debe ser mayor a 0.' } } })
    const { result } = renderHook(() => useCreateExpense())

    const outcome = await result.current(payload)

    expect(outcome).toEqual({ status: 'rejected', error: 'El monto debe ser mayor a 0.' })
    expect(await listEntries(OWNER)).toEqual([])
  })

  it('does not queue when no user is known, so it cannot leak into a later session', async () => {
    setOutboxOwner(null)
    createExpenseMock.mockResolvedValue({ data: undefined, error: transportError() })
    const { result } = renderHook(() => useCreateExpense())

    const outcome = await result.current(payload)

    expect(outcome).toMatchObject({ status: 'rejected' })
    expect(await listEntries(OWNER)).toEqual([])
  })

  it('stamps the queued entry with the current owner', async () => {
    createExpenseMock.mockResolvedValue({ data: undefined, error: transportError() })
    const { result } = renderHook(() => useCreateExpense())

    await result.current(payload)

    expect((await listEntries(OWNER))[0].ownerId).toBe(OWNER)
  })

  it('still attempts the request when IndexedDB is unavailable', async () => {
    // Simulates storage being blocked (e.g. some private modes).
    // @ts-expect-error deliberately breaking the global
    globalThis.indexedDB = { open: () => { throw new Error('blocked') } }
    createExpenseMock.mockResolvedValue({ data: { createExpense: { id: 'srv-9' } } })
    const { result } = renderHook(() => useCreateExpense())

    expect(await result.current(payload)).toEqual({ status: 'synced', id: 'srv-9' })
  })

  it('reports a transport error as rejected when it cannot be stored either', async () => {
    // @ts-expect-error deliberately breaking the global
    globalThis.indexedDB = { open: () => { throw new Error('blocked') } }
    createExpenseMock.mockResolvedValue({ data: undefined, error: transportError() })
    const { result } = renderHook(() => useCreateExpense())

    expect(await result.current(payload)).toMatchObject({ status: 'rejected' })
  })
})
