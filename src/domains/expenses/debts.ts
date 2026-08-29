/**
 * Pura, sin I/O — mismo criterio que aggregate.ts/achievements.ts. Split por
 * partes iguales entre quien pagó y cada tageado (issue #58): no resuelve
 * pagos reales, sólo el cálculo de "quién le debe cuánto a quién" que pide
 * el propio issue como criterio de aceptación.
 *
 * No neta deudas cruzadas entre dos personas en distintos eventos (si A le
 * debe a B por un gasto y B le debe a A por otro, esto no las cancela) — el
 * alcance es "por evento", no un balance general entre usuarios.
 */
export interface ExpenseForDebt {
    user_id: string
    amount: number
    splits: Array<{ user_id: string }>
}

export interface Debt {
    from_user_id: string
    to_user_id: string
    amount: number
}

export function computeDebts(expenses: ExpenseForDebt[]): Debt[] {
    const totals = new Map<string, number>()

    for (const expense of expenses) {
        if (expense.splits.length === 0) continue
        const participants = expense.splits.length + 1
        const perPerson = expense.amount / participants

        for (const split of expense.splits) {
            const key = `${split.user_id}|${expense.user_id}`
            totals.set(key, (totals.get(key) ?? 0) + perPerson)
        }
    }

    return Array.from(totals.entries()).map(([key, amount]) => {
        const [from_user_id, to_user_id] = key.split('|')
        return { from_user_id, to_user_id, amount: Math.round(amount * 100) / 100 }
    })
}
