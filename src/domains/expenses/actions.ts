'use server'

import { redirect } from 'next/navigation'
import { supabase } from '@/src/core/lib/supabase'
import { routes } from '@/src/core/lib/routes'
import { getCurrentUserId } from '@/src/core/lib/auth'
import { validateUUID, sanitizeText, sanitizeError } from '@/src/core/lib/validation'
import type { ExpenseCreateInput, ExpenseUpdateInput } from '@/src/core/types'

const MAX_NOTE_LENGTH = 500
const MAX_CATEGORY_LENGTH = 100
const MAX_AMOUNT = 10_000_000 // 10M — sanity cap

async function requireUserId() {
  const id = await getCurrentUserId()
  if (!id) {
    return {
      error: 'Iniciá sesión para registrar gastos. En desarrollo podés setear RITUAL_DEV_USER_ID en .env.local con tu user id de Supabase Auth.' as const,
    }
  }
  return { userId: id } as const
}

function validateAmount(amount: number): string | null {
  if (!Number.isFinite(amount) || amount <= 0) return 'El monto debe ser mayor a 0.'
  if (amount > MAX_AMOUNT) return `El monto no puede superar ${MAX_AMOUNT.toLocaleString('es-AR')}.`
  return null
}

export async function createExpense(formData: ExpenseCreateInput): Promise<{ error?: string }> {
  const r = await requireUserId()
  if ('error' in r) return r

  const amount = Number(formData.amount)
  const amountErr = validateAmount(amount)
  if (amountErr) return { error: amountErr }

  const category = sanitizeText(formData.category, MAX_CATEGORY_LENGTH)
  if (!category) return { error: 'La categoría es obligatoria.' }

  // Validate optional event_id if provided
  if (formData.event_id) {
    const eventIdErr = validateUUID(formData.event_id, 'Evento')
    if (eventIdErr) return { error: eventIdErr }
  }

  const { error } = await supabase.from('expenses').insert({
    user_id: r.userId,
    amount,
    category,
    note: sanitizeText(formData.note, MAX_NOTE_LENGTH),
    event_id: formData.event_id || null,
    date: formData.date,
  })
  if (error) {
    console.error('Error creando gasto:', error)
    return { error: sanitizeError(error) }
  }
  redirect(routes.expenses.list)
}

export async function updateExpense(
  id: string,
  formData: ExpenseUpdateInput
): Promise<{ error?: string }> {
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

  const payload: Record<string, unknown> = {}
  if (formData.amount !== undefined) payload.amount = Number(formData.amount)
  if (formData.category !== undefined) payload.category = sanitizeText(formData.category, MAX_CATEGORY_LENGTH)
  if (formData.note !== undefined) payload.note = sanitizeText(formData.note, MAX_NOTE_LENGTH)
  if (formData.event_id !== undefined) payload.event_id = formData.event_id || null
  if (formData.date !== undefined) payload.date = formData.date

  if (Object.keys(payload).length === 0) return {}

  const { error } = await supabase
    .from('expenses')
    .update(payload)
    .eq('id', id)
    .eq('user_id', r.userId) // Ensures users can only update their own expenses
  if (error) {
    console.error('Error actualizando gasto:', error)
    return { error: sanitizeError(error) }
  }
  redirect(routes.expenses.detail(id))
}

export async function deleteExpense(id: string): Promise<{ error?: string }> {
  const r = await requireUserId()
  if ('error' in r) return r

  const idErr = validateUUID(id, 'Gasto')
  if (idErr) return { error: idErr }

  const { error } = await supabase
    .from('expenses')
    .delete()
    .eq('id', id)
    .eq('user_id', r.userId) // Ensures users can only delete their own expenses
  if (error) {
    console.error('Error eliminando gasto:', error)
    return { error: sanitizeError(error) }
  }
  redirect(routes.expenses.list)
}
