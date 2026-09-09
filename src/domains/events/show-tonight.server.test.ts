import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCookiesGet = vi.fn()

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({ get: mockCookiesGet })),
}))

vi.mock('@/src/domains/events/service', () => ({
  findShowTonight: vi.fn(),
}))

vi.mock('@/src/domains/events/dev-banda', () => ({
  DEV_BANDA_COOKIE: 'ritual-dev-banda',
  isDevBandaAllowed: vi.fn(() => false),
}))

vi.mock('@/src/core/auth/session', () => ({
  getCurrentUserId: vi.fn(),
}))

import { loadBandaAction } from '@/src/domains/events/show-tonight.server'
import { findShowTonight } from '@/src/domains/events/service'
import { isDevBandaAllowed } from '@/src/domains/events/dev-banda'
import { getCurrentUserId } from '@/src/core/auth/session'

/**
 * `loadBandaAction` es el único punto donde el layout raíz toca la banda de
 * "Tu entrada de hoy" (issue #82) — no puede romper el render de NINGUNA
 * ruta, así que su contrato es "nunca rechaza" (R1-002). Reusa el `userId`
 * que el layout ya resolvió: nunca vuelve a llamar a `auth.getUser()`.
 */
describe('loadBandaAction', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCookiesGet.mockReturnValue(undefined)
    vi.mocked(isDevBandaAllowed).mockReturnValue(false)
  })

  it('con userId null y sin cookie de dev, no consulta el show y devuelve undefined', async () => {
    const result = await loadBandaAction(null)

    expect(findShowTonight).not.toHaveBeenCalled()
    expect(result).toBeUndefined()
  })

  it('devuelve el link cuando hay un show esta noche', async () => {
    vi.mocked(findShowTonight).mockResolvedValue({ id: 'e1', headliner: 'Divididos', date: '2026-07-21T21:00:00-03:00' })

    const result = await loadBandaAction('user-1')

    expect(findShowTonight).toHaveBeenCalledWith('user-1')
    expect(result).toEqual({
      subtitle: 'Tu entrada de hoy',
      title: 'Divididos · 21:00',
      actionLabel: 'Abrir',
      href: '/?entrada=hoy',
    })
  })

  it('devuelve undefined cuando no hay show esta noche', async () => {
    vi.mocked(findShowTonight).mockResolvedValue(null)

    await expect(loadBandaAction('user-1')).resolves.toBeUndefined()
  })

  it('devuelve undefined y loguea el error si la consulta rechaza — nunca rompe el layout', async () => {
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.mocked(findShowTonight).mockRejectedValue(new Error('db down'))

    await expect(loadBandaAction('user-1')).resolves.toBeUndefined()
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })

  it('devuelve undefined cuando el show resuelve null por datos malformados (mismo camino que "sin show")', async () => {
    // pickShowTonight (dentro de findShowTonight) ya descarta filas
    // malformadas devolviendo null — loadBandaAction no distingue ese caso
    // del de "no hay show", ambos degradan igual.
    vi.mocked(findShowTonight).mockResolvedValue(null)

    await expect(loadBandaAction('user-1')).resolves.toBeUndefined()
  })

  it('nunca llama a auth.getUser() (getCurrentUserId) — reusa el id que ya resolvió el layout', async () => {
    vi.mocked(findShowTonight).mockResolvedValue(null)

    await loadBandaAction('user-1')

    expect(getCurrentUserId).not.toHaveBeenCalled()
  })

  it('el cookie de dev sólo habilita a través de isDevBandaAllowed, sin consultar el show real', async () => {
    vi.mocked(isDevBandaAllowed).mockReturnValue(true)

    const result = await loadBandaAction(null)

    expect(findShowTonight).not.toHaveBeenCalled()
    expect(result).toMatchObject({ actionLabel: 'Abrir', href: '/?entrada=hoy' })
  })
})
