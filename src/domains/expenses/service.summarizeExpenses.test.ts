import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetExpensesSummary = vi.fn()

vi.mock('@/src/domains/expenses/data', () => ({
  getExpensesSummary: (...args: unknown[]) => mockGetExpensesSummary(...args),
}))

import { summarizeExpenses } from '@/src/domains/expenses/service'
import type { ExpenseSummary } from '@/src/domains/expenses/service'

/*
 * Test de aprobación (perfil-mobile WU3): `summarizeExpenses` va a
 * envolverse en `cache()` de React por precaución, mismo criterio que
 * `listMyEvents` (D-7, coleccion-mobile) y `getStats` — aunque acá, a
 * diferencia de ese caso, ningún llamador actual la pide dos veces en la
 * misma request.
 * `cache()` sólo memoiza en el runtime real de Server Components; bajo
 * Vitest es un passthrough sin memoria, así que este test verifica la
 * delegación correcta (incluyendo el `userId` recibido), no la memoización
 * de `cache()` en sí — se escribe ANTES del envoltorio para probar que la
 * delegación se preserva intacta después del refactor.
 */
describe('summarizeExpenses', () => {
  beforeEach(() => {
    mockGetExpensesSummary.mockReset()
  })

  it('delega en getExpensesSummary con el userId dado y devuelve su resultado tal cual', async () => {
    const summary: ExpenseSummary = { total: 412000, byCategory: {}, byYear: { '2026': 412000 }, count: 3 }
    mockGetExpensesSummary.mockResolvedValue(summary)

    const result = await summarizeExpenses('u1')

    expect(mockGetExpensesSummary).toHaveBeenCalledWith('u1')
    expect(mockGetExpensesSummary).toHaveBeenCalledTimes(1)
    expect(result).toBe(summary)
  })
})
