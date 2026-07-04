import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockGetMyEvents = vi.fn()

vi.mock('@/src/domains/events/data', () => ({
  getMyEvents: (...args: unknown[]) => mockGetMyEvents(...args),
}))

import { listMyEvents } from '@/src/domains/events/service'
import type { EventWithAttendance } from '@/src/domains/events/service'

/*
 * `listMyEvents` va envuelto en `cache()` de React (D-7, coleccion-mobile):
 * dentro de la misma request de `/coleccion`, la vista de escritorio
 * (ArtistsShelvesView) y la vista mobile (CollectionDiaryView) llamaban a
 * `listMyEvents()` cada una por su lado. Mismo criterio que
 * `getEventWeatherCached`/`getCurrentUserId`: `cache()` sólo memoiza en el
 * runtime real de Server Components — bajo Vitest (sin la condición
 * "react-server") es un passthrough sin memoria, así que este test verifica
 * la delegación correcta, no la memoización de `cache()` en sí.
 */
describe('listMyEvents', () => {
  beforeEach(() => {
    mockGetMyEvents.mockReset()
  })

  it('delega en getMyEvents y devuelve su resultado tal cual', async () => {
    const events = [{ id: 'ev1' }] as unknown as EventWithAttendance[]
    mockGetMyEvents.mockResolvedValue(events)

    const result = await listMyEvents()

    expect(mockGetMyEvents).toHaveBeenCalledTimes(1)
    expect(result).toBe(events)
  })
})
