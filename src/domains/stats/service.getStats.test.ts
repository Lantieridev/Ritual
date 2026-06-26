import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetPersonalStats = vi.fn()

vi.mock('@/src/domains/stats/data', () => ({
  getPersonalStats: (...args: unknown[]) => mockGetPersonalStats(...args),
}))

import { getStats } from '@/src/domains/stats/service'
import type { StatsData } from '@/src/domains/stats/service'

/*
 * Test de aprobación (perfil-mobile WU3): `getStats` va a envolverse en
 * `cache()` de React por precaución, mismo criterio que `listMyEvents` (D-7,
 * coleccion-mobile) — aunque acá, a diferencia de ese caso, ningún llamador
 * actual la pide dos veces en la misma request.
 * `cache()` sólo memoiza en el runtime real de Server Components; bajo
 * Vitest (sin la condición "react-server") es un passthrough sin memoria,
 * así que este test verifica la delegación correcta, no la memoización de
 * `cache()` en sí — se escribe ANTES del envoltorio para probar que la
 * delegación se preserva intacta después del refactor.
 */
describe('getStats', () => {
  beforeEach(() => {
    mockGetPersonalStats.mockReset()
  })

  it('delega en getPersonalStats y devuelve su resultado tal cual', async () => {
    const stats = { totalShows: 5 } as unknown as StatsData
    mockGetPersonalStats.mockResolvedValue(stats)

    const result = await getStats()

    expect(mockGetPersonalStats).toHaveBeenCalledTimes(1)
    expect(result).toBe(stats)
  })
})
