const fs = require('fs');

let panel = fs.readFileSync('src/domains/expenses/components/EventExpensesPanel.tsx', 'utf8');

// replace imports
panel = panel.replace(
  "import { insertExpense, modifyExpense, removeExpense } from '@/src/domains/expenses/actions'",
  "import { useMutation, gql } from 'urql'"
);

// insert GraphQL queries before EventExpensesPanel
const queries = `
const CreateExpenseMutation = gql\`
  mutation CreateExpense($input: ExpenseCreateInput!) {
    createExpense(input: $input) { id error }
  }
\`
const UpdateExpenseMutation = gql\`
  mutation UpdateExpense($id: ID!, $input: ExpenseUpdateInput!) {
    updateExpense(id: $id, input: $input) { error }
  }
\`
const DeleteExpenseMutation = gql\`
  mutation DeleteExpense($id: ID!) {
    deleteExpense(id: $id) { error }
  }
\`
`;
panel = panel.replace(
  'export function EventExpensesPanel({',
  queries + '\nexport function EventExpensesPanel({'
);

// insert useMutations and handlers
panel = panel.replace(
  '  const [editingId, setEditingId] = useState<string | null>(null)',
  `  const [editingId, setEditingId] = useState<string | null>(null)

  const [, createExpenseM] = useMutation(CreateExpenseMutation)
  const [, updateExpenseM] = useMutation(UpdateExpenseMutation)
  const [, deleteExpenseM] = useMutation(DeleteExpenseMutation)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function handleInsert(expenseData: any) {
    const { data } = await createExpenseM({ input: expenseData })
    return { id: data?.createExpense?.id, error: data?.createExpense?.error }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function handleModify(id: string, expenseData: any) {
    const { data } = await updateExpenseM({ id, input: expenseData })
    return { error: data?.updateExpense?.error }
  }`
);

// replace insertExpense prop
panel = panel.replace(
  'insertExpense={insertExpense}',
  'insertExpense={handleInsert}'
);

// replace modifyExpense prop
panel = panel.replace(
  'modifyExpense={modifyExpense}',
  'modifyExpense={handleModify}'
);

fs.writeFileSync('src/domains/expenses/components/EventExpensesPanel.tsx', panel);
