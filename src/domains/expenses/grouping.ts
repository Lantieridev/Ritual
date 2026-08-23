import type { Expense } from '@/src/core/types'

/**
 * One category's worth of expenses, grouped together.
 *
 * Issue #7: the event page's inline expense view shows repeated expenses of
 * the same category grouped ("Comida y bebida: $8.000 · 3 ítems"), with the
 * individual expenses available on tap/click — not a flat list where every
 * round of drinks is its own line.
 */
export interface ExpenseCategoryGroup {
  category: string
  total: number
  count: number
  expenses: Expense[]
}

/**
 * Groups a flat expense list by category, sorted by total spent (highest
 * first) — the categories that ate the most of the night's budget lead the
 * view. Each group keeps its own expenses sorted most-recent-first, matching
 * the order `listExpensesForEvent` already returns them in.
 *
 * Pure function on purpose: no Supabase/service dependency, so both the
 * event page's inline panel and the full per-event detail view can reuse it
 * without recomputing the query.
 */
export function groupExpensesByCategory(expenses: Expense[]): ExpenseCategoryGroup[] {
  const groups = new Map<string, ExpenseCategoryGroup>()

  for (const expense of expenses) {
    const existing = groups.get(expense.category)
    const amount = Number(expense.amount)
    if (existing) {
      existing.total += amount
      existing.count += 1
      existing.expenses.push(expense)
    } else {
      groups.set(expense.category, {
        category: expense.category,
        total: amount,
        count: 1,
        expenses: [expense],
      })
    }
  }

  return Array.from(groups.values()).sort((a, b) => b.total - a.total)
}
