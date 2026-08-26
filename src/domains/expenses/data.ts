import { createClient } from "@/src/core/lib/supabase/server";
import type { Expense } from "@/src/core/types";

export interface ExpenseSummary {
  total: number;
  byCategory: Record<string, number>;
  byYear: Record<string, number>;
  count: number;
}

/**
 * Lista los gastos del usuario, ordenados por fecha descendente.
 * RLS filtra por user_id = auth.uid(); si no hay sesión devuelve [].
 */
export async function getExpenses(userId: string | null): Promise<Expense[]> {
  if (!userId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .select("id, user_id, amount, category, note, event_id, date, created_at")
    .eq("user_id", userId)
    .order("date", { ascending: false });
  if (error) {
    console.error("Error cargando gastos:", error);
    return [];
  }
  return (data ?? []) as Expense[];
}

/** Obtiene un gasto por id. RLS asegura que solo el dueño pueda verlo. */
export async function getExpenseById(
  id: string,
  userId: string | null,
): Promise<Expense | null> {
  if (!userId) return null;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .select("id, user_id, amount, category, note, event_id, date, created_at")
    .eq("id", id)
    .eq("user_id", userId)
    .single();
  if (error || !data) return null;
  return data as Expense;
}

/** Gastos vinculados a un evento puntual, del usuario actual. RLS filtra por user_id. */
export async function getExpensesForEvent(
  eventId: string,
  userId: string | null,
): Promise<Expense[]> {
  if (!userId) return [];
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("expenses")
    .select("id, user_id, amount, category, note, event_id, date, created_at")
    .eq("event_id", eventId)
    .eq("user_id", userId)
    .order("date", { ascending: false });
  if (error) {
    console.error("Error cargando gastos del evento:", error);
    return [];
  }
  return (data ?? []) as Expense[];
}

/**
 * Calcula el resumen de gastos: total general, por categoría y por año.
 */
export async function getExpensesSummary(
  userId: string | null,
): Promise<ExpenseSummary> {
  const empty: ExpenseSummary = {
    total: 0,
    byCategory: {},
    byYear: {},
    count: 0,
  };
  if (!userId) return empty;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_expenses_summary", {
    user_uuid: userId,
  });

  if (error || !data) {
    if (error) console.error("Error calculando resumen de gastos:", error);
    return empty;
  }

  return data as ExpenseSummary;
}

/** Soft, informational estimate of what a user tends to spend at a given venue or artist. */
export interface VenueArtistSpendEstimate {
  /** Average total spent per past event at this venue/artist, in ARS. */
  averageTotal: number;
  /** How many past events (with at least one expense) this average is based on. */
  eventsConsidered: number;
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
  excludeEventId: string,
): Promise<VenueArtistSpendEstimate | null> {
  if (!userId) return null;
  if (!venueId && artistIds.length === 0) return null;

  const supabase = await createClient();

  const { data, error } = await supabase.rpc(
    "get_venue_artist_spend_estimate",
    {
      p_user_id: userId,
      p_venue_id: venueId,
      p_artist_ids: artistIds,
      p_exclude_event_id: excludeEventId,
    },
  );

  if (error) {
    console.error("Error calculando gasto histórico por sede/artista:", error);
    return null;
  }

  if (!data) return null;

  return data as VenueArtistSpendEstimate;
}
