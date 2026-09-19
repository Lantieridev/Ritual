'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, gql } from 'urql'
import { unwrapMutation } from '@/src/graphql/mutation-result'
import { useCreateExpense } from '@/src/domains/expenses/offline/use-create-expense'
import { Button, FormField, inputClass } from '@/src/core/components/ui'
import { routes } from '@/src/core/lib/routes'
import { formatDate } from '@/src/core/lib/utils'
import { todayDateOnly } from '@/src/core/lib/dates'
import { EXPENSE_CATEGORIES } from '@/src/domains/expenses/categories'
import type { Expense, GraphQLExpense } from '@/src/core/types'
import type { EventWithRelations } from '@/src/core/types'

const UpdateExpenseMutation = gql`
  mutation UpdateExpense($id: ID!, $input: ExpenseUpdateInput!) {
    updateExpense(id: $id, input: $input) { error }
  }
`

interface ExpenseFormProps {
  events: EventWithRelations[]
  expense?: Expense | GraphQLExpense
}

export function ExpenseForm({ events, expense }: ExpenseFormProps) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const isEdit = Boolean(expense?.id)

  const createExpense = useCreateExpense()
  const [, updateExpenseM] = useMutation(UpdateExpenseMutation)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setNotice(null)
    setIsSubmitting(true)
    const form = e.currentTarget
    
    // Convert to GraphQL expected shapes (eventId instead of event_id)
    const payload = {
      amount: Number((form.elements.namedItem('amount') as HTMLInputElement).value),
      category: (form.elements.namedItem('category') as HTMLSelectElement).value,
      note: (form.elements.namedItem('note') as HTMLInputElement).value || undefined,
      eventId: (form.elements.namedItem('event_id') as HTMLSelectElement).value || undefined,
      date: (form.elements.namedItem('date') as HTMLInputElement).value,
    }
    
    if (isEdit && expense) {
      const result = unwrapMutation(await updateExpenseM({ id: expense.id, input: payload }), 'updateExpense')
      if (result.error) {
        setError(result.error)
        setIsSubmitting(false)
      } else {
        router.push(routes.expenses.detail(expense.id))
      }
    } else {
      const outcome = await createExpense(payload)
      if (outcome.status === 'rejected') {
        setError(outcome.error)
        setIsSubmitting(false)
      } else if (outcome.status === 'queued') {
        // Stay on the form: offline, navigating to the list may have no cached
        // page, and at the venue the next expense is usually right behind this one.
        form.reset()
        setNotice('Guardado en tu dispositivo. Se sincroniza cuando vuelva la señal.')
        setIsSubmitting(false)
      } else {
        router.push(routes.expenses.list)
      }
    }
  }

  const cancelHref = isEdit && expense ? routes.expenses.detail(expense.id) : routes.expenses.list
  // expense.date es una columna `date` de Postgres (sin hora ni timezone) —
  // el .slice(0,10) es seguro ahí, son los mismos dígitos tal cual. Para
  // "hoy" sí hace falta todayDateOnly(): `new Date().toISOString()` lee la
  // hora UTC del navegador/servidor, no la de Argentina.
  const defaultDate = expense?.date ? String(expense.date).slice(0, 10) : todayDateOnly()

  return (
    <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
      {notice && (
        <div role="status" className="bg-ritual-surface border border-ritual-border text-ritual-bone px-4 py-3 font-body text-sm">
          {notice}
        </div>
      )}
      {error && (
        <div role="alert" className="bg-ritual-red/10 border border-ritual-red/30 text-ritual-red-hover px-4 py-3 font-body text-sm">
          {error}
        </div>
      )}
      {isEdit && expense && (
        <p className="font-display leading-[0.8] text-ritual-bone" style={{ fontSize: 'min(16vw, 100px)' }}>
          \${Number(expense.amount).toLocaleString('es-AR', { maximumFractionDigits: 0 })}
        </p>
      )}
      <FormField label="Monto" id="amount" required>
        <input id="amount" name="amount" type="number" step="0.01" min="0.01" required placeholder="0.00" className={inputClass} defaultValue={expense?.amount != null ? Number(expense.amount) : ''} />
      </FormField>
      <FormField label="Categoría" id="category" required>
        <select id="category" name="category" required className={inputClass} defaultValue={expense?.category ?? ''}>
          <option value="">Elegir...</option>
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c.name} value={c.name}>{c.icon} {c.name}</option>
          ))}
        </select>
      </FormField>
      <FormField label="Fecha" id="date" required>
        <input id="date" name="date" type="date" required className={inputClass} defaultValue={defaultDate} />
      </FormField>
      <FormField label="Recital asociado (opcional)" id="event_id">
        <select id="event_id" name="event_id" className={inputClass} defaultValue={expense ? ('eventId' in expense ? expense.eventId : (expense as Expense).event_id) ?? '' : ''}>
          <option value="">Ninguno</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name ?? 'Recital'} – {formatDate(e.date)}
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
        <Link href={cancelHref} className="inline-flex items-center justify-center font-label text-[10px] tracking-[0.14em] uppercase border border-ritual-border text-ritual-bone hover:border-ritual-border-2 hover:bg-ritual-surface px-6 py-2.5 transition-colors">
          Cancelar
        </Link>
      </div>
    </form>
  )
}
