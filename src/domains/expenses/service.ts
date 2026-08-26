import { getCurrentUserId } from '@/src/core/auth/session'
import { createClient } from '@/src/core/lib/supabase/server'
import { validateUUID, validateDate, sanitizeText, sanitizeError } from '@/src/core/lib/validation'
import type { ActionResult, ExpenseCreateInput, ExpenseUpdateInput } from '@/src/core/types'
import {
  getExpenses,
  getExpenseById,
  getExpensesForEvent,
  getExpensesSummary,
  getVenueArtistSpendEstimate,
} from './data'
import type { ExpenseSummary, VenueArtistSpendEstimate } from './data'
import { listEvents } from '@/src/domains/events/service'
import type { Expense, EventWithRelations } from '@/src/core/types'

export type { ExpenseSummary, VenueArtistSpendEstimate }

/**
 * Use-case / application-service layer for the expenses domain.
 *
 * Server Components (app/expenses/**, app/wrapped, app/events/[id]) and the
 * GraphQL resolver (src/graphql/expenses.ts) call through here instead of
 * importing ./data directly — see issue #25. This is the seam: swapping the
 * data source or schema later (moving off Supabase, renaming a column) only
 * requires changes in data.ts and here, never in a page component or the
 * GraphQL layer.
 *
 * Mutations are deliberately NOT wrapped here — actions.ts already plays
 * that role for writes: it validates input, returns the shared
 * `ActionResult<T>` shape, and its redirect-free core functions
 * (insertExpense/modifyExpense/removeExpense) are already reused as-is by
 * both the Server Actions and the GraphQL mutations. Adding another
 * pass-through layer in front of it would duplicate that seam, not
 * strengthen it, so the write side is intentionally left alone.
 */

/** Lists the current user's expenses, most recent first. */
export async function listExpenses(userId: string | null): Promise<Expense[]> {
  return getExpenses(userId)
}

/** Finds one expense by id, scoped to its owner. */
export async function findExpenseById(id: string, userId: string | null): Promise<Expense | null> {
  return getExpenseById(id, userId)
}

/** Lists the expenses linked to a specific event, scoped to the given user. */
export async function listExpensesForEvent(eventId: string, userId: string | null): Promise<Expense[]> {
  return getExpensesForEvent(eventId, userId)
}

/** Aggregates total/by-category/by-year figures for the current user. */
export async function summarizeExpenses(userId: string | null): Promise<ExpenseSummary> {
  return getExpensesSummary(userId)
}

/**
 * Event options for the expense form's "recital asociado" picker. Cross-domain
 * read through events/service.ts — not a write or a schema change — so it's
 * exposed here rather than forcing app/expenses/nuevo and
 * app/expenses/[id]/editar to reach into another domain's service directly.
 */
export async function listEventOptionsForExpensePicker(): Promise<EventWithRelations[]> {
  return listEvents()
}

/**
 * Issue #7's "soft suggestion": what the user tends to spend at this event's
 * venue or with this event's artists, based on their own past expenses —
 * purely informational, never a limit. Extracts venue_id/artist ids from the
 * already-loaded event so the event page doesn't need to know the shape of
 * that lookup, matching listEventOptionsForExpensePicker's role above.
 */
export async function estimateSpendForEvent(
  event: EventWithRelations,
  userId: string | null
): Promise<VenueArtistSpendEstimate | null> {
  const artistIds = (event.lineups ?? []).map((row) => row.artists.id)
  return getVenueArtistSpendEstimate(userId, event.venue_id, artistIds, event.id)
}


const MAX_NOTE_LENGTH = 500
const MAX_CATEGORY_LENGTH = 100
const MAX_AMOUNT = 10_000_000

async function requireUserId() {
  const id = await getCurrentUserId()
  if (!id) {
    return {
      error: 'Iniciá sesión para registrar gastos.' as const,
    }
  }
  return { userId: id } as const
}

function validateAmount(amount: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return 'El monto debe ser mayor a 0.'
  if (amount > MAX_AMOUNT) return `El monto no puede superar ${MAX_AMOUNT.toLocaleString('es-AR')}.`
  return null
}

export async function insertExpense(formData: ExpenseCreateInput): Promise<ActionResult<{ id?: string }>> {
  const r = await requireUserId()
  if ('error' in r) return r

  const amount = Number(formData.amount)
  const amountErr = validateAmount(amount)
  if (amountErr) return { error: amountErr }

  const category = sanitizeText(formData.category, MAX_CATEGORY_LENGTH)
  if (!category) return { error: 'La categoría es obligatoria.' }

  const dateErr = validateDate(formData.date)
  if (dateErr) return { error: dateErr }

  if (formData.event_id) {
    const eventIdErr = validateUUID(formData.event_id, 'Evento')
    if (eventIdErr) return { error: eventIdErr }
  }

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      user_id: r.userId,
      amount,
      category,
      note: sanitizeText(formData.note, MAX_NOTE_LENGTH),
      event_id: formData.event_id || null,
      date: formData.date,
    })
    .select('id')
    .single()
  if (error) {
    return { error: sanitizeError(error) }
  }
  return { id: data.id }
}

export async function modifyExpense(
  id: string,
  formData: ExpenseUpdateInput
): Promise<ActionResult<{ noChanges?: boolean }>> {
  const r = await requireUserId()
  if ('error' in r) return r

  const idErr = validateUUID(id, 'Gasto')
  if (idErr) return { error: idErr }

  if (formData.amount !== undefined) {
    const amountErr = validateAmount(Number(formData.amount))
    if (amountErr) return { error: amountErr }
  }

  if (formData.event_id) {
    const eventIdErr = validateUUID(formData.event_id, 'Evento')
    if (eventIdErr) return { error: eventIdErr }
  }

  if (formData.date !== undefined) {
    const dateErr = validateDate(formData.date)
    if (dateErr) return { error: dateErr }
  }

  const payload: Record<string, unknown> = {}
  if (formData.amount !== undefined) payload.amount = Number(formData.amount)
  if (formData.category !== undefined) payload.category = sanitizeText(formData.category, MAX_CATEGORY_LENGTH)
  if (formData.note !== undefined) payload.note = sanitizeText(formData.note, MAX_NOTE_LENGTH)
  if (formData.event_id !== undefined) payload.event_id = formData.event_id || null
  if (formData.date !== undefined) payload.date = formData.date

  if (Object.keys(payload).length === 0) return { noChanges: true }

  const supabase = await createClient()
  const { error } = await supabase
    .from('expenses')
    .update(payload)
    .eq('id', id)
    .eq('user_id', r.userId)
  if (error) {
    return { error: sanitizeError(error) }
  }
  return {}
}

export async function removeExpense(id: string): Promise<ActionResult> {
  const r = await requireUserId()
  if ('error' in r) return r

  const idErr = validateUUID(id, 'Gasto')
  if (idErr) return { error: idErr }

  const supabase = await createClient()
  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id)
    .eq('user_id', r.userId)
  if (error) {
    return { error: sanitizeError(error) }
  }
  return {}
}
