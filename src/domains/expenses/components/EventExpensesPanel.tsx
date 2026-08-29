'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useMutation, gql } from 'urql'
import { unwrapMutation } from '@/src/graphql/mutation-result'
import { getExpenseCategory } from '@/src/domains/expenses/categories'
import { groupExpensesByCategory } from '@/src/domains/expenses/grouping'
import { formatChoripanComparison } from '@/src/domains/expenses/comparisons'
import { computeDebts } from '@/src/domains/expenses/debts'
import { ExpenseQuickAdd } from './ExpenseQuickAdd'
import { ExpenseInlineEdit } from './ExpenseInlineEdit'
import { DeleteExpenseButton } from './DeleteExpenseButton'
import { ExpenseSplitControl } from './ExpenseSplitControl'
import { Button } from '@/src/core/components/ui'
import type { Expense } from '@/src/core/types'
import type { VenueArtistSpendEstimate, ExpenseSplitUser } from '@/src/domains/expenses/service'

/** El gasto tal como llega de GraphQL, con lo que agrega el issue #58 ("Crew"). */
export interface ExpenseWithSplits extends Expense {
  ownerUsername?: string | null
  splits: ExpenseSplitUser[]
}

interface EventExpensesPanelProps {
  eventId: string
  initialExpenses: ExpenseWithSplits[]
  /** Bare YYYY-MM-DD — the event's own date, used as the quick-add default. */
  defaultDate: string
  /** Issue #7's soft suggestion — null when there's no history to base one on. */
  spendEstimate: VenueArtistSpendEstimate | null
  /** Link to the full per-category breakdown view. */
  detailHref: string
  /** Para distinguir gastos propios de compartidos (issue #58) — null sin sesión. */
  currentUserId: string | null
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
  currentUserId,
}: EventExpensesPanelProps) {
  const [expenses, setExpenses] = useState<ExpenseWithSplits[]>(initialExpenses)
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

  // "La cuenta de esa noche" es lo que gasté yo, no lo que gastó el grupo
  // entero -un gasto que otra persona pagó y compartió conmigo no es plata
  // que salió de mi bolsillo, aunque yo le deba una parte. Mismo total que
  // antes del issue #58 para quien no tiene nada compartido.
  const myExpenses = expenses.filter((e) => e.user_id === currentUserId)
  const total = myExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const groups = groupExpensesByCategory(expenses)
  const choripanLine = formatChoripanComparison(total)

  const debts = computeDebts(expenses)
  const owedToMe = currentUserId ? debts.filter((d) => d.to_user_id === currentUserId) : []
  const iOwe = currentUserId ? debts.filter((d) => d.from_user_id === currentUserId) : []

  // Un solo mapa global id->username, armado con lo que ya trae cada gasto
  // (su propio dueño + sus tageados) — una deuda agregada por computeDebts
  // puede venir de varios gastos, así que no alcanza con mirar uno solo.
  const usernameById = new Map<string, string | null>()
  for (const e of expenses) {
    usernameById.set(e.user_id, e.ownerUsername ?? null)
    for (const s of e.splits) usernameById.set(s.user_id, s.username)
  }
  function usernameFor(userId: string): string {
    return usernameById.get(userId) || 'alguien'
  }

  function handleAdded(expense: Expense) {
    // ExpenseQuickAdd manda user_id: '' como placeholder (antes de este
    // issue nada lo miraba, RLS ya scopeaba toda lectura al dueño) — ahora
    // sí importa para saber si el gasto recién agregado es "mío", así que
    // se pisa acá con el id real en vez de con la cadena vacía.
    setExpenses((prev) => [{ ...expense, user_id: currentUserId ?? expense.user_id, ownerUsername: null, splits: [] }, ...prev])
    setShowQuickAdd(false)
    setExpandedCategory(expense.category)
  }

  function handleUpdated(expense: Expense) {
    setExpenses((prev) => prev.map((e) => (e.id === expense.id ? { ...e, ...expense } : e)))
    setEditingId(null)
  }

  function handleSplitsChanged(expenseId: string, splits: ExpenseSplitUser[]) {
    setExpenses((prev) => prev.map((e) => (e.id === expenseId ? { ...e, splits } : e)))
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
            {myExpenses.length} ítem{myExpenses.length !== 1 ? 's' : ''}
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

      {/* "Crew" — issue #58. Sólo el cálculo y la visibilidad, no resuelve
          pagos reales. Partes iguales entre quien pagó y cada tageado. */}
      {(owedToMe.length > 0 || iOwe.length > 0) && (
        <div className="border border-ritual-border-subtle bg-ritual-surface px-4 py-3 space-y-1.5">
          <p className="font-label text-[10px] tracking-[0.14em] uppercase text-ritual-gray-text mb-1">
            Entre la crew
          </p>
          {owedToMe.map((d) => (
            <p key={`in-${d.from_user_id}`} className="font-body text-sm text-ritual-bone">
              <span className="text-ritual-red-hover">@{usernameFor(d.from_user_id)}</span> te debe {formatARS(d.amount)}
            </p>
          ))}
          {iOwe.map((d) => (
            <p key={`out-${d.to_user_id}`} className="font-body text-sm text-ritual-bone">
              Le debés {formatARS(d.amount)} a <span className="text-ritual-red-hover">@{usernameFor(d.to_user_id)}</span>
            </p>
          ))}
        </div>
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
                          <div className="space-y-2">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="font-body text-sm text-ritual-bone">{formatARS(Number(expense.amount))}</p>
                                {expense.note && (
                                  <p className="font-label text-xs text-ritual-gray-text mt-0.5">{expense.note}</p>
                                )}
                                {expense.user_id !== currentUserId && (
                                  <p className="font-label text-[10px] uppercase text-ritual-gray-text mt-0.5">
                                    Compartido por @{expense.ownerUsername || 'alguien'}
                                  </p>
                                )}
                              </div>
                              {expense.user_id === currentUserId && (
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
                              )}
                            </div>
                            {expense.user_id === currentUserId && expense.event_id && (
                              <ExpenseSplitControl
                                expenseId={expense.id}
                                splits={expense.splits}
                                onChange={(splits) => handleSplitsChanged(expense.id, splits)}
                              />
                            )}
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
