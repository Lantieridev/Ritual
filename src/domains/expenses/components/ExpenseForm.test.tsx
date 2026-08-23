// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExpenseForm } from '@/src/domains/expenses/components/ExpenseForm'
import type { Expense, EventWithRelations } from '@/src/core/types'

const events = [
  { id: 'e1', name: 'Show en Niceto', date: '2024-05-01' },
] as EventWithRelations[]

describe('ExpenseForm — create mode', () => {
  it('submits the entered fields, mapping blank optionals to undefined', async () => {
    const createExpense = vi.fn().mockResolvedValue({})
    render(<ExpenseForm events={events} createExpense={createExpense} />)

    await userEvent.type(screen.getByLabelText(/Monto/), '1500')
    await userEvent.selectOptions(screen.getByLabelText(/Categoría/), 'Entrada')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar gasto' }))

    await waitFor(() => {
      expect(createExpense).toHaveBeenCalledWith(
        expect.objectContaining({ amount: 1500, category: 'Entrada', note: undefined, event_id: undefined })
      )
    })
  })

  it('links the expense to the selected event', async () => {
    const createExpense = vi.fn().mockResolvedValue({})
    render(<ExpenseForm events={events} createExpense={createExpense} />)

    await userEvent.type(screen.getByLabelText(/Monto/), '1500')
    await userEvent.selectOptions(screen.getByLabelText(/Categoría/), 'Entrada')
    await userEvent.selectOptions(screen.getByLabelText(/Recital asociado/), 'e1')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar gasto' }))

    await waitFor(() => {
      expect(createExpense).toHaveBeenCalledWith(expect.objectContaining({ event_id: 'e1' }))
    })
  })

  it('shows the error and re-enables the form when creation fails', async () => {
    const createExpense = vi.fn().mockResolvedValue({ error: 'El monto debe ser mayor a 0.' })
    render(<ExpenseForm events={events} createExpense={createExpense} />)

    await userEvent.type(screen.getByLabelText(/Monto/), '1500')
    await userEvent.selectOptions(screen.getByLabelText(/Categoría/), 'Entrada')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar gasto' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('El monto debe ser mayor a 0.')
    })
    expect(screen.getByRole('button', { name: 'Agregar gasto' })).toBeEnabled()
  })

  it('links "Cancelar" to the expenses list', () => {
    render(<ExpenseForm events={events} createExpense={vi.fn()} />)
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '/expenses')
  })
})

describe('ExpenseForm — edit mode', () => {
  const expense = {
    id: 'x1',
    amount: 2000,
    category: 'Comida y bebida',
    note: 'Cena post-show',
    date: '2024-05-01',
    event_id: 'e1',
  } as Expense

  it('pre-fills the form fields from the existing expense', () => {
    render(<ExpenseForm events={events} expense={expense} updateExpense={vi.fn()} />)

    expect(screen.getByLabelText(/Monto/)).toHaveValue(2000)
    expect(screen.getByLabelText('Nota')).toHaveValue('Cena post-show')
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument()
  })

  it('calls updateExpense with the expense id on submit', async () => {
    const updateExpense = vi.fn().mockResolvedValue({})
    render(<ExpenseForm events={events} expense={expense} updateExpense={updateExpense} />)

    await userEvent.clear(screen.getByLabelText(/Monto/))
    await userEvent.type(screen.getByLabelText(/Monto/), '2500')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => {
      expect(updateExpense).toHaveBeenCalledWith('x1', expect.objectContaining({ amount: 2500 }))
    })
  })

  it('links "Cancelar" to the expense detail page', () => {
    render(<ExpenseForm events={events} expense={expense} updateExpense={vi.fn()} />)
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '/expenses/x1')
  })
})
