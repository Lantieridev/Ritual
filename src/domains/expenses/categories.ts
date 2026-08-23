/**
 * Single source of truth for expense categories — name, icon, color.
 *
 * Before this, ExpenseForm's category list and app/expenses/page.tsx's
 * icon/color lookup were two independent lists that only agreed on
 * "Entrada" — every other category a user could actually pick fell back
 * to the generic "Otro" icon/color in the summary and category breakdown.
 */
export interface ExpenseCategory {
    name: string
    icon: string
    color: string
}

export const EXPENSE_CATEGORIES: ExpenseCategory[] = [
    { name: 'Entrada', icon: '🎟️', color: 'bg-violet-500/20 text-violet-300 border-violet-500/30' },
    { name: 'Transporte', icon: '🚌', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
    { name: 'Alojamiento', icon: '🏨', color: 'bg-teal-500/20 text-teal-300 border-teal-500/30' },
    // "Comida y bebida", not split — see issue #7: almost always bought
    // together in the same transaction (choripán + gaseosa, birra + picada).
    // Estacionamiento queda dentro de "Transporte", sin subcategoría propia.
    { name: 'Comida y bebida', icon: '🍔', color: 'bg-orange-500/20 text-orange-300 border-orange-500/30' },
    { name: 'Merch', icon: '👕', color: 'bg-pink-500/20 text-pink-300 border-pink-500/30' },
    { name: 'Otro', icon: '💸', color: 'bg-zinc-500/20 text-zinc-300 border-zinc-500/30' },
]

const DEFAULT_CATEGORY = EXPENSE_CATEGORIES[EXPENSE_CATEGORIES.length - 1]

export function getExpenseCategory(name: string): ExpenseCategory {
    return EXPENSE_CATEGORIES.find((c) => c.name === name) ?? DEFAULT_CATEGORY
}
