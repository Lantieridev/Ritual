import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

import { getVenues, getVenueById, getVenueTipsBatch } from '@/src/domains/venues/data'

function makeQueryBuilder(result: { data: unknown; error: unknown }) {
  const builder: Record<string, unknown> = {}
  const chain = () => builder
  builder.select = vi.fn(chain)
  builder.eq = vi.fn(chain)
  builder.order = vi.fn(chain)
  builder.single = vi.fn(() => Promise.resolve(result))
  builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(onFulfilled, onRejected)
  return builder
}

describe('getVenues', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads through the session-aware client and returns the venue list', async () => {
    const venues = [{ id: 'v1', name: 'Niceto', city: 'CABA', country: 'AR', address: null, lat: null, lng: null }]
    const fromMock = vi.fn(() => makeQueryBuilder({ data: venues, error: null }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await getVenues()

    expect(mockCreateClient).toHaveBeenCalledTimes(1)
    expect(fromMock).toHaveBeenCalledWith('venues')
    expect(result).toEqual(venues)
  })

  it('returns an empty list when the query errors out', async () => {
    const fromMock = vi.fn(() => makeQueryBuilder({ data: null, error: { message: 'boom' } }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await getVenues()

    expect(result).toEqual([])
  })
})

describe('getVenueById', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('sorts the venue events by date descending', async () => {
    const venue = {
      id: 'v1',
      name: 'Niceto',
      city: 'CABA',
      country: 'AR',
      address: null,
      lat: null,
      lng: null,
      events: [
        { id: 'e-old', name: 'Show viejo', date: '2020-01-01', lineups: [] },
        { id: 'e-new', name: 'Show nuevo', date: '2024-01-01', lineups: [] },
      ],
    }
    const fromMock = vi.fn(() => makeQueryBuilder({ data: venue, error: null }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await getVenueById('v1')

    expect(result?.events.map((e) => e.id)).toEqual(['e-new', 'e-old'])
  })

  it('returns null when the venue does not exist', async () => {
    const fromMock = vi.fn(() => makeQueryBuilder({ data: null, error: null }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await getVenueById('missing')

    expect(result).toBeNull()
  })

  it('returns null when the query errors out', async () => {
    const fromMock = vi.fn(() => makeQueryBuilder({ data: null, error: { message: 'boom' } }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await getVenueById('v1')

    expect(result).toBeNull()
  })
})

describe('getVenueTipsBatch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  function makeTipsBuilder(result: { data: unknown; error: unknown }) {
    const builder: Record<string, unknown> = {}
    const chain = () => builder
    builder.select = vi.fn(chain)
    builder.in = vi.fn(chain)
    builder.order = vi.fn(chain)
    builder.then = (onFulfilled: (v: unknown) => unknown, onRejected?: (e: unknown) => unknown) =>
      Promise.resolve(result).then(onFulfilled, onRejected)
    return builder
  }

  it('devuelve [] para cada id sin llamar a la base cuando la lista viene vacía', async () => {
    const fromMock = vi.fn()
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await getVenueTipsBatch([])

    expect(result).toEqual([])
    expect(fromMock).not.toHaveBeenCalled()
  })

  it('agrupa los tips por venue_id, preservando el orden de los ids pedidos', async () => {
    const rows = [
      { id: 't1', venue_id: 'v2', category: 'cola', body: 'Llegá temprano', created_at: '2026-01-01' },
      { id: 't2', venue_id: 'v1', category: 'estacionamiento', body: 'Hay un estacionamiento a 2 cuadras', created_at: '2026-01-02' },
    ]
    const builder = makeTipsBuilder({ data: rows, error: null })
    const fromMock = vi.fn(() => builder)
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await getVenueTipsBatch(['v1', 'v2', 'v3'])

    expect(builder.in).toHaveBeenCalledWith('venue_id', ['v1', 'v2', 'v3'])
    expect(result).toEqual([
      [rows[1]], // v1
      [rows[0]], // v2
      [],        // v3, sin tips
    ])
  })

  it('devuelve listas vacías para cada id si la consulta falla', async () => {
    const builder = makeTipsBuilder({ data: null, error: { message: 'boom' } })
    const fromMock = vi.fn(() => builder)
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await getVenueTipsBatch(['v1', 'v2'])

    expect(result).toEqual([[], []])
  })
})

