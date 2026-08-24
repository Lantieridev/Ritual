import { describe, it, expect, vi, beforeEach } from 'vitest'
import { quehacemosAdapter } from './quehacemos'
import * as http from '@/src/core/lib/http'

vi.mock('@/src/core/lib/http', () => ({
  fetchWithRetry: vi.fn()
}))

describe('Quehacemos Adapter', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  it('fetches and normalizes events', async () => {
    vi.mocked(http.fetchWithRetry).mockResolvedValue({
      ok: true,
      json: async () => ([
        { 
          id: 47399, 
          title: 'Luisina Kippes presenta su Gira', 
          date: '2026-08-26T21:00:00', 
          venue: 'FOYER - Casa de la Cultura', 
          city: 'Ushuaia', 
          link: 'https://alpogo.com/evento/luisina'
        }
      ])
    } as unknown as Response)

    const result = await quehacemosAdapter.search({ keyword: 'Luisina' })
    
    expect(http.fetchWithRetry).toHaveBeenCalled()
    expect(result.events).toHaveLength(1)
    expect(result.events[0].title).toBe('Luisina Kippes presenta su Gira')
    expect(result.events[0].venue.city).toBe('Ushuaia')
    expect(result.events[0].url).toBe('https://alpogo.com/evento/luisina')
  })

  it('handles API errors gracefully', async () => {
    vi.mocked(http.fetchWithRetry).mockRejectedValue(new Error('Network error'))

    const result = await quehacemosAdapter.search({ keyword: 'Prueba' })
    
    expect(result.events).toHaveLength(0)
    expect(result.error).toContain('Failed to fetch')
  })
})
