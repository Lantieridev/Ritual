// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ExpenseWithSplits } from '@/src/domains/expenses/components/EventExpensesPanel'

// El panel dejó de recibir las escrituras por prop: dispara las mutations
// de gastos directo, así que los dobles se enganchan en useMutation y se
// enrutan por el nombre de la operación.
const createExpenseMock = vi.fn()
const updateExpenseMock = vi.fn()
const deleteExpenseMock = vi.fn()
const addSplitMock = vi.fn()
const removeSplitMock = vi.fn()

vi.mock('urql', async () => {
  const actual = await vi.importActual<typeof import('urql')>('urql')
  return {
    ...actual,
    useMutation: (doc: { definitions?: Array<{ name?: { value?: string } }> }) => {
      const name = doc.definitions?.[0]?.name?.value
      if (name === 'CreateExpense') return [{ fetching: false }, createExpenseMock]
      if (name === 'UpdateExpense') return [{ fetching: false }, updateExpenseMock]
      if (name === 'AddExpenseSplit') return [{ fetching: false }, addSplitMock]
      if (name === 'RemoveExpenseSplit') return [{ fetching: false }, removeSplitMock]
      return [{ fetching: false }, deleteExpenseMock]
    },
  }
})

import { EventExpensesPanel } from '@/src/domains/expenses/components/EventExpensesPanel'
import { TRANSPORT_ERROR_MESSAGE } from '@/src/graphql/mutation-result'
import { transportError } from '@/src/graphql/transport-failure.testing'

const baseExpenses: ExpenseWithSplits[] = [
  { id: 'x1', user_id: 'u1', amount: 5000, category: 'Comida y bebida', note: null, event_id: 'ev-1', date: '2026-05-01', splits: [] },
  { id: 'x2', user_id: 'u1', amount: 3000, category: 'Comida y bebida', note: 'Birra', event_id: 'ev-1', date: '2026-05-01', splits: [] },
  { id: 'x3', user_id: 'u1', amount: 15000, category: 'Entrada', note: null, event_id: 'ev-1', date: '2026-05-01', splits: [] },
]

function renderPanel(overrides: Partial<React.ComponentProps<typeof EventExpensesPanel>> = {}) {
  return render(
    <EventExpensesPanel
      eventId="ev-1"
      initialExpenses={baseExpenses}
      defaultDate="2026-05-01"
      spendEstimate={null}
      detailHref="/events/ev-1/gastos"
      currentUserId="u1"
      {...overrides}
    />
  )
}

