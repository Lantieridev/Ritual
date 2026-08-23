'use client'

import { useState, useTransition } from 'react'
import { Button, inputClass } from '@/src/core/components/ui'
import { EXPENSE_CATEGORIES } from '@/src/domains/expenses/categories'
import type { Expense } from '@/src/core/types'

interface ExpenseQuickAddProps {
  eventId: string
  /** Bare YYYY-MM-DD used as the expense's date — see EventExpensesPanel for why there's no date field here. */
  defaultDate: string
  insertExpense: (data: {
    amount: number
    category: string
    note?: string
    event_id?: string
    date: string
  }) => Promise<{ error?: string; id?: string }>
  onAdded: (expense: Expense) => void
  onCancel: () => void
}

/**
 * Issue #7's "carga rápida": amount + category only, submittable in one
 * step without leaving the event page. Note is optional and collapsed by
 * default — "el resto (nota) queda opcional para después".
 *
 * No date field on purpose: this is a quick-add for something that just
 * happened at (or around) this show, so the date defaults silently to the
 * event's own date rather than asking the user to pick one. A user who
 * needs a different date can still get there via the full ExpenseForm.
 */
export function ExpenseQuickAdd({ eventId, defaultDate, insertExpense, onAdded, onCancel }: ExpenseQuickAddProps) {
  const [amount, setAmount] = useState('')
  const [category, setCategory] = useState('')
  const [showNote, setShowNote] = useState(false)
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const parsedAmount = Number(amount)
    const trimmedNote = note.trim()

    startTransition(async () => {
      const result = await insertExpense({
        amount: parsedAmount,
        category,
        note: trimmedNote || undefined,
        event_id: eventId,
        date: defaultDate,
      })
      if (result.error || !result.id) {
        setError(result.error ?? 'No se pudo registrar el gasto.')
        return
      }
      onAdded({
        id: result.id,
        // Placeholder: RLS already scopes every read of this list to the
        // current user, and nothing in this view ever renders user_id — the
        // real value lives server-side and isn't needed here.
        user_id: '',
        amount: parsedAmount,
        category,
        note: trimmedNote || null,
        event_id: eventId,
        date: defaultDate,
      })
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 border border-ritual-border bg-ritual-surface p-4">
      {error && (
        <p role="alert" className="font-body text-sm text-ritual-red-hover">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-3">
        <div className="flex-1 min-w-[120px]">
          <label htmlFor="quick-add-amount" className="sr-only">Monto</label>
          <input
            id="quick-add-amount"
            type="number"
            step="0.01"
            min="0.01"
            required
            placeholder="Monto"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="flex-1 min-w-[150px]">
          <label htmlFor="quick-add-category" className="sr-only">Categoría</label>
          <select
            id="quick-add-category"
            required
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className={inputClass}
          >
            <option value="">Categoría...</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c.name} value={c.name}>{c.icon} {c.name}</option>
            ))}
          </select>
        </div>
      </div>

      {showNote ? (
        <div>
          <label htmlFor="quick-add-note" className="sr-only">Nota</label>
          <input
            id="quick-add-note"
            type="text"
            placeholder="Nota (opcional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className={inputClass}
          />
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowNote(true)}
          className="font-label text-[10px] tracking-[0.1em] uppercase text-ritual-gray-text hover:text-ritual-bone transition-colors"
        >
          + Agregar nota
        </button>
      )}

      <div className="flex gap-2 pt-1">
        <Button type="submit" variant="primary" disabled={isPending} className="px-4 py-2">
          {isPending ? 'Guardando...' : 'Guardar gasto'}
        </Button>
        <Button type="button" variant="ghost" disabled={isPending} onClick={onCancel} className="px-4 py-2">
          Cancelar
        </Button>
      </div>
    </form>
  )
}
