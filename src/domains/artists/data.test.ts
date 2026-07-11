import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockCreateClient = vi.fn()

vi.mock('@/src/core/lib/supabase/server', () => ({
  createClient: () => mockCreateClient(),
}))

import { getArtists, getArtistById } from '@/src/domains/artists/data'

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

describe('getArtists', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('reads through the session-aware client and returns the artist list', async () => {
    const artists = [{ id: 'a1', name: 'Bandalos Chinos', genre: 'Indie', image_url: null, spotify_id: null }]
    const fromMock = vi.fn(() => makeQueryBuilder({ data: artists, error: null }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await getArtists()

    expect(mockCreateClient).toHaveBeenCalledTimes(1)
    expect(fromMock).toHaveBeenCalledWith('artists')
    expect(result).toEqual(artists)
  })

  it('returns an empty list when the query errors out', async () => {
    const fromMock = vi.fn(() => makeQueryBuilder({ data: null, error: { message: 'boom' } }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await getArtists()

    expect(result).toEqual([])
  })
})

describe('getArtistById', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('flattens the lineup->events join and sorts by date descending', async () => {
    const artist = {
      id: 'a1',
      name: 'Bandalos Chinos',
      genre: 'Indie',
      image_url: null,
      spotify_id: null,
      lineups: [
        { events: { id: 'e-old', name: 'Show viejo', date: '2020-01-01', venues: null, event_photos: [] } },
        { events: { id: 'e-new', name: 'Show nuevo', date: '2024-01-01', venues: null, event_photos: [] } },
        { events: null },
      ],
    }
    const fromMock = vi.fn(() => makeQueryBuilder({ data: artist, error: null }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await getArtistById('a1')

    expect(result?.events.map((e) => e.id)).toEqual(['e-new', 'e-old'])
  })

  it('returns null when the artist does not exist', async () => {
    const fromMock = vi.fn(() => makeQueryBuilder({ data: null, error: null }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await getArtistById('missing')

    expect(result).toBeNull()
  })

  it('returns null when the query errors out', async () => {
    const fromMock = vi.fn(() => makeQueryBuilder({ data: null, error: { message: 'boom' } }))
    mockCreateClient.mockReturnValue(Promise.resolve({ from: fromMock }))

    const result = await getArtistById('a1')

    expect(result).toBeNull()
  })
})
