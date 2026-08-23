'use client'

import { useMutation, gql } from 'urql'
import { useRouter } from 'next/navigation'
import { routes } from '@/src/core/lib/routes'
import { DeleteExpenseButton } from './DeleteExpenseButton'
import type { Expense, GraphQLExpense } from '@/src/core/types'

const DeleteExpenseQuery = gql`
  mutation DeleteExpense($id: ID!) {
    deleteExpense(id: $id) { error }
  }
`

export function DeleteExpenseAction({ expense }: { expense: Expense | GraphQLExpense }) {
  const router = useRouter()
  const [, deleteExpense] = useMutation(DeleteExpenseQuery)

  const handleDelete = async (id: string) => {
    const { data } = await deleteExpense({ id })
    if (data?.deleteExpense?.error) {
      return { error: data.deleteExpense.error }
    }
    router.push(routes.expenses.list)
    return {}
  }

  return <DeleteExpenseButton expense={expense} deleteExpense={handleDelete} />
}
