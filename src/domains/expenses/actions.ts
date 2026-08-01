'use server'

import { redirect } from 'next/navigation'
import { createClient } from '@/src/core/lib/supabase/server'
import { routes } from '@/src/core/lib/routes'
import { getCurrentUserId } from '@/src/core/auth/session'
import { validateUUID, validateDate, sanitizeText, sanitizeError } from '@/src/core/lib/validation'
import type { ActionResult, ExpenseCreateInput, ExpenseUpdateInput } from '@/src/core/types'

const MAX_NOTE_LENGTH = 500
const MAX_CATEGORY_LENGTH = 100
const MAX_AMOUNT = 10_000_000 // 10M — sanity cap

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

/**
 * Inserta el gasto y devuelve su id — sin redirigir. Misma razón que en
 * venues/artists/festivals: la mutation de GraphQL nunca debería redirigir,
 * eso queda para la Server Action que maneja el submit del formulario.
 */
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

  // Validate optional event_id if provided
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
    console.error('Error creando gasto:', error)
    return { error: sanitizeError(error) }
  }
  return { id: data.id }
}

export async function createExpense(formData: ExpenseCreateInput): Promise<ActionResult> {
  const result = await insertExpense(formData)
  if (result.error) return result
  redirect(routes.expenses.list)
}

/**
 * Actualiza el gasto sin redirigir — misma razón que insertExpense.
 * `noChanges` distingue "no había nada que actualizar" de una actualización
 * real: updateExpense necesita esa distinción para no redirigir en el caso
 * en que no se tocó nada (mismo comportamiento que tenía antes de separar
 * esta función).
 */
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
    .eq('user_id', r.userId) // Ensures users can only update their own expenses
  if (error) {
    console.error('Error actualizando gasto:', error)
    return { error: sanitizeError(error) }
  }
  return {}
}

export async function updateExpense(
  id: string,
  formData: ExpenseUpdateInput
): Promise<ActionResult> {
  const result = await modifyExpense(id, formData)
  if (result.error) return result
  if (result.noChanges) return {}
  redirect(routes.expenses.detail(id))
}

/** Borra el gasto sin redirigir — misma razón que insertExpense. */
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
    .eq('user_id', r.userId) // Ensures users can only delete their own expenses
  if (error) {
    console.error('Error eliminando gasto:', error)
    return { error: sanitizeError(error) }
  }
  return {}
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const result = await removeExpense(id)
  if (result.error) return result
  redirect(routes.expenses.list)
}
