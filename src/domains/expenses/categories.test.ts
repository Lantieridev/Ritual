import { describe, it, expect } from 'vitest'
import { EXPENSE_CATEGORIES, getExpenseCategory } from '@/src/domains/expenses/categories'

// ExpenseForm's category list and the expenses summary page's icon/color
// lookup used to be two independent lists that only agreed on "Entrada" —
// every other real category fell back to the generic "Otro" icon in the
// summary.
describe('getExpenseCategory', () => {
  it('finds a matching category by name', () => {
    const result = getExpenseCategory('Transporte')
    expect(result.icon).toBe('🚌')
  })

  it('falls back to the last category ("Otro") for an unknown name', () => {
    expect(getExpenseCategory('Something made up')).toEqual(EXPENSE_CATEGORIES.at(-1))
  })

  it('resolves every category a user can actually pick in the form to a distinct icon', () => {
    const icons = EXPENSE_CATEGORIES.map((c) => getExpenseCategory(c.name).icon)
    expect(new Set(icons).size).toBe(EXPENSE_CATEGORIES.length)
  })
})
