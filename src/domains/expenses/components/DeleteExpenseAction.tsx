'use client'

import { useMutation, gql } from 'urql'
import { unwrapMutation } from '@/src/graphql/mutation-result'
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
    const result = unwrapMutation(await deleteExpense({ id }), 'deleteExpense')
    if (result.error) {
      return { error: result.error }
    }
    router.push(routes.expenses.list)
    return {}
  }

  return <DeleteExpenseButton expense={expense} deleteExpense={handleDelete} />
}
