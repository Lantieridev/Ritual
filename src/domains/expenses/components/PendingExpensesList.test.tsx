// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IDBFactory } from 'fake-indexeddb'
import { enqueue, markFailed, listEntries } from '@/src/domains/expenses/offline/outbox'
import { setOutboxOwner } from '@/src/domains/expenses/offline/outbox-owner'

const createExpenseMock = vi.fn()
vi.mock('urql', async () => {
  const actual = await vi.importActual<typeof import('urql')>('urql')
  return { ...actual, useMutation: () => [{ fetching: false }, createExpenseMock] }
})

import { PendingExpensesList } from './PendingExpensesList'

const payload = { amount: 1500, category: 'Entrada', date: '2024-01-01', note: 'Uber' }
const OWNER = 'user-1'

beforeEach(() => {
  vi.clearAllMocks()
  globalThis.indexedDB = new IDBFactory()
  setOutboxOwner(OWNER)
})

describe('PendingExpensesList', () => {
  it('renders nothing when the outbox is empty', async () => {
    const { container } = render(<PendingExpensesList />)
    await waitFor(() => expect(container).toBeEmptyDOMElement())
  })

  it('shows a pending entry as "Pendiente de sincronizar"', async () => {
    await enqueue(payload, OWNER)

    render(<PendingExpensesList />)

    expect(await screen.findByText('Pendiente de sincronizar')).toBeInTheDocument()
    expect(screen.getByText(/Uber/)).toBeInTheDocument()
  })

  it('shows a failed entry with its reason and lets the user discard it', async () => {
    const entry = await enqueue(payload, OWNER)
    await markFailed(entry.clientId, 'El monto debe ser mayor a 0.')

    render(<PendingExpensesList />)

    expect(await screen.findByText(/El monto debe ser mayor a 0\./)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Descartar' }))

    await waitFor(async () => expect(await listEntries(OWNER)).toEqual([]))
  })

  it('retries a failed entry: requeues it and flushes', async () => {
    createExpenseMock.mockResolvedValue({ data: { createExpense: { id: 'srv-1' } } })
    const entry = await enqueue(payload, OWNER)
    await markFailed(entry.clientId, 'boom')

    render(<PendingExpensesList />)
    await userEvent.click(await screen.findByRole('button', { name: 'Reintentar' }))

    await waitFor(async () => expect(await listEntries(OWNER)).toEqual([]))
    expect(createExpenseMock).toHaveBeenCalledTimes(1)
  })

  it('only shows entries for the given event', async () => {
    await enqueue({ ...payload, eventId: 'e1', note: 'aqui' }, OWNER)
    await enqueue({ ...payload, eventId: 'e2', note: 'otro' }, OWNER)

    render(<PendingExpensesList eventId="e1" />)

    expect(await screen.findByText(/aqui/)).toBeInTheDocument()
    expect(screen.queryByText(/otro/)).not.toBeInTheDocument()
  })

  it('never shows entries queued by a different user on this device', async () => {
    await enqueue({ ...payload, note: 'ajeno' }, 'user-2')

    const { container } = render(<PendingExpensesList />)

    await waitFor(() => expect(container).toBeEmptyDOMElement())
    expect(screen.queryByText(/ajeno/)).not.toBeInTheDocument()
  })
})
