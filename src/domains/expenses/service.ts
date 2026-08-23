import {
  getExpenses,
  getExpenseById,
  getExpensesForEvent,
  getExpensesSummary,
  getVenueArtistSpendEstimate,
} from './data'
import type { ExpenseSummary, VenueArtistSpendEstimate } from './data'
import { getEvents } from '@/src/domains/events/data'
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
 * Event options for the expense form's "recital asociado" picker. This
 * reads through the events domain's own data module — a cross-domain read,
 * not a write or a schema change — so it's exposed here rather than forcing
 * app/expenses/nuevo and app/expenses/[id]/editar to import events/data.ts
 * directly. The events domain itself is out of scope for this migration
 * (see the PR description's scope notes).
 */
export async function listEventOptionsForExpensePicker(): Promise<EventWithRelations[]> {
  return getEvents()
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
