// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Expense } from '@/src/core/types'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

const deleteExpenseMock = vi.fn()
vi.mock('urql', async () => {
  const actual = await vi.importActual<typeof import('urql')>('urql')
  return { ...actual, useMutation: () => [{ fetching: false }, deleteExpenseMock] }
})

import { DeleteExpenseAction } from '@/src/domains/expenses/components/DeleteExpenseAction'

const expense = { id: 'x1', amount: 1500, category: 'Entrada' } as Expense

/**
 * The expense detail page's delete used to be a Server Action that ended in
 * `redirect('/expenses')`. After the GraphQL migration (#44) the mutation
 * returns to the client and this wrapper does the navigating, so the
 * redirect assertion the deleted actions.test.ts carried lives here now.
 */
describe('DeleteExpenseAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    deleteExpenseMock.mockResolvedValue({ data: { deleteExpense: {} } })
  })

  it('fires the delete mutation with the expense id and returns to the list on success', async () => {
    render(<DeleteExpenseAction expense={expense} />)

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar gasto' }))
    await userEvent.click(screen.getByRole('button', { name: /Sí, eliminar/ }))

    await waitFor(() => {
      expect(deleteExpenseMock).toHaveBeenCalledWith({ id: 'x1' })
    })
    await waitFor(() => expect(push).toHaveBeenCalledWith('/expenses'))
  })

  it('surfaces the error and stays on the page when the deletion is rejected', async () => {
    deleteExpenseMock.mockResolvedValue({
      data: { deleteExpense: { error: 'No tenés permiso para realizar esta acción.' } },
    })
    render(<DeleteExpenseAction expense={expense} />)

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar gasto' }))
    await userEvent.click(screen.getByRole('button', { name: /Sí, eliminar/ }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('No tenés permiso para realizar esta acción.')
    })
    expect(push).not.toHaveBeenCalled()
  })

  it('does not fire the mutation until the confirmation is accepted', async () => {
    render(<DeleteExpenseAction expense={expense} />)

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar gasto' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(deleteExpenseMock).not.toHaveBeenCalled()
    expect(push).not.toHaveBeenCalled()
  })
})
