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
