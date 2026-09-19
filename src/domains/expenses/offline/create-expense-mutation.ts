import { gql } from 'urql'

/**
 * The single `CreateExpense` document. The operation name matters: the
 * component tests route their urql double by it.
 */
export const CreateExpenseMutation = gql`
  mutation CreateExpense($input: ExpenseCreateInput!) {
    createExpense(input: $input) { id error }
  }
`
