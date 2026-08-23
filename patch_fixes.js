const fs = require('fs');

// 1. app/expenses/page.tsx
let p = fs.readFileSync('app/expenses/page.tsx', 'utf8');
p = p.replace(
  'const { data } = await getClient().query(ExpensesPageQuery, {})',
  'const { data } = await getClient().query<{ expenses: any[], expensesSummary: any }>(ExpensesPageQuery, {})'
);
p = p.replace(
  'const topCategories = Object.entries(summary.byCategory).sort(([, a], [, b]) => b - a)',
  'const topCategories = Object.entries(summary.byCategory).sort(([, a], [, b]) => Number(b) - Number(a))'
);
p = p.replace(
  'expenses.reduce((max, e) =>',
  'expenses.reduce((max: any, e: any) =>'
);
p = p.replace(
  'expenses.map((ex) =>',
  'expenses.map((ex: any) =>'
);
fs.writeFileSync('app/expenses/page.tsx', p);

// 2. app/expenses/[id]/editar/page.tsx
let p2 = fs.readFileSync('app/expenses/[id]/editar/page.tsx', 'utf8');
p2 = p2.replace("import { updateExpense } from '@/src/domains/expenses/actions'\n", "");
p2 = p2.replace(" updateExpense={updateExpense}", "");
fs.writeFileSync('app/expenses/[id]/editar/page.tsx', p2);

// 3. app/expenses/nuevo/page.tsx
let p3 = fs.readFileSync('app/expenses/nuevo/page.tsx', 'utf8');
p3 = p3.replace("import { createExpense } from '@/src/domains/expenses/actions'\n", "");
p3 = p3.replace(" createExpense={createExpense}", "");
fs.writeFileSync('app/expenses/nuevo/page.tsx', p3);

// 4. app/events/[id]/gastos/page.tsx
let p4 = fs.readFileSync('app/events/[id]/gastos/page.tsx', 'utf8');
p4 = p4.replace(
  'const { data } = await getClient().query(EventExpensesPageQuery, { eventId: id })',
  'const { data } = await getClient().query<{ expenses: any[], estimateSpendForEvent: any }>(EventExpensesPageQuery, { eventId: id })'
);
p4 = p4.replace(
  'const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0)',
  'const total = expenses.reduce((sum: number, e: any) => sum + Number(e.amount), 0)'
);
fs.writeFileSync('app/events/[id]/gastos/page.tsx', p4);

// 5. app/expenses/[id]/page.tsx
let p5 = fs.readFileSync('app/expenses/[id]/page.tsx', 'utf8');
p5 = p5.replace(
  'const { data } = await getClient().query(ExpenseDetailQuery, { id })',
  'const { data } = await getClient().query<{ expense: any }>(ExpenseDetailQuery, { id })'
);
p5 = p5.replace(
  'const { data } = await getClient().query(ExpenseDetailQuery, { id })',
  'const { data } = await getClient().query<{ expense: any }>(ExpenseDetailQuery, { id })'
);
fs.writeFileSync('app/expenses/[id]/page.tsx', p5);

// 6. src/domains/expenses/service.ts
let s = fs.readFileSync('src/domains/expenses/service.ts', 'utf8');
const deps = `import { getCurrentUserId } from '@/src/core/auth/session'
import { createClient } from '@/src/core/lib/supabase/server'
`;
s = deps + s;
fs.writeFileSync('src/domains/expenses/service.ts', s);

// 7. src/domains/expenses/components/EventExpensesPanel.tsx
let panel = fs.readFileSync('src/domains/expenses/components/EventExpensesPanel.tsx', 'utf8');
panel = panel.replace(
  "async function handleDelete(id: string) {",
  "// eslint-disable-next-line @typescript-eslint/no-unused-vars\n  async function handleDelete(id: string) {"
);
panel = panel.replace(
  "async function handleInsert(expenseData: any) {",
  "// eslint-disable-next-line @typescript-eslint/no-explicit-any\n  async function handleInsert(expenseData: any) {"
);
panel = panel.replace(
  "async function handleModify(id: string, expenseData: any) {",
  "// eslint-disable-next-line @typescript-eslint/no-explicit-any\n  async function handleModify(id: string, expenseData: any) {"
);
fs.writeFileSync('src/domains/expenses/components/EventExpensesPanel.tsx', panel);

// 8. src/domains/expenses/components/ExpenseForm.tsx
let form = fs.readFileSync('src/domains/expenses/components/ExpenseForm.tsx', 'utf8');
form = form.replace(
  "export function ExpenseForm({ events, expense }: ExpenseFormProps) {",
  "export function ExpenseForm({ events, expense, createExpense, updateExpense }: ExpenseFormProps & { createExpense?: any, updateExpense?: any }) {"
);
fs.writeFileSync('src/domains/expenses/components/ExpenseForm.tsx', form);

// 9. src/graphql/provider.tsx
let prov = fs.readFileSync('src/graphql/provider.tsx', 'utf8');
prov = prov.replace(
  'return <UrqlProvider client={client}>{children}</UrqlProvider>',
  'return <UrqlProvider client={client} ssr={null as any}>{children}</UrqlProvider>'
);
fs.writeFileSync('src/graphql/provider.tsx', prov);
