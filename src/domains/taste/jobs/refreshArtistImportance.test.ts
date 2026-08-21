import { describe, it, expect, vi, beforeEach } from 'vitest'

const isLastFmConfigured = vi.fn()
const getLastFmGeoTopArtists = vi.fn()
const getLastFmArtistTags = vi.fn()

vi.mock('@/src/core/lib/lastfm', () => ({ isLastFmConfigured: () => isLastFmConfigured() }))
vi.mock('@/src/domains/taste/clients/lastfm', () => ({
    getLastFmGeoTopArtists: (...args: unknown[]) => getLastFmGeoTopArtists(...args),
    getLastFmArtistTags: (...args: unknown[]) => getLastFmArtistTags(...args),
}))

import { refreshArtistImportance } from './refreshArtistImportance'
import { computeArtistImportance } from '@/src/domains/taste/importance'

const RUN_START = new Date('2026-08-19T12:00:00.000Z')
const NOW_WITHIN_BUDGET = () => RUN_START.getTime() + 1_000

function geoPage(names: string[]) {
    return { artists: names.map((name, i) => ({ name, rank: i + 1, listeners: 1000 - i })) }
}

/**
 * A minimal multi-table Supabase double. `select(...)` without `.in`/`.eq`
 * resolves directly (thenable) so a bare `await supabase.from(x).select(y)`
 * works for the "read everything" queries (stale-artist listing, vocabulary).
 */
function makeSupabase(opts: {
    matchedByNameKey?: Record<string, string> // name_key -> artist id, for geo matching
    allArtists?: Array<{ id: string; name: string }>
    taggedRefreshedAt?: Record<string, string> // artist id -> ISO refreshed_at (source='lastfm')
    wentCounts?: Array<{ artist_id: string; went_count: number }>
    aliasRows?: Array<{ alias: string; genre_key: string | null }>
    genreRows?: Array<{ key: string }>
}) {
    const importanceUpsert = vi.fn().mockResolvedValue({ error: null })
    const genresUpsert = vi.fn().mockResolvedValue({ error: null })
    const rpc = vi.fn().mockResolvedValue({ data: opts.wentCounts ?? [], error: null })

    function thenable<T>(value: T) {
        return { then: (resolve: (v: T) => void) => resolve(value) }
    }

    const from = vi.fn((table: string) => {
        if (table === 'artists') {
            return {
                select: (_cols: string) => ({
                    in: (_col: string, keys: string[]) => {
                        const matched = keys
                            .filter((k) => opts.matchedByNameKey?.[k])
                            .map((k) => ({ id: opts.matchedByNameKey![k], name_key: k }))
                        return Promise.resolve({ data: matched, error: null })
                    },
                    then: (resolve: (v: { data: unknown; error: null }) => void) =>
                        resolve({ data: opts.allArtists ?? [], error: null }),
                }),
            }
        }
        if (table === 'artist_importance') {
            return { upsert: importanceUpsert }
        }
        if (table === 'artist_genres') {
            return {
                select: (_cols: string) => ({
                    eq: (_col: string, _val: string) => {
                        const rows = Object.entries(opts.taggedRefreshedAt ?? {}).map(([artist_id, refreshed_at]) => ({
                            artist_id,
                            refreshed_at,
                        }))
                        return Promise.resolve({ data: rows, error: null })
                    },
                }),
                upsert: genresUpsert,
            }
        }
        if (table === 'genre_aliases') {
            return { select: (_cols: string) => thenable({ data: opts.aliasRows ?? [], error: null }) }
        }
        if (table === 'genres') {
            return { select: (_cols: string) => thenable({ data: opts.genreRows ?? [], error: null }) }
        }
        throw new Error(`unexpected table ${table}`)
    })

    return { from, rpc, importanceUpsert, genresUpsert }
}

