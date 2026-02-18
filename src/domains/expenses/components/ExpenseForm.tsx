'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button, FormField, inputClass } from '@/src/core/components/ui'
import { routes } from '@/src/core/lib/routes'
import type { ExpenseCreateInput, ExpenseUpdateInput, Expense } from '@/src/core/types'
import type { EventWithRelations } from '@/src/core/types'

export const EXPENSE_CATEGORIES = [
  'Entrada',
  'Viaje',
  'Hospedaje',
  'Comida / Bebida',
  'Merchandising',
  'Otro',
]

interface ExpenseFormProps {
  events: EventWithRelations[]
  createExpense?: (data: ExpenseCreateInput) => Promise<{ error?: string }>
  expense?: Expense
  updateExpense?: (id: string, data: ExpenseUpdateInput) => Promise<{ error?: string }>
}

function todayISO() {
  const d = new Date()
  return d.toISOString().slice(0, 10)
}

export function ExpenseForm({ events, createExpense, expense, updateExpense }: ExpenseFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isEdit = Boolean(expense?.id && updateExpense)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setIsSubmitting(true)
    const form = e.currentTarget
    const payload = {
      amount: Number((form.elements.namedItem('amount') as HTMLInputElement).value),
      category: (form.elements.namedItem('category') as HTMLSelectElement).value,
      note: (form.elements.namedItem('note') as HTMLInputElement).value || undefined,
      event_id: (form.elements.namedItem('event_id') as HTMLSelectElement).value || undefined,
      date: (form.elements.namedItem('date') as HTMLInputElement).value,
    }
    if (isEdit && expense) {
      const result = await updateExpense!(expense.id, payload)
      if (result?.error) {
        setError(result.error)
        setIsSubmitting(false)
      }
    } else if (createExpense) {
      const result = await createExpense(payload)
      if (result?.error) {
        setError(result.error)
        setIsSubmitting(false)
      }
    }
  }

  const cancelHref = isEdit && expense ? routes.expenses.detail(expense.id) : routes.expenses.list
  const defaultDate = expense?.date ? String(expense.date).slice(0, 10) : todayISO()

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
      {error && (
        <div role="alert" className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 text-sm">
          {error}
        </div>
      )}
      <FormField label="Monto" id="amount" required>
        <input id="amount" name="amount" type="number" step="0.01" min="0.01" required placeholder="0.00" className={inputClass} defaultValue={expense?.amount != null ? Number(expense.amount) : ''} />
      </FormField>
      <FormField label="Categoría" id="category" required>
        <select id="category" name="category" required className={inputClass} defaultValue={expense?.category ?? ''}>
          <option value="">Elegir...</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </FormField>
      <FormField label="Fecha" id="date" required>
        <input id="date" name="date" type="date" required className={inputClass} defaultValue={defaultDate} />
      </FormField>
      <FormField label="Recital asociado (opcional)" id="event_id">
        <select id="event_id" name="event_id" className={inputClass} defaultValue={expense?.event_id ?? ''}>
          <option value="">Ninguno</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name ?? 'Recital'} – {new Date(e.date).toLocaleDateString('es-AR')}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Nota" id="note">
        <input id="note" name="note" type="text" placeholder="Ej: Uber ida y vuelta" className={inputClass} defaultValue={expense?.note ?? ''} />
      </FormField>
      <div className="flex gap-3 pt-2">
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Agregar gasto'}
        </Button>
        <Link href={cancelHref} className="inline-flex items-center justify-center rounded-lg font-medium border border-white/20 text-white hover:border-white/30 hover:bg-white/5 px-6 py-2.5 transition-colors">
          Cancelar
        </Link>
      </div>
    </form>
  )
}
