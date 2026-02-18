import { supabase } from '@/src/core/lib/supabase'
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
  const { data, error } = await supabase
    .from('expenses')
    .select('id, user_id, amount, category, note, event_id, date, created_at')
    .eq('id', id)
    .eq('user_id', userId)
    .single()
  if (error || !data) return null
  return data as Expense
}

/**
 * Calcula el resumen de gastos: total general, por categoría y por año.
 */
export async function getExpensesSummary(userId: string | null): Promise<ExpenseSummary> {
  const empty: ExpenseSummary = { total: 0, byCategory: {}, byYear: {}, count: 0 }
  if (!userId) return empty

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

    const year = new Date(ex.date).getFullYear().toString()
    result.byYear[year] = (result.byYear[year] ?? 0) + amount
  }

  return result
}
