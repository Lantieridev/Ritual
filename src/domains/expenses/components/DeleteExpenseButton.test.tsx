// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DeleteExpenseButton } from '@/src/domains/expenses/components/DeleteExpenseButton'
import type { Expense } from '@/src/core/types'

const expense = { id: 'x1', amount: 1500, category: 'Entrada' } as Expense

describe('DeleteExpenseButton', () => {
  it('shows only the trigger button before confirming', () => {
    render(<DeleteExpenseButton expense={expense} deleteExpense={vi.fn()} />)
    expect(screen.getByRole('button', { name: 'Eliminar gasto' })).toBeInTheDocument()
  })

  it('shows the confirmation with the formatted amount and category', async () => {
    render(<DeleteExpenseButton expense={expense} deleteExpense={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar gasto' }))

    expect(screen.getByText(/1\.500/)).toBeInTheDocument()
    expect(screen.getByText(/Entrada/)).toBeInTheDocument()
  })

  it('cancels back without calling deleteExpense', async () => {
    const deleteExpense = vi.fn()
    render(<DeleteExpenseButton expense={expense} deleteExpense={deleteExpense} />)

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar gasto' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(screen.getByRole('button', { name: 'Eliminar gasto' })).toBeInTheDocument()
    expect(deleteExpense).not.toHaveBeenCalled()
  })

  it('calls deleteExpense with the expense id on confirm', async () => {
    const deleteExpense = vi.fn().mockResolvedValue({})
    render(<DeleteExpenseButton expense={expense} deleteExpense={deleteExpense} />)

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar gasto' }))
    await userEvent.click(screen.getByRole('button', { name: /Sí, eliminar/ }))

    expect(deleteExpense).toHaveBeenCalledWith('x1')
  })

  it('shows the error and stays in confirming state when deletion fails', async () => {
    const deleteExpense = vi.fn().mockResolvedValue({ error: 'No se pudo eliminar' })
    render(<DeleteExpenseButton expense={expense} deleteExpense={deleteExpense} />)

    await userEvent.click(screen.getByRole('button', { name: 'Eliminar gasto' }))
    await userEvent.click(screen.getByRole('button', { name: /Sí, eliminar/ }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('No se pudo eliminar')
    })
  })
})
