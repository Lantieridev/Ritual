import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/src/core/lib/env', () => ({
  getSpotifyClientId: vi.fn(),
  getSpotifyClientSecret: vi.fn(),
}))

import {
  isSpotifyConfigured,
  searchSpotifyArtist,
  getBestSpotifyImage,
  type SpotifyImage,
} from '@/src/core/lib/spotify'
import { getSpotifyClientId, getSpotifyClientSecret } from '@/src/core/lib/env'

describe('isSpotifyConfigured', () => {
  it('requires both client id and secret', () => {
    vi.mocked(getSpotifyClientId).mockReturnValue('id')
    vi.mocked(getSpotifyClientSecret).mockReturnValue('secret')
    expect(isSpotifyConfigured()).toBe(true)

    vi.mocked(getSpotifyClientSecret).mockReturnValue(undefined)
    expect(isSpotifyConfigured()).toBe(false)

    vi.mocked(getSpotifyClientId).mockReturnValue(undefined)
    vi.mocked(getSpotifyClientSecret).mockReturnValue('secret')
    expect(isSpotifyConfigured()).toBe(false)
  })
})

describe('getBestSpotifyImage', () => {
  it('returns the first image (Spotify already orders largest first)', () => {
    const images: SpotifyImage[] = [
      { url: 'big.jpg', height: 640, width: 640 },
      { url: 'small.jpg', height: 64, width: 64 },
    ]
    expect(getBestSpotifyImage(images)).toBe('big.jpg')
  })

  it('returns null for an empty list', () => {
    expect(getBestSpotifyImage([])).toBeNull()
  })
})

describe('searchSpotifyArtist', () => {
  beforeEach(() => {
    vi.mocked(getSpotifyClientId).mockReturnValue('client-id')
    vi.mocked(getSpotifyClientSecret).mockReturnValue('client-secret')
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns an error without fetching a token when not configured', async () => {
    vi.mocked(getSpotifyClientId).mockReturnValue(undefined)

    const result = await searchSpotifyArtist('Bandalos Chinos')

    expect(result).toEqual({ artist: null, error: 'Spotify no configurado.' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('returns an error when the token request fails', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: false } as Response)

    const result = await searchSpotifyArtist('Bandalos Chinos')

    expect(result).toEqual({ artist: null, error: 'No se pudo obtener token de Spotify.' })
  })

  it('fetches a token then searches, returning the first matching artist', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ access_token: 'tok' }) } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ artists: { items: [{ id: 'a1', name: 'Bandalos Chinos' }] } }),
      } as Response)

    const result = await searchSpotifyArtist('Bandalos Chinos')

    expect(global.fetch).toHaveBeenNthCalledWith(
      1,
      'https://accounts.spotify.com/api/token',
      expect.objectContaining({ method: 'POST' })
    )
    expect(global.fetch).toHaveBeenNthCalledWith(
      2,
      expect.stringContaining('/search'),
      expect.objectContaining({ headers: { Authorization: 'Bearer tok' } })
    )
    expect(result).toEqual({ artist: { id: 'a1', name: 'Bandalos Chinos' } })
  })

  it('returns null artist (no error) when the search has no matches', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ access_token: 'tok' }) } as Response)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ artists: { items: [] } }) } as Response)

    const result = await searchSpotifyArtist('Nonexistent')

    expect(result).toEqual({ artist: null })
  })

  it('returns an error when the search request fails', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ access_token: 'tok' }) } as Response)
      .mockResolvedValueOnce({ ok: false, status: 500 } as Response)

    const result = await searchSpotifyArtist('Bandalos Chinos')

    expect(result).toEqual({ artist: null, error: 'Spotify respondió con error 500.' })
  })

  it('returns a friendly error when the search fetch throws', async () => {
    vi.mocked(global.fetch)
      .mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ access_token: 'tok' }) } as Response)
      .mockRejectedValueOnce(new Error('network down'))

    const result = await searchSpotifyArtist('Bandalos Chinos')

    expect(result).toEqual({ artist: null, error: 'Error al conectar con Spotify.' })
  })
})
