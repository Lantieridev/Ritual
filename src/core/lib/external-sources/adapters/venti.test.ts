import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ventiAdapter } from './venti'
import * as http from '@/src/core/lib/http'

vi.mock('@/src/core/lib/http', () => ({
  fetchWithRetry: vi.fn()
}))

describe('Venti Adapter', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('fetches and normalizes events', async () => {
    vi.mocked(http.fetchWithRetry).mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'v1', title: 'Venti Show', datetime: '2026-10-15T21:00:00', location: { name: 'Niceto', city: 'CABA' }, slug: 'venti-show' }
        ]
      })
    } as unknown as Response)

    const result = await ventiAdapter.search({ keyword: 'Venti' })
    
    expect(http.fetchWithRetry).toHaveBeenCalled()
    expect(result.events).toHaveLength(1)
    expect(result.events[0].title).toBe('Venti Show')
    expect(result.events[0].venue.name).toBe('Niceto')
    expect(result.events[0].url).toBe('https://venti.com.ar/event/venti-show')
  })

  it('handles API errors gracefully', async () => {
    vi.mocked(http.fetchWithRetry).mockResolvedValue({
      ok: false,
      status: 404
    } as unknown as Response)

    const result = await ventiAdapter.search({ keyword: 'Prueba' })
    
    expect(result.events).toHaveLength(0)
    expect(result.error).toContain('404')
  })
})
