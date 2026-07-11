import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))

vi.mock('@/src/core/lib/env', () => ({
  getLastFmApiKey: vi.fn(),
}))

import {
  isLastFmConfigured,
  getBestLastFmImage,
  getLastFmTags,
  getLastFmArtistInfo,
  getArtistEvents,
  type LastFmArtist,
  type LastFmImage,
} from '@/src/core/lib/lastfm'
import { getLastFmApiKey } from '@/src/core/lib/env'

describe('isLastFmConfigured', () => {
  it('reflects whether an API key is set', () => {
    vi.mocked(getLastFmApiKey).mockReturnValue('key')
    expect(isLastFmConfigured()).toBe(true)

    vi.mocked(getLastFmApiKey).mockReturnValue(undefined)
    expect(isLastFmConfigured()).toBe(false)
  })
})

describe('getBestLastFmImage', () => {
  const img = (size: LastFmImage['size'], text: string): LastFmImage => ({ '#text': text, size })

  it('prefers extralarge over other sizes', () => {
    const images = [img('small', 's'), img('extralarge', 'xl'), img('mega', 'mg')]
    expect(getBestLastFmImage(images)).toBe('xl')
  })

  it('falls back down the priority list when higher sizes are missing or empty', () => {
    const images = [img('small', 's'), img('large', ''), img('medium', 'm')]
    expect(getBestLastFmImage(images)).toBe('m')
  })

  it('returns null when no image has usable content', () => {
    expect(getBestLastFmImage([img('small', '')])).toBeNull()
    expect(getBestLastFmImage([])).toBeNull()
  })
})

describe('getLastFmTags', () => {
  it('extracts up to `max` tag names', () => {
    const artist = {
      tags: { tag: [{ name: 'rock', url: '' }, { name: 'indie', url: '' }, { name: 'pop', url: '' }] },
    } as LastFmArtist
    expect(getLastFmTags(artist, 2)).toEqual(['rock', 'indie'])
  })

  it('defaults max to 5 and handles missing tags', () => {
    expect(getLastFmTags({} as LastFmArtist)).toEqual([])
  })
})

describe('getLastFmArtistInfo', () => {
  beforeEach(() => {
    vi.mocked(getLastFmApiKey).mockReturnValue('test-key')
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns an error without fetching when not configured', async () => {
    vi.mocked(getLastFmApiKey).mockReturnValue(undefined)

    const result = await getLastFmArtistInfo('Bandalos Chinos')

    expect(result).toEqual({ artist: null, error: 'LASTFM_API_KEY no configurado.' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns the artist on a successful response', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ artist: { name: 'Bandalos Chinos' } }),
    } as Response)

    const result = await getLastFmArtistInfo('Bandalos Chinos')

    expect(result.artist).toEqual({ name: 'Bandalos Chinos' })
  })

  it('returns an error when Last.fm responds with a non-ok status', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 503 } as Response)

    const result = await getLastFmArtistInfo('Bandalos Chinos')

    expect(result).toEqual({ artist: null, error: 'Last.fm respondió con error 503.' })
  })

  it('returns an error when Last.fm returns an API-level error in the body', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ error: 6, message: 'Artist not found' }),
    } as Response)

    const result = await getLastFmArtistInfo('Nonexistent Artist')

    expect(result).toEqual({ artist: null, error: 'Artist not found' })
  })

  it('returns a friendly error when fetch throws', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('network down'))

    const result = await getLastFmArtistInfo('Bandalos Chinos')

    expect(result).toEqual({ artist: null, error: 'Error al conectar con Last.fm.' })
  })
})

describe('getArtistEvents', () => {
  beforeEach(() => {
    vi.mocked(getLastFmApiKey).mockReturnValue('test-key')
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns an error without fetching when not configured', async () => {
    vi.mocked(getLastFmApiKey).mockReturnValue(undefined)

    const result = await getArtistEvents('Bandalos Chinos')

    expect(result).toEqual({ events: [], error: 'LASTFM_API_KEY no configurado.' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns an empty list (no error) on a 404, since that usually just means no events', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ status: 404, ok: false } as Response)

    const result = await getArtistEvents('Bandalos Chinos')

    expect(result).toEqual({ events: [] })
  })

  it('returns an empty list for Last.fm error code 6 (artist not found)', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({ error: 6, message: 'Artist not found' }),
    } as Response)

    const result = await getArtistEvents('Nonexistent')

    expect(result).toEqual({ events: [] })
  })

  it('maps raw Last.fm events to the unified FutureEvent shape and filters out past events', async () => {
    const future = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toUTCString()
    const past = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toUTCString()

    vi.mocked(global.fetch).mockResolvedValue({
      status: 200,
      ok: true,
      json: () =>
        Promise.resolve({
          events: {
            event: [
              {
                id: '1',
                title: 'Show futuro',
                artists: { artist: 'Bandalos Chinos', headliner: 'Bandalos Chinos' },
                venue: { name: 'Niceto', location: { city: 'CABA', country: 'AR' } },
                startDate: future,
                image: [],
                url: 'https://last.fm/event/1',
              },
              {
                id: '2',
                title: 'Show pasado',
                artists: { artist: 'Bandalos Chinos', headliner: 'Bandalos Chinos' },
                venue: { name: 'Niceto', location: { city: 'CABA', country: 'AR' } },
                startDate: past,
                image: [],
                url: 'https://last.fm/event/2',
              },
            ],
          },
        }),
    } as Response)

    const result = await getArtistEvents('Bandalos Chinos')

    expect(result.events).toHaveLength(1)
    expect(result.events[0]).toMatchObject({
      id: '1',
      title: 'Show futuro',
      venue: { name: 'Niceto', city: 'CABA', country: 'AR' },
      lineup: ['Bandalos Chinos'],
    })
  })

  it('falls back to "headliner en venue" when the event has no title', async () => {
    const future = new Date(Date.now() + 1000 * 60 * 60).toUTCString()
    vi.mocked(global.fetch).mockResolvedValue({
      status: 200,
      ok: true,
      json: () =>
        Promise.resolve({
          events: {
            event: [
              {
                id: '1',
                title: '',
                artists: { artist: 'Bandalos Chinos', headliner: 'Bandalos Chinos' },
                venue: { name: 'Niceto', location: {} },
                startDate: future,
                image: [],
                url: '',
              },
            ],
          },
        }),
    } as Response)

    const result = await getArtistEvents('Bandalos Chinos')

    expect(result.events[0].title).toBe('Bandalos Chinos en Niceto')
  })

  it('returns an empty list when the response has no events array', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      status: 200,
      ok: true,
      json: () => Promise.resolve({}),
    } as Response)

    const result = await getArtistEvents('Bandalos Chinos')

    expect(result).toEqual({ events: [] })
  })

  it('returns a friendly error when fetch throws', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('network down'))

    const result = await getArtistEvents('Bandalos Chinos')

    expect(result).toEqual({ events: [], error: 'Error al conectar con Last.fm.' })
  })
})
