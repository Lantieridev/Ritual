'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation, gql } from 'urql'
import { unwrapMutation } from '@/src/graphql/mutation-result'
import { getExpenseCategory } from '@/src/domains/expenses/categories'
import { groupExpensesByCategory } from '@/src/domains/expenses/grouping'
import { formatChoripanComparison } from '@/src/domains/expenses/comparisons'
import { ExpenseQuickAdd } from './ExpenseQuickAdd'
import { ExpenseInlineEdit } from './ExpenseInlineEdit'
import { DeleteExpenseButton } from './DeleteExpenseButton'
import { Button } from '@/src/core/components/ui'
import type { Expense } from '@/src/core/types'
import type { VenueArtistSpendEstimate } from '@/src/domains/expenses/service'

interface EventExpensesPanelProps {
  eventId: string
  initialExpenses: Expense[]
  /** Bare YYYY-MM-DD — the event's own date, used as the quick-add default. */
  defaultDate: string
  /** Issue #7's soft suggestion — null when there's no history to base one on. */
  spendEstimate: VenueArtistSpendEstimate | null
  /** Link to the full per-category breakdown view. */
  detailHref: string
}

function formatARS(amount: number) {
  return `$${amount.toLocaleString('es-AR', { maximumFractionDigits: 0 })}`
}

/**
 * Issue #7: inline "how much did I spend at THIS show" view on the event
 * page. Total + item count + quick-add without leaving the page, expenses
 * grouped by category (with per-expense detail/edit/delete on expand), and
 * a link out to the full per-category breakdown. All mutations go through
 * the non-redirecting actions (insertExpense/modifyExpense/removeExpense) —
 * this panel owns its own local state instead of relying on a page reload,
 * same pattern as PhotoGallery.
 */

const CreateExpenseMutation = gql`
  mutation CreateExpense($input: ExpenseCreateInput!) {
    createExpense(input: $input) { id error }
  }
`
const UpdateExpenseMutation = gql`
  mutation UpdateExpense($id: ID!, $input: ExpenseUpdateInput!) {
    updateExpense(id: $id, input: $input) { error }
  }
`
const DeleteExpenseMutation = gql`
  mutation DeleteExpense($id: ID!) {
    deleteExpense(id: $id) { error }
  }
`

export function EventExpensesPanel({
  eventId,
  initialExpenses,
  defaultDate,
  spendEstimate,
  detailHref,
}: EventExpensesPanelProps) {
  const [expenses, setExpenses] = useState<Expense[]>(initialExpenses)
  const [showQuickAdd, setShowQuickAdd] = useState(false)
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  const [, createExpenseM] = useMutation(CreateExpenseMutation)
  const [, updateExpenseM] = useMutation(UpdateExpenseMutation)
  const [, deleteExpenseM] = useMutation(DeleteExpenseMutation)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function handleInsert(expenseData: any) {
    const result = await createExpenseM({ input: expenseData })
    return unwrapMutation<{ id?: string; error?: string }>(result, 'createExpense')
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function handleModify(id: string, expenseData: any) {
    const result = await updateExpenseM({ id, input: expenseData })
    return unwrapMutation(result, 'updateExpense')
  }

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const groups = groupExpensesByCategory(expenses)
  const choripanLine = formatChoripanComparison(total)

  function handleAdded(expense: Expense) {
    setExpenses((prev) => [expense, ...prev])
    setShowQuickAdd(false)
    setExpandedCategory(expense.category)
  }

  function handleUpdated(expense: Expense) {
    setExpenses((prev) => prev.map((e) => (e.id === expense.id ? expense : e)))
    setEditingId(null)
  }

  async function handleDelete(id: string) {
    const result = unwrapMutation(await deleteExpenseM({ id }), 'deleteExpense')
    if (result.error) return { error: result.error }
    setExpenses((prev) => prev.filter((e) => e.id !== id))
    if (editingId === id) setEditingId(null)
    return {}
  }

  return (
    <div className="space-y-4" data-testid="event-expenses-panel">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-display leading-[0.8] text-ritual-bone" style={{ fontSize: 'min(14vw, 72px)' }}>
            {formatARS(total)}
          </p>
          <p className="font-label text-xs tracking-[0.1em] uppercase text-ritual-gray-text mt-1">
            {expenses.length} ítem{expenses.length !== 1 ? 's' : ''}
            {choripanLine ? ` · ${choripanLine}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href={detailHref}
            className="font-label text-[10px] tracking-[0.14em] uppercase text-ritual-gray-text hover:text-ritual-bone transition-colors underline underline-offset-4"
          >
            Ver desglose completo →
          </Link>
          {!showQuickAdd && (
            <Button type="button" variant="secondary" className="px-4 py-2" onClick={() => setShowQuickAdd(true)}>
              + Cargar gasto
            </Button>
          )}
        </div>
      </div>

      {spendEstimate && (
        <p className="font-body text-sm text-ritual-gray-text italic">
          Sueles gastar un promedio de {formatARS(spendEstimate.averageTotal)} en shows similares (misma sede o
          artista, {spendEstimate.eventsConsidered} show{spendEstimate.eventsConsidered !== 1 ? 's' : ''} anteriores)
          — solo de referencia, no un límite.
        </p>
      )}

      {showQuickAdd && (
        <ExpenseQuickAdd
          eventId={eventId}
          defaultDate={defaultDate}
          insertExpense={handleInsert}
          onAdded={handleAdded}
          onCancel={() => setShowQuickAdd(false)}
        />
      )}

      {groups.length === 0 ? (
        <p className="font-body text-sm text-ritual-gray-text">Todavía no cargaste gastos para este show.</p>
      ) : (
        <ul className="divide-y divide-ritual-border-subtle">
          {groups.map((group) => {
            const { icon } = getExpenseCategory(group.category)
            const isExpanded = expandedCategory === group.category
            return (
              <li key={group.category} className="py-3">
                <button
                  type="button"
                  onClick={() => setExpandedCategory(isExpanded ? null : group.category)}
                  className="w-full flex items-center justify-between gap-3 text-left"
                  aria-expanded={isExpanded}
                >
                  <span className="font-dense font-extrabold text-ritual-bone">
                    {icon} {group.category}: {formatARS(group.total)} · {group.count} ítem{group.count !== 1 ? 's' : ''}
                  </span>
                  <span className="font-label text-xs text-ritual-gray-text" aria-hidden="true">
                    {isExpanded ? '▲' : '▼'}
                  </span>
                </button>

                {isExpanded && (
                  <ul className="mt-3 space-y-3 pl-4 border-l border-ritual-border-subtle">
                    {group.expenses.map((expense) => (
                      <li key={expense.id}>
                        {editingId === expense.id ? (
                          <ExpenseInlineEdit
                            expense={expense}
                            modifyExpense={handleModify}
                            onSaved={handleUpdated}
                            onCancel={() => setEditingId(null)}
                          />
                        ) : (
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="font-body text-sm text-ritual-bone">{formatARS(Number(expense.amount))}</p>
                              {expense.note && (
                                <p className="font-label text-xs text-ritual-gray-text mt-0.5">{expense.note}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <button
                                type="button"
                                onClick={() => setEditingId(expense.id)}
                                className="font-label text-[10px] tracking-[0.1em] uppercase text-ritual-gray-text hover:text-ritual-bone transition-colors"
                              >
                                Editar
                              </button>
                              <DeleteExpenseButton expense={expense} deleteExpense={handleDelete} />
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
