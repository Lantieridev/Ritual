import { supabase } from '@/src/core/lib/supabase'
import type { Expense } from '@/src/core/types'

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
