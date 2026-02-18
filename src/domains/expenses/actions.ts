'use server'

import { redirect } from 'next/navigation'
import { supabase } from '@/src/core/lib/supabase'
import { routes } from '@/src/core/lib/routes'
import { getCurrentUserId } from '@/src/core/lib/auth'
import type { ExpenseCreateInput, ExpenseUpdateInput } from '@/src/core/types'

function requireUserId() {
  return getCurrentUserId().then((id) => {
    if (!id) return { error: 'Iniciá sesión para registrar gastos. En desarrollo podés setear RITUAL_DEV_USER_ID en .env.local con tu user id de Supabase Auth.' as const }
    return { userId: id } as const
  })
}

function validateAmount(amount: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return 'El monto debe ser mayor a 0.'
  return null
}

export async function createExpense(formData: ExpenseCreateInput): Promise<{ error?: string }> {
  const r = await requireUserId()
  if ('error' in r) return r
  const err = validateAmount(Number(formData.amount))
  if (err) return { error: err }
  const category = formData.category?.trim()
  if (!category) return { error: 'La categoría es obligatoria.' }

  const { error } = await supabase.from('expenses').insert({
    user_id: r.userId,
    amount: Number(formData.amount),
    category,
    note: formData.note?.trim() || null,
    event_id: formData.event_id || null,
    date: formData.date,
  })
  if (error) {
    console.error('Error creando gasto:', error)
    return { error: error.message }
  }
  redirect(routes.expenses.list)
}

export async function updateExpense(id: string, formData: ExpenseUpdateInput): Promise<{ error?: string }> {
  const r = await requireUserId()
  if ('error' in r) return r
  if (!id) return { error: 'ID inválido.' }
  if (formData.amount !== undefined) {
    const err = validateAmount(Number(formData.amount))
    if (err) return { error: err }
  }
  const payload: Record<string, unknown> = {}
  if (formData.amount !== undefined) payload.amount = Number(formData.amount)
  if (formData.category !== undefined) payload.category = formData.category.trim() || null
  if (formData.note !== undefined) payload.note = formData.note?.trim() || null
  if (formData.event_id !== undefined) payload.event_id = formData.event_id || null
  if (formData.date !== undefined) payload.date = formData.date
  if (Object.keys(payload).length === 0) return {}
  const { error } = await supabase.from('expenses').update(payload).eq('id', id).eq('user_id', r.userId)
  if (error) {
    console.error('Error actualizando gasto:', error)
    return { error: error.message }
  }
  redirect(routes.expenses.detail(id))
}

export async function deleteExpense(id: string): Promise<{ error?: string }> {
  const r = await requireUserId()
  if ('error' in r) return r
  if (!id) return { error: 'ID inválido.' }
  const { error } = await supabase.from('expenses').delete().eq('id', id).eq('user_id', r.userId)
  if (error) {
    console.error('Error eliminando gasto:', error)
    return { error: error.message }
  }
  redirect(routes.expenses.list)
}
