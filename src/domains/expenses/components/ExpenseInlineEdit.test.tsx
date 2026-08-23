// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExpenseInlineEdit } from '@/src/domains/expenses/components/ExpenseInlineEdit'
import type { Expense } from '@/src/core/types'

const expense: Expense = {
  id: 'x1',
  user_id: 'u1',
  amount: 2000,
  category: 'Entrada',
  note: 'Cena post-show',
  event_id: 'ev-1',
  date: '2026-05-01',
}

describe('ExpenseInlineEdit', () => {
  it('pre-fills amount, category and note from the given expense', () => {
    render(<ExpenseInlineEdit expense={expense} modifyExpense={vi.fn()} onSaved={vi.fn()} onCancel={vi.fn()} />)

    expect(screen.getByLabelText('Monto')).toHaveValue(2000)
    expect(screen.getByLabelText('Categoría')).toHaveValue('Entrada')
    expect(screen.getByLabelText('Nota')).toHaveValue('Cena post-show')
  })

  it('calls modifyExpense with the expense id, never redirecting anywhere', async () => {
    const modifyExpense = vi.fn().mockResolvedValue({})
    render(<ExpenseInlineEdit expense={expense} modifyExpense={modifyExpense} onSaved={vi.fn()} onCancel={vi.fn()} />)

    await userEvent.clear(screen.getByLabelText('Monto'))
    await userEvent.type(screen.getByLabelText('Monto'), '2500')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => {
      expect(modifyExpense).toHaveBeenCalledWith('x1', { amount: 2500, category: 'Entrada', note: 'Cena post-show' })
    })
  })

  it('calls onSaved with the updated expense on success', async () => {
    const modifyExpense = vi.fn().mockResolvedValue({})
    const onSaved = vi.fn()
    render(<ExpenseInlineEdit expense={expense} modifyExpense={modifyExpense} onSaved={onSaved} onCancel={vi.fn()} />)

    await userEvent.selectOptions(screen.getByLabelText('Categoría'), 'Merch')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => {
      expect(onSaved).toHaveBeenCalledWith(expect.objectContaining({ id: 'x1', category: 'Merch' }))
    })
  })

  it('shows the error and does not call onSaved when the update fails', async () => {
    const modifyExpense = vi.fn().mockResolvedValue({ error: 'El monto debe ser mayor a 0.' })
    const onSaved = vi.fn()
    render(<ExpenseInlineEdit expense={expense} modifyExpense={modifyExpense} onSaved={onSaved} onCancel={vi.fn()} />)

    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('El monto debe ser mayor a 0.')
    })
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('calls onCancel when "Cancelar" is clicked', async () => {
    const onCancel = vi.fn()
    render(<ExpenseInlineEdit expense={expense} modifyExpense={vi.fn()} onSaved={vi.fn()} onCancel={onCancel} />)

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