describe('EventExpensesPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows the total, item count and grouped categories ("Comida y bebida: $8.000 · 2 ítems")', () => {
    renderPanel()

    expect(screen.getByText('$23.000')).toBeInTheDocument()
    expect(screen.getByText(/3 ítems/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Comida y bebida: \$8\.000 · 2 ítems/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Entrada: \$15\.000 · 1 ítem$/ })).toBeInTheDocument()
  })

  it('shows the choripán comparison for the total', () => {
    renderPanel()
    // total 23000 / 5000 reference = 4.6 -> rounded to one decimal
    expect(screen.getByText(/esto son 4,6 choripanes/)).toBeInTheDocument()
  })

  it('shows an empty state and no groups when there are no expenses', () => {
    renderPanel({ initialExpenses: [] })
    expect(screen.getByText('Todavía no cargaste gastos para este show.')).toBeInTheDocument()
    expect(screen.getByText(/0 ítems/)).toBeInTheDocument()
  })

  it('links to the full breakdown view', () => {
    renderPanel()
    expect(screen.getByRole('link', { name: /Ver desglose completo/ })).toHaveAttribute('href', '/events/ev-1/gastos')
  })

  it('shows the soft suggestion as informational text, never as a warning, when given an estimate', () => {
    renderPanel({ spendEstimate: { averageTotal: 12000, eventsConsidered: 3 } })
    const hint = screen.getByText(/Sueles gastar un promedio de \$12\.000/)
    expect(hint).toHaveTextContent('solo de referencia, no un límite')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('renders no soft suggestion when there is no estimate', () => {
    renderPanel({ spendEstimate: null })
    expect(screen.queryByText(/Sueles gastar/)).not.toBeInTheDocument()
  })

  it('expands and collapses a category group on click, revealing individual expenses only while expanded', async () => {
    renderPanel()

    expect(screen.queryByText('Birra')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Comida y bebida: \$8\.000/ }))
    expect(screen.getByText('Birra')).toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: /Comida y bebida: \$8\.000/ }))
    expect(screen.queryByText('Birra')).not.toBeInTheDocument()
  })

  it('quick-add: toggling it in, adding an expense inserts it, updates the total and groups, and expands its category', async () => {
    createExpenseMock.mockResolvedValue({ data: { createExpense: { id: 'x4' } } })
    renderPanel()

    await userEvent.click(screen.getByRole('button', { name: '+ Cargar gasto' }))
    await userEvent.type(screen.getByLabelText('Monto'), '2000')
    await userEvent.selectOptions(screen.getByLabelText('Categoría'), 'Merch')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar gasto' }))

    await waitFor(() => {
      expect(createExpenseMock).toHaveBeenCalledWith({
        input: expect.objectContaining({ amount: 2000, category: 'Merch', eventId: 'ev-1', date: '2026-05-01' }),
      })
    })

    // Total grows from $23.000 to $25.000, and the new category shows up expanded.
    expect(screen.getByText('$25.000')).toBeInTheDocument()
    expect(screen.getByText(/4 ítems/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Merch: \$2\.000 · 1 ítem$/ })).toBeInTheDocument()
    // Quick-add form closes after a successful add.
    expect(screen.queryByRole('button', { name: 'Guardar gasto' })).not.toBeInTheDocument()
  })

  it('quick-add: a rejected insert leaves the total and the item count untouched', async () => {
    createExpenseMock.mockResolvedValue({
      data: { createExpense: { error: 'El monto debe ser mayor a 0.' } },
    })
    renderPanel()

    await userEvent.click(screen.getByRole('button', { name: '+ Cargar gasto' }))
    await userEvent.type(screen.getByLabelText('Monto'), '2000')
    await userEvent.selectOptions(screen.getByLabelText('Categoría'), 'Merch')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar gasto' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('El monto debe ser mayor a 0.')
    })
    expect(screen.getByText('$23.000')).toBeInTheDocument()
    expect(screen.getByText(/3 ítems/)).toBeInTheDocument()
  })

  it('quick-add: "Cancelar" hides the form without inserting anything', async () => {
    renderPanel()

    await userEvent.click(screen.getByRole('button', { name: '+ Cargar gasto' }))
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))

    expect(createExpenseMock).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: '+ Cargar gasto' })).toBeInTheDocument()
  })

  it('inline edit: editing an expense updates it in place without any navigation', async () => {
    updateExpenseMock.mockResolvedValue({ data: { updateExpense: {} } })
    renderPanel()

    await userEvent.click(screen.getByRole('button', { name: /Entrada: \$15\.000/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }))

    const amountInput = screen.getByLabelText('Monto')
    await userEvent.clear(amountInput)
    await userEvent.type(amountInput, '16000')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => {
      expect(updateExpenseMock).toHaveBeenCalledWith({
        id: 'x3',
        input: { amount: 16000, category: 'Entrada', note: '' },
      })
    })
    expect(screen.getByText('$24.000')).toBeInTheDocument() // new grand total
  })

  it('inline edit: a rejected update keeps the old amount and shows the error', async () => {
    updateExpenseMock.mockResolvedValue({
      data: { updateExpense: { error: 'El monto debe ser mayor a 0.' } },
    })
    renderPanel()

    await userEvent.click(screen.getByRole('button', { name: /Entrada: \$15\.000/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Editar' }))
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('El monto debe ser mayor a 0.')
    })
    expect(screen.getByText('$23.000')).toBeInTheDocument()
  })

  it('inline delete: confirming removal takes the expense out of its group and out of the total', async () => {
    deleteExpenseMock.mockResolvedValue({ data: { deleteExpense: {} } })
    renderPanel()

    await userEvent.click(screen.getByRole('button', { name: /Entrada: \$15\.000/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar gasto' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sí, eliminar' }))

    await waitFor(() => {
      expect(deleteExpenseMock).toHaveBeenCalledWith({ id: 'x3' })
    })
    expect(screen.getByText('$8.000')).toBeInTheDocument()
    expect(screen.queryByText(/Entrada:/)).not.toBeInTheDocument()
  })

  it('inline delete: a failed removal keeps the expense and shows the error', async () => {
    deleteExpenseMock.mockResolvedValue({
      data: { deleteExpense: { error: 'No se pudo eliminar.' } },
    })
    renderPanel()

    await userEvent.click(screen.getByRole('button', { name: /Entrada: \$15\.000/ }))
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar gasto' }))
    await userEvent.click(screen.getByRole('button', { name: 'Sí, eliminar' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('No se pudo eliminar.')
    })
    expect(screen.getByText('$23.000')).toBeInTheDocument()
  })

  /**
   * Cuando la request no llega al resolver (red caída, 500, GraphQL inválido)
   * urql resuelve con `data: undefined` y `error` seteado. Mirar solo
   * `data.x.error` leía eso como éxito y aplicaba el cambio optimista sobre
   * algo que el servidor nunca guardó.
   */
  describe('transport failures (data undefined, result.error set)', () => {
    it('quick-add: does not add the expense and surfaces an error', async () => {
      createExpenseMock.mockResolvedValue({ data: undefined, error: transportError() })
      renderPanel()

      await userEvent.click(screen.getByRole('button', { name: '+ Cargar gasto' }))
      await userEvent.type(screen.getByLabelText('Monto'), '2000')
      await userEvent.selectOptions(screen.getByLabelText('Categoría'), 'Merch')
      await userEvent.click(screen.getByRole('button', { name: 'Guardar gasto' }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(TRANSPORT_ERROR_MESSAGE)
      })
      expect(screen.getByText('$23.000')).toBeInTheDocument()
      expect(screen.getByText(/3 ítems/)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /Merch:/ })).not.toBeInTheDocument()
    })

    it('inline edit: keeps the old amount and surfaces an error', async () => {
      updateExpenseMock.mockResolvedValue({ data: undefined, error: transportError() })
      renderPanel()

      await userEvent.click(screen.getByRole('button', { name: /Entrada: \$15\.000/ }))
      await userEvent.click(screen.getByRole('button', { name: 'Editar' }))
      const amountInput = screen.getByLabelText('Monto')
      await userEvent.clear(amountInput)
      await userEvent.type(amountInput, '16000')
      await userEvent.click(screen.getByRole('button', { name: 'Guardar' }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(TRANSPORT_ERROR_MESSAGE)
      })
      expect(screen.getByText('$23.000')).toBeInTheDocument()
      expect(screen.queryByText('$24.000')).not.toBeInTheDocument()
    })

    it('inline delete: keeps the expense in the list and surfaces an error', async () => {
      deleteExpenseMock.mockResolvedValue({ data: undefined, error: transportError() })
      renderPanel()

      await userEvent.click(screen.getByRole('button', { name: /Entrada: \$15\.000/ }))
      await userEvent.click(screen.getByRole('button', { name: 'Eliminar gasto' }))
      await userEvent.click(screen.getByRole('button', { name: 'Sí, eliminar' }))

      await waitFor(() => {
        expect(screen.getByRole('alert')).toHaveTextContent(TRANSPORT_ERROR_MESSAGE)
      })
      expect(screen.getByText('$23.000')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Entrada: \$15\.000/ })).toBeInTheDocument()
    })
  })
})
