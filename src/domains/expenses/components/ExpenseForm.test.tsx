// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Expense, EventWithRelations } from '@/src/core/types'

const push = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push }),
}))

// Las escrituras dejaron de llegar por prop: el form dispara las mutations
// directo, así que el doble se engancha en useMutation y se enruta por el
// nombre de la operación.
const createExpenseMock = vi.fn()
const updateExpenseMock = vi.fn()

vi.mock('urql', async () => {
  const actual = await vi.importActual<typeof import('urql')>('urql')
  return {
    ...actual,
    useMutation: (doc: { definitions?: Array<{ name?: { value?: string } }> }) =>
      doc.definitions?.[0]?.name?.value === 'CreateExpense'
        ? [{ fetching: false }, createExpenseMock]
        : [{ fetching: false }, updateExpenseMock],
  }
})

import { ExpenseForm } from '@/src/domains/expenses/components/ExpenseForm'

const events = [{ id: 'e1', name: 'Show en Niceto', date: '2024-05-01' }] as EventWithRelations[]

describe('ExpenseForm — create mode', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    createExpenseMock.mockResolvedValue({ data: { createExpense: { id: 'x-new' } } })
  })

  it('submits the entered fields, mapping blank optionals to undefined', async () => {
    render(<ExpenseForm events={events} />)

    await userEvent.type(screen.getByLabelText(/Monto/), '1500')
    await userEvent.selectOptions(screen.getByLabelText(/Categoría/), 'Entrada')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar gasto' }))

    await waitFor(() => {
      expect(createExpenseMock).toHaveBeenCalledWith({
        input: expect.objectContaining({
          amount: 1500,
          category: 'Entrada',
          note: undefined,
          eventId: undefined,
        }),
      })
    })
  })

  it('links the expense to the selected event', async () => {
    render(<ExpenseForm events={events} />)

    await userEvent.type(screen.getByLabelText(/Monto/), '1500')
    await userEvent.selectOptions(screen.getByLabelText(/Categoría/), 'Entrada')
    await userEvent.selectOptions(screen.getByLabelText(/Recital asociado/), 'e1')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar gasto' }))

    await waitFor(() => {
      expect(createExpenseMock).toHaveBeenCalledWith({
        input: expect.objectContaining({ eventId: 'e1' }),
      })
    })
  })

  it('sends the date field, defaulted to today when the user leaves it alone', async () => {
    render(<ExpenseForm events={events} />)

    await userEvent.type(screen.getByLabelText(/Monto/), '1500')
    await userEvent.selectOptions(screen.getByLabelText(/Categoría/), 'Entrada')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar gasto' }))

    await waitFor(() => {
      const { input } = createExpenseMock.mock.calls[0][0]
      expect(input.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    })
  })

  // Sustituye al `redirect('/expenses')` que hacía la Server Action antes de
  // la migración a GraphQL: ahora navega el cliente.
  it('navigates to the expenses list once creation succeeds', async () => {
    render(<ExpenseForm events={events} />)

    await userEvent.type(screen.getByLabelText(/Monto/), '1500')
    await userEvent.selectOptions(screen.getByLabelText(/Categoría/), 'Entrada')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar gasto' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/expenses'))
  })

  it('shows the error and re-enables the form when creation fails', async () => {
    createExpenseMock.mockResolvedValue({
      data: { createExpense: { error: 'El monto debe ser mayor a 0.' } },
    })
    render(<ExpenseForm events={events} />)

    await userEvent.type(screen.getByLabelText(/Monto/), '1500')
    await userEvent.selectOptions(screen.getByLabelText(/Categoría/), 'Entrada')
    await userEvent.click(screen.getByRole('button', { name: 'Agregar gasto' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('El monto debe ser mayor a 0.')
    })
    expect(screen.getByRole('button', { name: 'Agregar gasto' })).toBeEnabled()
    expect(push).not.toHaveBeenCalled()
  })

  it('links "Cancelar" to the expenses list', () => {
    render(<ExpenseForm events={events} />)
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

  beforeEach(() => {
    vi.clearAllMocks()
    updateExpenseMock.mockResolvedValue({ data: { updateExpense: {} } })
  })

  it('pre-fills the form fields from the existing expense', () => {
    render(<ExpenseForm events={events} expense={expense} />)

    expect(screen.getByLabelText(/Monto/)).toHaveValue(2000)
    expect(screen.getByLabelText('Nota')).toHaveValue('Cena post-show')
    expect(screen.getByLabelText(/Categoría/)).toHaveValue('Comida y bebida')
    expect(screen.getByLabelText(/Recital asociado/)).toHaveValue('e1')
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeInTheDocument()
  })

  it('calls the update mutation with the expense id on submit', async () => {
    render(<ExpenseForm events={events} expense={expense} />)

    await userEvent.clear(screen.getByLabelText(/Monto/))
    await userEvent.type(screen.getByLabelText(/Monto/), '2500')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => {
      expect(updateExpenseMock).toHaveBeenCalledWith({
        id: 'x1',
        input: expect.objectContaining({ amount: 2500 }),
      })
    })
    expect(createExpenseMock).not.toHaveBeenCalled()
  })

  // Sustituye al `redirect('/expenses/x1')` de la Server Action de edición.
  it('navigates to the expense detail once the update succeeds', async () => {
    render(<ExpenseForm events={events} expense={expense} />)

    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => expect(push).toHaveBeenCalledWith('/expenses/x1'))
  })

  it('shows the error and re-enables the form when the update fails', async () => {
    updateExpenseMock.mockResolvedValue({
      data: { updateExpense: { error: 'Gasto inválido.' } },
    })
    render(<ExpenseForm events={events} expense={expense} />)

    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Gasto inválido.')
    })
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled()
    expect(push).not.toHaveBeenCalled()
  })

  it('links "Cancelar" to the expense detail page', () => {
    render(<ExpenseForm events={events} expense={expense} />)
    expect(screen.getByRole('link', { name: 'Cancelar' })).toHaveAttribute('href', '/expenses/x1')
  })

  // El detalle y el editor leen la fila por GraphQL, que expone `eventId`;
  // el resto de la app todavía pasa la fila snake_case de Supabase. El form
  // tiene que pre-seleccionar el recital en los dos casos.
  it('pre-selects the linked event when the row came from GraphQL (camelCase eventId)', () => {
    const graphQLExpense = {
      id: 'x1',
      amount: 2000,
      category: 'Entrada',
      note: null,
      date: '2024-05-01',
      eventId: 'e1',
    } as unknown as Expense
    render(<ExpenseForm events={events} expense={graphQLExpense} />)

    expect(screen.getByLabelText(/Recital asociado/)).toHaveValue('e1')
  })
})
