'use client'

import { useState } from 'react'
import { Button } from '@/src/core/components/ui'
import type { Expense } from '@/src/core/types'

interface DeleteExpenseButtonProps {
  expense: Expense
  deleteExpense: (id: string) => Promise<{ error?: string }>
}

export function DeleteExpenseButton({ expense, deleteExpense }: DeleteExpenseButtonProps) {
  const [isConfirming, setIsConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  if (!isConfirming) {
    return (
      <Button
        type="button"
        variant="ghost"
        className="text-red-400 hover:text-red-300 hover:bg-red-500/10"
        onClick={() => { setIsConfirming(true); setError(null) }}
      >
        Eliminar gasto
      </Button>
    )
  }

  return (
    <div className="rounded-lg border border-white/10 bg-white/5 p-4 space-y-3">
      <p className="text-sm text-zinc-300">
        ¿Eliminar este gasto de ${Number(expense.amount).toLocaleString('es-AR')} ({expense.category})?
      </p>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-2">
        <Button
          type="button"
          variant="primary"
          className="bg-red-600 hover:bg-red-500 text-white"
          onClick={async () => {
            setIsDeleting(true)
            setError(null)
            const result = await deleteExpense(expense.id)
            if (result?.error) {
              setError(result.error)
              setIsDeleting(false)
            }
          }}
          disabled={isDeleting}
        >
          {isDeleting ? 'Eliminando...' : 'Sí, eliminar'}
        </Button>
        <Button type="button" variant="secondary" onClick={() => { setIsConfirming(false) }} disabled={isDeleting}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}
