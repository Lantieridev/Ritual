import { describe, it, expect, vi, afterEach } from 'vitest'
import { OFFLINE_ROUTES, warmOfflineRoutes } from './warm-cache'

afterEach(() => vi.unstubAllGlobals())

describe('warmOfflineRoutes', () => {
  it('fetches every offline route so the service worker can cache it', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    const fetchFn = vi.fn().mockResolvedValue(new Response('ok'))

    await warmOfflineRoutes(fetchFn)

    expect(fetchFn.mock.calls.map(([url]) => url)).toEqual([...OFFLINE_ROUTES])
  })

  it('does nothing while offline', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const fetchFn = vi.fn()

    await warmOfflineRoutes(fetchFn)

    expect(fetchFn).not.toHaveBeenCalled()
  })

  it('never throws when a fetch fails', async () => {
    vi.stubGlobal('navigator', { onLine: true })
    const fetchFn = vi.fn().mockRejectedValue(new Error('offline'))

    await expect(warmOfflineRoutes(fetchFn)).resolves.toBeUndefined()
  })
})