describe('refreshArtistImportance', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        isLastFmConfigured.mockReturnValue(true)
        getLastFmGeoTopArtists.mockResolvedValue({ artists: [] })
        getLastFmArtistTags.mockResolvedValue({ tags: [] })
    })

    it('no-ops with ok=true and zero external calls when LASTFM_API_KEY is not configured', async () => {
        isLastFmConfigured.mockReturnValue(false)
        const supabase = makeSupabase({})

        const result = await refreshArtistImportance(supabase as never, {
            runStart: RUN_START,
            throttle: vi.fn(),
            now: NOW_WITHIN_BUDGET,
        })

        expect(result).toEqual({
            ok: true,
            details: {
                geo_pages_processed: 0,
                geo_pages_failed: 0,
                geo_artists_matched: 0,
                tag_artists_processed: 0,
                unmapped_tags: 0,
                stopped_reason: 'lastfm_unconfigured',
            },
        })
        expect(getLastFmGeoTopArtists).not.toHaveBeenCalled()
    })

    it('fetches 4 geo pages of 50, matches artists against the catalog, and upserts their peso', async () => {
        getLastFmGeoTopArtists
            .mockResolvedValueOnce(geoPage(['Artist A']))
            .mockResolvedValueOnce(geoPage(['Artist B']))
            .mockResolvedValueOnce(geoPage([]))
            .mockResolvedValueOnce(geoPage([]))
        const supabase = makeSupabase({ matchedByNameKey: { 'artist a': 'a-id' } })

        const result = await refreshArtistImportance(supabase as never, {
            runStart: RUN_START,
            throttle: vi.fn(),
            now: NOW_WITHIN_BUDGET,
        })

        expect(getLastFmGeoTopArtists).toHaveBeenCalledTimes(4)
        expect(getLastFmGeoTopArtists).toHaveBeenNthCalledWith(1, { country: 'Argentina', limit: 50, page: 1 })
        expect(getLastFmGeoTopArtists).toHaveBeenNthCalledWith(4, { country: 'Argentina', limit: 50, page: 4 })
        expect(result.details.geo_pages_processed).toBe(4)
        expect(result.details.geo_artists_matched).toBe(1)
        expect(supabase.importanceUpsert).toHaveBeenCalledTimes(1)
        const rows = supabase.importanceUpsert.mock.calls[0][0] as Array<{ artist_id: string; geo_rank: number | null }>
        expect(rows).toEqual([expect.objectContaining({ artist_id: 'a-id', geo_rank: 1 })])
        expect(result.ok).toBe(true)
    })

    it('sizes the geo ranking from the pages that actually came back, so a failed last page does not inflate it', async () => {
        getLastFmGeoTopArtists
            .mockResolvedValueOnce(geoPage([]))
            .mockResolvedValueOnce(geoPage([]))
            .mockResolvedValueOnce(geoPage(['Artist C']))
            .mockResolvedValueOnce({ artists: null, error: 'Last.fm respondió con error 503.' })
        const supabase = makeSupabase({ matchedByNameKey: { 'artist c': 'c-id' } })

        const result = await refreshArtistImportance(supabase as never, {
            runStart: RUN_START,
            throttle: vi.fn(),
            now: NOW_WITHIN_BUDGET,
        })

        expect(result.details.geo_pages_processed).toBe(3)
        expect(result.details.geo_pages_failed).toBe(1)
        const rows = supabase.importanceUpsert.mock.calls[0][0] as Array<{ artist_id: string; geo_rank: number; peso: number }>
        expect(rows[0]).toEqual(expect.objectContaining({ artist_id: 'c-id', geo_rank: 101 }))
        expect(rows[0].peso).toBeCloseTo(computeArtistImportance({ geoRank: 101, geoTotal: 150, wentCount: 0, maxWent: 0 }))
    })

    it('gives an artist with only in-app went attendance a higher peso than one with neither signal', async () => {
        const supabase = makeSupabase({ wentCounts: [{ artist_id: 'went-id', went_count: 5 }] })

        await refreshArtistImportance(supabase as never, {
            runStart: RUN_START,
            throttle: vi.fn(),
            now: NOW_WITHIN_BUDGET,
        })

        const rows = supabase.importanceUpsert.mock.calls[0][0] as Array<{ artist_id: string; peso: number; went_count: number }>
        expect(rows).toHaveLength(1)
        expect(rows[0]).toEqual(expect.objectContaining({ artist_id: 'went-id', went_count: 5 }))
        expect(rows[0].peso).toBeGreaterThan(0.1) // strictly above the all-zero baseline
    })

    it('stops the geo phase on rate limit, records ok=false and stopped_reason, and skips the tag phase entirely', async () => {
        getLastFmGeoTopArtists.mockResolvedValueOnce({ artists: null, rateLimited: true })
        const supabase = makeSupabase({})

        const result = await refreshArtistImportance(supabase as never, {
            runStart: RUN_START,
            throttle: vi.fn(),
            now: NOW_WITHIN_BUDGET,
        })

        expect(getLastFmGeoTopArtists).toHaveBeenCalledTimes(1)
        expect(result.ok).toBe(false)
        expect(result.details.stopped_reason).toBe('lastfm_rate_limited')
        expect(getLastFmArtistTags).not.toHaveBeenCalled()
    })

    it('stops immediately with stopped_reason "deadline" and makes no calls when the budget is already spent', async () => {
        const supabase = makeSupabase({})
        const now = vi.fn(() => RUN_START.getTime() + 240_000)

        const result = await refreshArtistImportance(supabase as never, {
            runStart: RUN_START,
            throttle: vi.fn(),
            now,
        })

        expect(getLastFmGeoTopArtists).not.toHaveBeenCalled()
        expect(getLastFmArtistTags).not.toHaveBeenCalled()
        expect(result.ok).toBe(true)
        expect(result.details.stopped_reason).toBe('deadline')
    })

    it('refreshes tags for the stalest catalog artists first, mapping known tags and counting unmapped ones', async () => {
        const supabase = makeSupabase({
            allArtists: [
                { id: 'never-tagged', name: 'Never Tagged' },
                { id: 'old-tag', name: 'Old Tag' },
                { id: 'fresh-tag', name: 'Fresh Tag' },
            ],
            taggedRefreshedAt: { 'old-tag': '2026-01-01T00:00:00.000Z', 'fresh-tag': '2026-08-01T00:00:00.000Z' },
            aliasRows: [{ alias: 'indie rock', genre_key: 'indie' }, { alias: 'live', genre_key: null }],
            genreRows: [{ key: 'indie' }],
        })
        getLastFmArtistTags
            .mockResolvedValueOnce({ tags: ['Indie Rock', 'some unknown tag'] })
            .mockResolvedValueOnce({ tags: [] })
            .mockResolvedValueOnce({ tags: [] })

        const result = await refreshArtistImportance(supabase as never, {
            runStart: RUN_START,
            throttle: vi.fn(),
            now: NOW_WITHIN_BUDGET,
            tagRefreshLimit: 3,
        })

        expect(getLastFmArtistTags).toHaveBeenNthCalledWith(1, 'Never Tagged')
        expect(getLastFmArtistTags).toHaveBeenNthCalledWith(2, 'Old Tag')
        expect(getLastFmArtistTags).toHaveBeenNthCalledWith(3, 'Fresh Tag')
        expect(result.details.tag_artists_processed).toBe(3)
        expect(result.details.unmapped_tags).toBe(1)
        expect(supabase.genresUpsert).toHaveBeenCalledWith(
            [{ artist_id: 'never-tagged', genre_key: 'indie', source: 'lastfm', weight: 1, refreshed_at: RUN_START.toISOString() }],
            { onConflict: 'artist_id,genre_key,source' }
        )
    })

    it('does not count curated noise tags as unmapped, only tags nobody has curated yet', async () => {
        const supabase = makeSupabase({
            allArtists: [{ id: 'a', name: 'A' }],
            aliasRows: [{ alias: 'indie rock', genre_key: 'indie' }, { alias: 'live', genre_key: null }, { alias: 'seen live', genre_key: null }],
            genreRows: [{ key: 'indie' }],
        })
        getLastFmArtistTags.mockResolvedValueOnce({ tags: ['Indie Rock', 'Live', 'seen live', 'some unknown tag'] })

        const result = await refreshArtistImportance(supabase as never, {
            runStart: RUN_START,
            throttle: vi.fn(),
            now: NOW_WITHIN_BUDGET,
            tagRefreshLimit: 1,
        })

        expect(result.details.unmapped_tags).toBe(1)
    })

    it('stops the tag phase on rate limit without processing the remaining stale artists', async () => {
        const supabase = makeSupabase({
            allArtists: [
                { id: 'first', name: 'First' },
                { id: 'second', name: 'Second' },
            ],
        })
        getLastFmArtistTags.mockResolvedValueOnce({ tags: null, rateLimited: true })

        const result = await refreshArtistImportance(supabase as never, {
            runStart: RUN_START,
            throttle: vi.fn(),
            now: NOW_WITHIN_BUDGET,
        })

        expect(getLastFmArtistTags).toHaveBeenCalledTimes(1)
        expect(result.ok).toBe(false)
        expect(result.details.stopped_reason).toBe('lastfm_rate_limited')
    })
})
