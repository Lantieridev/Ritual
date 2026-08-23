'use client'

import { ConfirmDeleteButton } from '@/src/core/components/ui'
import type { Expense, GraphQLExpense } from '@/src/core/types'

interface DeleteExpenseButtonProps {
  expense: Expense | GraphQLExpense
  deleteExpense: (id: string) => Promise<{ error?: string }>
}

export function DeleteExpenseButton({ expense, deleteExpense }: DeleteExpenseButtonProps) {
  const handleConfirm = async () => {
    return await deleteExpense(expense.id)
  }

  return (
    <ConfirmDeleteButton
      label="Eliminar gasto"
      confirmMessage={`¿Eliminar este gasto de $${Number(expense.amount).toLocaleString('es-AR')} (${expense.category})?`}
      onConfirm={handleConfirm}
    />
  )
}


