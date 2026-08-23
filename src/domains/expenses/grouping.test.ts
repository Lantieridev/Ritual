import { describe, it, expect } from 'vitest'
import { groupExpensesByCategory } from '@/src/domains/expenses/grouping'
import type { Expense } from '@/src/core/types'

function expense(overrides: Partial<Expense>): Expense {
  return {
    id: 'x1',
    user_id: 'u1',
    amount: 1000,
    category: 'Otro',
    date: '2026-01-01',
    ...overrides,
  }
}

describe('groupExpensesByCategory', () => {
  it('groups repeated expenses of the same category into one entry with a summed total and count', () => {
    const expenses = [
      expense({ id: 'a', category: 'Comida y bebida', amount: 5000 }),
      expense({ id: 'b', category: 'Comida y bebida', amount: 2000 }),
      expense({ id: 'c', category: 'Comida y bebida', amount: 1000 }),
    ]

    const groups = groupExpensesByCategory(expenses)

    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ category: 'Comida y bebida', total: 8000, count: 3 })
    expect(groups[0].expenses).toHaveLength(3)
  })

  it('keeps single expenses as their own group of one', () => {
    const expenses = [expense({ id: 'a', category: 'Entrada', amount: 15000 })]

    const groups = groupExpensesByCategory(expenses)

    expect(groups).toEqual([
      { category: 'Entrada', total: 15000, count: 1, expenses: [expenses[0]] },
    ])
  })

  it('sorts groups by total spent, highest first', () => {
    const expenses = [
      expense({ id: 'a', category: 'Merch', amount: 3000 }),
      expense({ id: 'b', category: 'Entrada', amount: 15000 }),
      expense({ id: 'c', category: 'Transporte', amount: 8000 }),
    ]

    const groups = groupExpensesByCategory(expenses)

    expect(groups.map((g) => g.category)).toEqual(['Entrada', 'Transporte', 'Merch'])
  })

  it('returns an empty array for no expenses', () => {
    expect(groupExpensesByCategory([])).toEqual([])
  })

  it('coerces string amounts (as Supabase numeric columns can arrive) before summing', () => {
    const expenses = [
      expense({ id: 'a', category: 'Comida y bebida', amount: '5000' as unknown as number }),
      expense({ id: 'b', category: 'Comida y bebida', amount: '2500.50' as unknown as number }),
    ]

    const groups = groupExpensesByCategory(expenses)

    expect(groups[0].total).toBe(7500.5)
  })
})
