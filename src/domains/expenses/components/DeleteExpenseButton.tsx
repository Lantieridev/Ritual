'use client'

import { ConfirmDeleteButton } from '@/src/core/components/ui'
import type { Expense } from '@/src/core/types'

interface DeleteExpenseButtonProps {
  expense: Expense
  deleteExpense: (id: string) => Promise<{ error?: string }>
}

export function DeleteExpenseButton({ expense, deleteExpense }: DeleteExpenseButtonProps) {
  return (
    <ConfirmDeleteButton
      label="Eliminar gasto"
      confirmMessage={`¿Eliminar este gasto de $${Number(expense.amount).toLocaleString('es-AR')} (${expense.category})?`}
      onConfirm={() => deleteExpense(expense.id)}
    />
  )
}
