const fs = require('fs');

let panel = fs.readFileSync('src/domains/expenses/components/EventExpensesPanel.tsx', 'utf8');

panel = panel.replace(
  /async function handleDelete\(id: string\) \{\s*const result = await removeExpense\(id\)\s*if \(\!result\.error\) \{\s*setExpenses\(\(prev\) => prev\.filter\(\(e\) => e\.id !== id\)\)\s*if \(editingId === id\) setEditingId\(null\)\s*\}\s*return result\s*\}/g,
  `async function handleDelete(id: string) {
    const { data } = await deleteExpenseM({ id })
    if (!data?.deleteExpense?.error) {
      setExpenses((prev) => prev.filter((e) => e.id !== id))
      if (editingId === id) setEditingId(null)
      return {}
    }
    return { error: data.deleteExpense.error }
  }`
);

fs.writeFileSync('src/domains/expenses/components/EventExpensesPanel.tsx', panel);
