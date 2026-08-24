import { describe, it, expect, vi, beforeEach } from 'vitest'
import { alpogoAdapter } from './alpogo'
import * as http from '@/src/core/lib/http'

vi.mock('@/src/core/lib/http', () => ({
  fetchWithRetry: vi.fn()
}))

describe('Alpogo Adapter', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('fetches and normalizes events', async () => {
    vi.mocked(http.fetchWithRetry).mockResolvedValue({
      ok: true,
      json: async () => ([
        { id: '123', name: 'Show de Prueba', date: '2026-12-01T20:00:00', venue: 'La Trastienda', city: 'CABA', url: 'https://alpogo.com/123' }
      ])
    } as unknown as Response)

    const result = await alpogoAdapter.search({ keyword: 'Prueba' })
    
    expect(http.fetchWithRetry).toHaveBeenCalled()
    expect(result.events).toHaveLength(1)
    expect(result.events[0].title).toBe('Show de Prueba')
    expect(result.events[0].venue.name).toBe('La Trastienda')
  })

  it('handles API errors gracefully', async () => {
    vi.mocked(http.fetchWithRetry).mockResolvedValue({
      ok: false,
      status: 500
    } as unknown as Response)

    const result = await alpogoAdapter.search({ keyword: 'Prueba' })
    
    expect(result.events).toHaveLength(0)
    expect(result.error).toContain('500')
  })
})
