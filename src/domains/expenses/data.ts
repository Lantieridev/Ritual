import { createClient } from '@/src/core/lib/supabase/server'
import { eventYear } from '@/src/core/lib/dates'
import type { Expense } from '@/src/core/types'

export interface ExpenseSummary {
  total: number
  byCategory: Record<string, number>
  byYear: Record<string, number>
  count: number
}

/**
 * Lista los gastos del usuario, ordenados por fecha descendente.
 * RLS filtra por user_id = auth.uid(); si no hay sesión devuelve [].
 */
export async function getExpenses(userId: string | null): Promise<Expense[]> {
  if (!userId) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('expenses')
    .select('id, user_id, amount, category, note, event_id, date, created_at')
    .eq('user_id', userId)
    .order('date', { ascending: false })
  if (error) {
    console.error('Error cargando gastos:', error)
    return []
  }
  return (data ?? []) as Expense[]
}

/** Obtiene un gasto por id. RLS asegura que solo el dueño pueda verlo. */
export async function getExpenseById(
  id: string,
  userId: string | null
): Promise<Expense | null> {
  if (!userId) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('expenses')
    .select('id, user_id, amount, category, note, event_id, date, created_at')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  return data as Expense
}

/** Gastos vinculados a un evento puntual, del usuario actual. RLS filtra por user_id. */
export async function getExpensesForEvent(eventId: string, userId: string | null): Promise<Expense[]> {
  if (!userId) return []
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('expenses')
    .select('id, user_id, amount, category, note, event_id, date, created_at')
    .eq('event_id', eventId)
    .eq('user_id', userId)
    .order('date', { ascending: false })
  if (error) {
    console.error('Error cargando gastos del evento:', error)
    return []
  }
  return (data ?? []) as Expense[]
}

/**
 * Calcula el resumen de gastos: total general, por categoría y por año.
 */
export async function getExpensesSummary(userId: string | null): Promise<ExpenseSummary> {
  const empty: ExpenseSummary = { total: 0, byCategory: {}, byYear: {}, count: 0 }
  if (!userId) return empty

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('expenses')
    .select('amount, category, date')
    .eq('user_id', userId)

  if (error || !data) return empty

  const result: ExpenseSummary = { total: 0, byCategory: {}, byYear: {}, count: data.length }

  for (const ex of data) {
    const amount = Number(ex.amount)
    result.total += amount

    const cat = ex.category ?? 'Otro'
    result.byCategory[cat] = (result.byCategory[cat] ?? 0) + amount

    const year = eventYear(ex.date).toString()
    result.byYear[year] = (result.byYear[year] ?? 0) + amount
  }

  return result
}

/** Soft, informational estimate of what a user tends to spend at a given venue or artist. */
export interface VenueArtistSpendEstimate {
  /** Average total spent per past event at this venue/artist, in ARS. */
  averageTotal: number
  /** How many past events (with at least one expense) this average is based on. */
  eventsConsidered: number
}

/**
 * Estimates expected spend for an event from the user's own history at the
 * same venue or with the same artist(s) — issue #7's "soft suggestion".
 * Purely informational: never a budget, limit, or "you went over" alert,
 * just an average of what past nights there/with them actually cost.
 *
 * Three queries instead of one: (1) past events at this venue, (2) past
 * events with any of these artists, (3) this user's expenses on the union
 * of those events. `expenses.event_id`, `events.venue_id` and
 * `lineups.artist_id` have no supporting index as of this writing — fine at
 * this app's personal scale (a user's own event history), but flagged here
 * rather than left silent: see the migration adding those three indexes
 * alongside this feature (issue #7 PR) if this ever needs revisiting.
 */
export async function getVenueArtistSpendEstimate(
  userId: string | null,
  venueId: string | null,
  artistIds: string[],
  excludeEventId: string
): Promise<VenueArtistSpendEstimate | null> {
  if (!userId) return null
  if (!venueId && artistIds.length === 0) return null

  const supabase = await createClient()
  const matchingEventIds = new Set<string>()

  if (venueId) {
    const { data: venueEvents, error: venueError } = await supabase
      .from('events')
      .select('id')
      .eq('venue_id', venueId)
      .neq('id', excludeEventId)
    if (venueError) {
      console.error('Error buscando eventos de la misma sede:', venueError)
    } else {
      for (const row of venueEvents ?? []) matchingEventIds.add(row.id)
    }
  }

  if (artistIds.length > 0) {
    const { data: lineupRows, error: lineupError } = await supabase
      .from('lineups')
      .select('event_id')
      .in('artist_id', artistIds)
    if (lineupError) {
      console.error('Error buscando eventos del mismo artista:', lineupError)
    } else {
      for (const row of lineupRows ?? []) {
        if (row.event_id !== excludeEventId) matchingEventIds.add(row.event_id)
      }
    }
  }

  if (matchingEventIds.size === 0) return null

  const { data: expenseRows, error: expenseError } = await supabase
    .from('expenses')
    .select('amount, event_id')
    .eq('user_id', userId)
    .in('event_id', Array.from(matchingEventIds))

  if (expenseError) {
    console.error('Error calculando gasto histórico por sede/artista:', expenseError)
    return null
  }
  if (!expenseRows || expenseRows.length === 0) return null

  const totalsByEvent = new Map<string, number>()
  for (const row of expenseRows) {
    if (!row.event_id) continue
    totalsByEvent.set(row.event_id, (totalsByEvent.get(row.event_id) ?? 0) + Number(row.amount))
  }

  const totals = Array.from(totalsByEvent.values())
  if (totals.length === 0) return null

  const averageTotal = totals.reduce((sum, t) => sum + t, 0) / totals.length
  return { averageTotal, eventsConsidered: totals.length }
}
