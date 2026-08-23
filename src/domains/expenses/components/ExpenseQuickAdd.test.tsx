// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExpenseQuickAdd } from '@/src/domains/expenses/components/ExpenseQuickAdd'

/**
 * The quick-add still receives its write as a prop — EventExpensesPanel owns
 * the urql mutation and hands down a plain async function — so the double is
 * a bare vi.fn() here. What changed with the GraphQL migration (#44) is the
 * payload key: the panel forwards this object straight into
 * ExpenseCreateInput, so the field is `eventId`, not `event_id`.
 */
function renderQuickAdd(
  overrides: Partial<React.ComponentProps<typeof ExpenseQuickAdd>> = {}
) {
  return render(
    <ExpenseQuickAdd
      eventId="ev-1"
      defaultDate="2026-05-01"
      insertExpense={vi.fn()}
      onAdded={vi.fn()}
      onCancel={vi.fn()}
      {...overrides}
    />
  )
}

describe('ExpenseQuickAdd', () => {
  it('submits amount + category + the event id + the default date, with note omitted by default', async () => {
    const insertExpense = vi.fn().mockResolvedValue({ id: 'exp-1' })
    renderQuickAdd({ insertExpense })

    await userEvent.type(screen.getByLabelText('Monto'), '1500')
    await userEvent.selectOptions(screen.getByLabelText('Categoría'), 'Entrada')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar gasto' }))

    await waitFor(() => {
      expect(insertExpense).toHaveBeenCalledWith({
        amount: 1500,
        category: 'Entrada',
        note: undefined,
        eventId: 'ev-1',
        date: '2026-05-01',
      })
    })
  })

  it('has no date input — the date is silently defaulted, never asked of the user', () => {
    renderQuickAdd()
    expect(screen.queryByLabelText(/fecha/i)).not.toBeInTheDocument()
  })

  it('keeps the note field collapsed until "+ Agregar nota" is clicked, then includes it trimmed', async () => {
    const insertExpense = vi.fn().mockResolvedValue({ id: 'exp-1' })
    renderQuickAdd({ insertExpense })

    expect(screen.queryByPlaceholderText('Nota (opcional)')).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole('button', { name: '+ Agregar nota' }))
    await userEvent.type(screen.getByPlaceholderText('Nota (opcional)'), '  Uber ida y vuelta  ')
    await userEvent.type(screen.getByLabelText('Monto'), '2000')
    await userEvent.selectOptions(screen.getByLabelText('Categoría'), 'Transporte')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar gasto' }))

    await waitFor(() => {
      expect(insertExpense).toHaveBeenCalledWith(
        expect.objectContaining({ note: 'Uber ida y vuelta' })
      )
    })
  })

  it('calls onAdded with the new expense on success', async () => {
    const insertExpense = vi.fn().mockResolvedValue({ id: 'exp-1' })
    const onAdded = vi.fn()
    renderQuickAdd({ insertExpense, onAdded })

    await userEvent.type(screen.getByLabelText('Monto'), '1500')
    await userEvent.selectOptions(screen.getByLabelText('Categoría'), 'Merch')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar gasto' }))

    await waitFor(() => {
      expect(onAdded).toHaveBeenCalledWith(
        expect.objectContaining({ id: 'exp-1', amount: 1500, category: 'Merch', event_id: 'ev-1', date: '2026-05-01' })
      )
    })
  })

  it('shows the error and does not call onAdded when the insert fails', async () => {
    const insertExpense = vi.fn().mockResolvedValue({ error: 'El monto debe ser mayor a 0.' })
    const onAdded = vi.fn()
    renderQuickAdd({ insertExpense, onAdded })

    await userEvent.type(screen.getByLabelText('Monto'), '1500')
    await userEvent.selectOptions(screen.getByLabelText('Categoría'), 'Merch')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar gasto' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('El monto debe ser mayor a 0.')
    })
    expect(onAdded).not.toHaveBeenCalled()
  })

  // Una mutation que vuelve sin id ni error dejaría la fila fantasma en la
  // lista local del panel, sin nada que borrar después.
  it('refuses to report an add whose mutation came back without an id', async () => {
    const insertExpense = vi.fn().mockResolvedValue({})
    const onAdded = vi.fn()
    renderQuickAdd({ insertExpense, onAdded })

    await userEvent.type(screen.getByLabelText('Monto'), '1500')
    await userEvent.selectOptions(screen.getByLabelText('Categoría'), 'Merch')
    await userEvent.click(screen.getByRole('button', { name: 'Guardar gasto' }))

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('No se pudo registrar el gasto.')
    })
    expect(onAdded).not.toHaveBeenCalled()
  })

  it('calls onCancel when "Cancelar" is clicked', async () => {
    const onCancel = vi.fn()
    renderQuickAdd({ onCancel })

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }))
    expect(onCancel).toHaveBeenCalled()
  })
})
