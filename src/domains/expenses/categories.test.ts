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

  // Issue #7: "Comida" and "Comida y bebida" are almost always bought
  // together in one transaction (choripán + gaseosa, birra + picada), so
  // they were merged into a single category instead of splitting them.
  it('keeps exactly 6 categories, with "Comida y bebida" replacing the old "Comida"', () => {
    expect(EXPENSE_CATEGORIES).toHaveLength(6)
    expect(EXPENSE_CATEGORIES.map((c) => c.name)).toContain('Comida y bebida')
    expect(EXPENSE_CATEGORIES.map((c) => c.name)).not.toContain('Comida')
  })

  it('falls back to "Otro" for the old "Comida" name (pre-rename data still resolves to something)', () => {
    expect(getExpenseCategory('Comida')).toEqual(EXPENSE_CATEGORIES.at(-1))
  })
})
