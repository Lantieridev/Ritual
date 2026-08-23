import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/src/core/lib/env', () => ({
  getTicketmasterApiKey: vi.fn(),
}))

import { isTicketmasterConfigured, searchTicketmasterEvents } from '@/src/core/lib/ticketmaster'
import { getTicketmasterApiKey } from '@/src/core/lib/env'

describe('isTicketmasterConfigured', () => {
  it('reflects whether an API key is set', () => {
    vi.mocked(getTicketmasterApiKey).mockReturnValue('key')
    expect(isTicketmasterConfigured()).toBe(true)

    vi.mocked(getTicketmasterApiKey).mockReturnValue(undefined)
    expect(isTicketmasterConfigured()).toBe(false)
  })
})

describe('searchTicketmasterEvents', () => {
  beforeEach(() => {
    vi.mocked(getTicketmasterApiKey).mockReturnValue('test-key')
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns an error without fetching when not configured', async () => {
    vi.mocked(getTicketmasterApiKey).mockReturnValue(undefined)

    const result = await searchTicketmasterEvents({ keyword: 'Bandalos Chinos' })

    expect(result).toEqual({ events: [], total: 0, error: 'TICKETMASTER_API_KEY no configurado.' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns empty results without fetching when neither keyword nor city is given', async () => {
    const result = await searchTicketmasterEvents({})

    expect(result).toEqual({ events: [], total: 0 })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('searches by keyword and maps the response to FutureEvent', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          _embedded: {
            events: [
              {
                id: 'tm-1',
                name: 'Bandalos Chinos en Buenos Aires',
                url: 'https://ticketmaster.com/tm-1',
                dates: { start: { dateTime: '2024-05-01T23:00:00Z' } },
                priceRanges: [{ min: 5000, max: 15000, currency: 'ARS' }],
                classifications: [{ genre: { name: 'Rock' } }],
                images: [
                  { url: 'small.jpg', width: 300, ratio: '16_9' },
                  { url: 'big.jpg', width: 1024, ratio: '16_9' },
                ],
                _embedded: {
                  venues: [{ name: 'Movistar Arena', city: { name: 'Buenos Aires' }, country: { name: 'Argentina' } }],
                  attractions: [{ name: 'Bandalos Chinos' }],
                },
              },
            ],
          },
          page: { size: 20, totalElements: 1, totalPages: 1, number: 0 },
        }),
    } as Response)

    const result = await searchTicketmasterEvents({ keyword: 'Bandalos Chinos' })

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('keyword=Bandalos+Chinos'),
      expect.anything()
    )
    expect(result.events).toEqual([
      {
        id: 'tm-1',
        title: 'Bandalos Chinos en Buenos Aires',
        datetime: '2024-05-01T23:00:00Z',
        venue: { name: 'Movistar Arena', city: 'Buenos Aires', country: 'Argentina' },
        lineup: ['Bandalos Chinos'],
        url: 'https://ticketmaster.com/tm-1',
        image: 'big.jpg',
        priceRange: { min: 5000, max: 15000, currency: 'ARS' },
        genre: 'Rock',
      },
    ])
    expect(result.total).toBe(1)
  })

  it('searches by city', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ page: { size: 20, totalElements: 0, totalPages: 0, number: 0 } }),
    } as Response)

    await searchTicketmasterEvents({ city: 'Buenos Aires' })

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('city=Buenos+Aires'),
      expect.anything()
    )
  })

  it('returns an empty list (not an error) when Ticketmaster has no results for the query', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ page: { size: 20, totalElements: 0, totalPages: 0, number: 0 } }),
    } as Response)

    const result = await searchTicketmasterEvents({ keyword: 'Artista Inexistente' })

    expect(result).toEqual({ events: [], total: 0 })
  })

  it('falls back to a local-date/time datetime when dateTime is absent', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          _embedded: {
            events: [
              {
                id: 'tm-2',
                name: 'Show sin dateTime',
                dates: { start: { localDate: '2024-06-15', localTime: '21:30:00' } },
                _embedded: { venues: [{ name: 'Niceto' }] },
              },
            ],
          },
          page: { size: 20, totalElements: 1, totalPages: 1, number: 0 },
        }),
    } as Response)

    const result = await searchTicketmasterEvents({ keyword: 'x' })

    expect(result.events[0].datetime).toBe('2024-06-15T21:30:00')
  })

  it('falls back to venue/lineup defaults when the venue or attractions are missing', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () =>
        Promise.resolve({
          _embedded: {
            events: [
              { id: 'tm-3', name: 'Show sin venue', dates: { start: { dateTime: '2024-05-01T20:00:00Z' } } },
            ],
          },
          page: { size: 20, totalElements: 1, totalPages: 1, number: 0 },
        }),
    } as Response)

    const result = await searchTicketmasterEvents({ keyword: 'x' })

    expect(result.events[0].venue.name).toBe('Sede desconocida')
    expect(result.events[0].lineup).toEqual([])
  })

  it('returns a specific error for an invalid API key (401/403)', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 401 } as Response)

    const result = await searchTicketmasterEvents({ keyword: 'x' })

    expect(result.error).toContain('API Key inválida')
  })

  it('returns a specific error when rate-limited', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 429 } as Response)

    const result = await searchTicketmasterEvents({ keyword: 'x' })

    expect(result.error).toContain('Límite')
  })

  it('returns a friendly error when fetch throws', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('network down'))

    const result = await searchTicketmasterEvents({ keyword: 'x' })

    expect(result).toEqual({ events: [], total: 0, error: 'Error al conectar con Ticketmaster.' })
  })

  it('returns a specific error when the request times out', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new DOMException('Aborted', 'AbortError'))

    const result = await searchTicketmasterEvents({ keyword: 'x' })

    expect(result).toEqual({
      events: [],
      total: 0,
      error: 'Ticketmaster tardó demasiado en responder. Probá de nuevo.',
    })
  })
})
