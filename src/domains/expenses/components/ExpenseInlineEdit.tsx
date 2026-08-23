'use client'

import { useState, useTransition } from 'react'
import { Button, inputClass } from '@/src/core/components/ui'
import { EXPENSE_CATEGORIES } from '@/src/domains/expenses/categories'
import type { Expense, ExpenseUpdateInput } from '@/src/core/types'

interface ExpenseInlineEditProps {
  expense: Expense
  modifyExpense: (id: string, data: ExpenseUpdateInput) => Promise<{ error?: string }>
  onSaved: (expense: Expense) => void
  onCancel: () => void
}

/**
 * Issue #7: "Edición también inline, nunca redirige a /expenses". Swapped
 * in for a single expense row inside EventExpensesPanel — same amount /
 * category / note fields as ExpenseQuickAdd, pre-filled, calling
 * `modifyExpense` (the non-redirecting core from actions.ts) instead of
 * `updateExpense`.
 */
export function ExpenseInlineEdit({ expense, modifyExpense, onSaved, onCancel }: ExpenseInlineEditProps) {
  const [amount, setAmount] = useState(String(expense.amount))
  const [category, setCategory] = useState(expense.category)
  const [note, setNote] = useState(expense.note ?? '')
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const parsedAmount = Number(amount)
    const trimmedNote = note.trim()

    startTransition(async () => {
      const result = await modifyExpense(expense.id, {
        amount: parsedAmount,
        category,
        note: trimmedNote,
      })
      if (result.error) {
        setError(result.error)
        return
      }
      onSaved({
        ...expense,
        amount: parsedAmount,
        category,
        note: trimmedNote || null,
      })
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-2 bg-ritual-surface border border-ritual-border p-3">
      {error && (
        <p role="alert" className="font-body text-sm text-ritual-red-hover">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <input
          aria-label="Monto"
          type="number"
          step="0.01"
          min="0.01"
          required
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className={`${inputClass} flex-1 min-w-[100px]`}
        />
        <select
          aria-label="Categoría"
          required
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className={`${inputClass} flex-1 min-w-[140px]`}
        >
          {EXPENSE_CATEGORIES.map((c) => (
            <option key={c.name} value={c.name}>{c.icon} {c.name}</option>
          ))}
        </select>
      </div>
      <input
        aria-label="Nota"
        type="text"
        placeholder="Nota (opcional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className={inputClass}
      />
      <div className="flex gap-2">
        <Button type="submit" variant="primary" disabled={isPending} className="px-4 py-1.5">
          {isPending ? 'Guardando...' : 'Guardar'}
        </Button>
        <Button type="button" variant="ghost" disabled={isPending} onClick={onCancel} className="px-4 py-1.5">
          Cancelar
        </Button>
      </div>
    </form>
  )
}
