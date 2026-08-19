import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/src/core/lib/env', () => ({
    getLastFmApiKey: vi.fn(),
}))

import { getLastFmUserTopArtists, getLastFmGeoTopArtists, getLastFmArtistTags } from '@/src/domains/taste/clients/lastfm'
import { getLastFmApiKey } from '@/src/core/lib/env'

describe('getLastFmUserTopArtists', () => {
    beforeEach(() => {
        vi.mocked(getLastFmApiKey).mockReturnValue('test-key')
        global.fetch = vi.fn()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('returns an error without fetching when not configured', async () => {
        vi.mocked(getLastFmApiKey).mockReturnValue(undefined)

        const result = await getLastFmUserTopArtists('someuser')

        expect(result).toEqual({ artists: null, error: 'LASTFM_API_KEY no configurado.' })
        expect(global.fetch).not.toHaveBeenCalled()
    })

    it('parses artists with their reported rank from @attr', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: () =>
                Promise.resolve({
                    topartists: {
                        artist: [
                            { name: 'Bandalos Chinos', playcount: '120', '@attr': { rank: '1' } },
                            { name: 'Usted Señálemelo', playcount: '80', '@attr': { rank: '2' } },
                        ],
                    },
                }),
        } as Response)

        const result = await getLastFmUserTopArtists('someuser')

        expect(result.artists).toEqual([
            { name: 'Bandalos Chinos', mbid: undefined, rank: 1, listeners: undefined, playcount: 120 },
            { name: 'Usted Señálemelo', mbid: undefined, rank: 2, listeners: undefined, playcount: 80 },
        ])
    })

    it('falls back to index + 1 when @attr.rank is missing', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: () =>
                Promise.resolve({
                    topartists: { artist: [{ name: 'Sin Rank' }, { name: 'Tampoco' }] },
                }),
        } as Response)

        const result = await getLastFmUserTopArtists('someuser')

        expect(result.artists?.map((a) => a.rank)).toEqual([1, 2])
    })

    it('passes next.revalidate = 86400 through to fetch', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ topartists: { artist: [] } }),
        } as Response)

        await getLastFmUserTopArtists('someuser')

        const init = vi.mocked(global.fetch).mock.calls[0][1] as RequestInit & { next?: { revalidate: number } }
        expect(init.next).toEqual({ revalidate: 86400 })
    })

    it('maps Last.fm error 29 to rateLimited and does not surface a raw error object', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ error: 29, message: 'Rate limit exceeded' }),
        } as Response)

        const result = await getLastFmUserTopArtists('someuser')

        expect(result).toEqual({ artists: null, error: 'Rate limit exceeded', rateLimited: true })
    })

    it('maps HTTP 429 to rateLimited', async () => {
        vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 429 } as Response)

        const result = await getLastFmUserTopArtists('someuser')

        expect(result).toEqual({
            artists: null,
            error: 'Last.fm respondió con error 429.',
            rateLimited: true,
        })
    })

    it('maps HTTP 403 to rateLimited', async () => {
        vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 403 } as Response)

        const result = await getLastFmUserTopArtists('someuser')

        expect(result).toEqual({
            artists: null,
            error: 'Last.fm respondió con error 403.',
            rateLimited: true,
        })
    })

    it('maps Last.fm error 6 to notFound', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ error: 6, message: 'User not found' }),
        } as Response)

        const result = await getLastFmUserTopArtists('someuser')

        expect(result).toEqual({ artists: null, error: 'User not found', notFound: true })
    })

    it('returns a generic error on other non-ok HTTP statuses', async () => {
        vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 503 } as Response)

        const result = await getLastFmUserTopArtists('someuser')

        expect(result).toEqual({ artists: null, error: 'Last.fm respondió con error 503.' })
    })
})

describe('getLastFmGeoTopArtists', () => {
    beforeEach(() => {
        vi.mocked(getLastFmApiKey).mockReturnValue('test-key')
        global.fetch = vi.fn()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('requests geo.gettopartists for Argentina by default', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ topartists: { artist: [] } }),
        } as Response)

        await getLastFmGeoTopArtists({ page: 1 })

        const calledUrl = vi.mocked(global.fetch).mock.calls[0][0] as string
        expect(calledUrl).toContain('method=geo.gettopartists')
        expect(calledUrl).toContain('country=Argentina')
        expect(calledUrl).toContain('page=1')
    })

    it('stops after a rate-limited response without throwing', async () => {
        vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 429 } as Response)

        const result = await getLastFmGeoTopArtists({ page: 2 })

        expect(result).toEqual({
            artists: null,
            error: 'Last.fm respondió con error 429.',
            rateLimited: true,
        })
    })
})

describe('getLastFmArtistTags', () => {
    beforeEach(() => {
        vi.mocked(getLastFmApiKey).mockReturnValue('test-key')
        global.fetch = vi.fn()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    it('requests artist.getinfo and returns the artist\'s raw tag names', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: () =>
                Promise.resolve({ artist: { tags: { tag: [{ name: 'indie rock' }, { name: 'seen live' }] } } }),
        } as Response)

        const result = await getLastFmArtistTags('Bandalos Chinos')

        const calledUrl = vi.mocked(global.fetch).mock.calls[0][0] as string
        expect(calledUrl).toContain('method=artist.getinfo')
        expect(calledUrl).toContain('artist=Bandalos')
        expect(result).toEqual({ tags: ['indie rock', 'seen live'] })
    })

    it('returns an empty tag list when the artist has none, without throwing', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ artist: {} }),
        } as Response)

        const result = await getLastFmArtistTags('Nadie')

        expect(result).toEqual({ tags: [] })
    })

    it('maps a rate-limited response the same way the top-artists calls do', async () => {
        vi.mocked(global.fetch).mockResolvedValue({ ok: false, status: 403 } as Response)

        const result = await getLastFmArtistTags('Cualquiera')

        expect(result).toEqual({ tags: null, error: 'Last.fm respondió con error 403.', rateLimited: true })
    })

    it('maps Last.fm error 6 (artist not found) to notFound', async () => {
        vi.mocked(global.fetch).mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({ error: 6, message: 'Artist not found' }),
        } as Response)

        const result = await getLastFmArtistTags('No Existe')

        expect(result).toEqual({ tags: null, error: 'Artist not found', notFound: true })
    })
})
