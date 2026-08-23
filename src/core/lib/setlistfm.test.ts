import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/src/core/lib/env', () => ({
  getSetlistFmApiKey: vi.fn(),
}))

import {
  isSetlistFmConfigured,
  getSetlistsByArtist,
  parseSetlistDate,
  normalizeSetlist,
  type Setlist,
} from '@/src/core/lib/setlistfm'
import { getSetlistFmApiKey } from '@/src/core/lib/env'

describe('isSetlistFmConfigured', () => {
  it('reflects whether an API key is set', () => {
    vi.mocked(getSetlistFmApiKey).mockReturnValue('key')
    expect(isSetlistFmConfigured()).toBe(true)

    vi.mocked(getSetlistFmApiKey).mockReturnValue(undefined)
    expect(isSetlistFmConfigured()).toBe(false)
  })
})

describe('parseSetlistDate', () => {
  it('converts DD-MM-YYYY to YYYY-MM-DD', () => {
    expect(parseSetlistDate('25-12-2024')).toBe('2024-12-25')
  })
})

describe('normalizeSetlist', () => {
  it('flattens songs, builds a title, and maps venue/lineup fields', () => {
    const setlist: Setlist = {
      id: 'sl-1',
      eventDate: '25-12-2024',
      artist: { mbid: '', name: 'Bandalos Chinos', sortName: '', url: '' },
      venue: {
        id: 'v1',
        name: 'Niceto',
        city: { id: 'c1', name: 'CABA', country: { code: 'AR', name: 'Argentina' } },
      },
      sets: {
        set: [
          { song: [{ name: 'Cumbia Rara' }, { name: 'Ela' }] },
          { encore: 1, song: [{ name: 'La Diabla' }] },
        ],
      },
      url: 'https://setlist.fm/sl-1',
      lastUpdated: '',
    }

    const result = normalizeSetlist(setlist)

    expect(result).toMatchObject({
      id: 'sl-1',
      title: 'Bandalos Chinos @ Niceto',
      datetime: '2024-12-25T00:00:00Z',
      venue: { name: 'Niceto', city: 'CABA', country: 'Argentina' },
      lineup: ['Bandalos Chinos'],
      setlist: ['Cumbia Rara', 'Ela', 'La Diabla'],
      totalSongs: 3,
    })
  })
})

describe('getSetlistsByArtist', () => {
  beforeEach(() => {
    vi.mocked(getSetlistFmApiKey).mockReturnValue('test-key')
    global.fetch = vi.fn()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns an error without fetching when not configured', async () => {
    vi.mocked(getSetlistFmApiKey).mockReturnValue(undefined)

    const result = await getSetlistsByArtist('Bandalos Chinos')

    expect(result).toEqual({ setlists: [], total: 0, error: 'SETLISTFM_API_KEY no configurado.' })
    expect(global.fetch).not.toHaveBeenCalled()
  })

  it('sends the api key header and returns parsed setlists', async () => {
    vi.mocked(global.fetch).mockResolvedValue({
      ok: true,
      status: 200,
      json: () => Promise.resolve({ setlist: [{ id: 'sl-1' }], total: 1 }),
    } as Response)

    const result = await getSetlistsByArtist('Bandalos Chinos')

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/search/setlists'),
      expect.objectContaining({ headers: expect.objectContaining({ 'x-api-key': 'test-key' }) })
    )
    expect(result).toEqual({ setlists: [{ id: 'sl-1' }], total: 1 })
  })

  it('returns a specific error for an invalid API key (401/403)', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 401 } as Response)

    const result = await getSetlistsByArtist('Bandalos Chinos')

    expect(result.error).toContain('API Key inválida')
  })

  it('returns an empty result without an error on a 404 (no setlists found)', async () => {
    vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 404 } as Response)

    const result = await getSetlistsByArtist('Bandalos Chinos')

    expect(result).toEqual({ setlists: [], total: 0 })
  })

  it('returns a friendly error when fetch throws', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new Error('network down'))

    const result = await getSetlistsByArtist('Bandalos Chinos')

    expect(result.error).toBe('Error al conectar con Setlist.fm.')
  })

  it('returns a specific error when the request times out', async () => {
    vi.mocked(global.fetch).mockRejectedValue(new DOMException('Aborted', 'AbortError'))

    const result = await getSetlistsByArtist('Bandalos Chinos')

    expect(result.error).toBe('Setlist.fm tardó demasiado en responder. Probá de nuevo.')
  })
})
