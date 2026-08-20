import { describe, it, expect, vi, beforeEach } from 'vitest'

const isLastFmConfigured = vi.fn()
const importLastfmForUser = vi.fn()
const syncCityCoordinates = vi.fn()

vi.mock('@/src/core/lib/lastfm', () => ({ isLastFmConfigured: () => isLastFmConfigured() }))
vi.mock('@/src/domains/taste/importLastfmForUser', () => ({
    importLastfmForUser: (...args: unknown[]) => importLastfmForUser(...args),
}))
vi.mock('@/src/domains/taste/syncCityCoordinates', () => ({
    syncCityCoordinates: (...args: unknown[]) => syncCityCoordinates(...args),
}))

import { refreshLastfmImports } from './refreshLastfmImports'

const RUN_START = new Date('2026-08-20T13:00:00.000Z')
const NOW_WITHIN_BUDGET = () => RUN_START.getTime() + 1_000

/** `taste_profiles` serves three shapes here: the geocode-pending read, the import-candidates read, and the synced_at update. `profiles` resolves the pending users' free-text city. */
function makeSupabase(opts: {
    pendingGeocode?: Array<{ user_id: string; created_at: string }>
    profilesById?: Record<string, string | null>
    importCandidates?: Array<{ user_id: string; lastfm_username: string }>
}) {
    const updateEq = vi.fn().mockResolvedValue({ error: null })

    const from = vi.fn((table: string) => {
        if (table === 'taste_profiles') {
            return {
                select: (_cols: string) => ({
                    is: (_col: string, _val: null) => Promise.resolve({ data: opts.pendingGeocode ?? [], error: null }),
                    not: (_col: string, _op: string, _val: null) => ({
                        order: () => ({
                            limit: () => Promise.resolve({ data: opts.importCandidates ?? [], error: null }),
                        }),
                    }),
                }),
                update: (_payload: Record<string, unknown>) => ({ eq: updateEq }),
            }
        }
        if (table === 'profiles') {
            return {
                select: (_cols: string) => ({
                    in: (_col: string, ids: string[]) =>
                        Promise.resolve({
                            data: ids.map((id) => ({ id, location: opts.profilesById?.[id] ?? null })),
                            error: null,
                        }),
                }),
            }
        }
        throw new Error(`unexpected table ${table}`)
    })

    return { from, updateEq }
}

describe('refreshLastfmImports', () => {
    beforeEach(() => {
        vi.clearAllMocks()
        isLastFmConfigured.mockReturnValue(true)
        syncCityCoordinates.mockResolvedValue(undefined)
        importLastfmForUser.mockResolvedValue({ imported: 0, unmatched: 0 })
    })

    it('no-ops with ok=true and zero external calls when LASTFM_API_KEY is not configured', async () => {
        isLastFmConfigured.mockReturnValue(false)
        const supabase = makeSupabase({})

        const result = await refreshLastfmImports(supabase as never, { runStart: RUN_START, throttle: vi.fn() })

        expect(result).toEqual({
            ok: true,
            details: { geocode_backfill_processed: 0, imports_processed: 0, imports_failed: 0, stopped_reason: 'lastfm_unconfigured' },
        })
        expect(syncCityCoordinates).not.toHaveBeenCalled()
        expect(importLastfmForUser).not.toHaveBeenCalled()
    })

    it('backfills geocoding for pending users with a known city before running any import, skipping users without one', async () => {
        const supabase = makeSupabase({
            pendingGeocode: [
                { user_id: 'no-city', created_at: '2026-01-01T00:00:00.000Z' },
                { user_id: 'has-city', created_at: '2026-01-02T00:00:00.000Z' },
            ],
            profilesById: { 'has-city': 'Buenos Aires' },
            importCandidates: [{ user_id: 'u1', lastfm_username: 'martin' }],
        })

        const result = await refreshLastfmImports(supabase as never, {
            runStart: RUN_START,
            throttle: vi.fn(),
            now: NOW_WITHIN_BUDGET,
        })

        expect(syncCityCoordinates).toHaveBeenCalledTimes(1)
        expect(syncCityCoordinates).toHaveBeenCalledWith(supabase, 'has-city', 'Buenos Aires')
        expect(result.details.geocode_backfill_processed).toBe(1)
        expect(syncCityCoordinates.mock.invocationCallOrder[0]).toBeLessThan(importLastfmForUser.mock.invocationCallOrder[0])
    })

    it('imports users in the order the least-recently-synced query already returned, via the shared importLastfmForUser', async () => {
        const supabase = makeSupabase({
            importCandidates: [
                { user_id: 'oldest', lastfm_username: 'oldest-user' },
                { user_id: 'newer', lastfm_username: 'newer-user' },
            ],
        })

        const result = await refreshLastfmImports(supabase as never, {
            runStart: RUN_START,
            throttle: vi.fn(),
            now: NOW_WITHIN_BUDGET,
        })

        expect(importLastfmForUser).toHaveBeenNthCalledWith(1, supabase, 'oldest', 'oldest-user', {
            runStart: RUN_START.toISOString(),
            throttle: expect.any(Function),
        })
        expect(importLastfmForUser).toHaveBeenNthCalledWith(2, supabase, 'newer', 'newer-user', {
            runStart: RUN_START.toISOString(),
            throttle: expect.any(Function),
        })
        expect(result.details.imports_processed).toBe(2)
    })

    it('bumps lastfm_synced_at for each successfully processed user', async () => {
        const supabase = makeSupabase({ importCandidates: [{ user_id: 'u1', lastfm_username: 'martin' }] })

        await refreshLastfmImports(supabase as never, { runStart: RUN_START, throttle: vi.fn(), now: NOW_WITHIN_BUDGET })

        expect(supabase.updateEq).toHaveBeenCalledWith('user_id', 'u1')
    })

    it('counts a notFound result as a failed import without stopping the run', async () => {
        importLastfmForUser
            .mockResolvedValueOnce({ imported: 0, unmatched: 0, notFound: true })
            .mockResolvedValueOnce({ imported: 5, unmatched: 1 })
        const supabase = makeSupabase({
            importCandidates: [
                { user_id: 'gone', lastfm_username: 'ghost' },
                { user_id: 'u2', lastfm_username: 'martin' },
            ],
        })

        const result = await refreshLastfmImports(supabase as never, { runStart: RUN_START, throttle: vi.fn(), now: NOW_WITHIN_BUDGET })

        expect(importLastfmForUser).toHaveBeenCalledTimes(2)
        expect(result.details.imports_processed).toBe(2)
        expect(result.details.imports_failed).toBe(1)
    })

    it('stops the imports phase on rate limit, records stopped_reason and ok=false, without bumping that user\'s synced_at', async () => {
        importLastfmForUser.mockResolvedValueOnce({ imported: 0, unmatched: 0, rateLimited: true })
        const supabase = makeSupabase({
            importCandidates: [
                { user_id: 'u1', lastfm_username: 'martin' },
                { user_id: 'u2', lastfm_username: 'sofia' },
            ],
        })

        const result = await refreshLastfmImports(supabase as never, { runStart: RUN_START, throttle: vi.fn(), now: NOW_WITHIN_BUDGET })

        expect(importLastfmForUser).toHaveBeenCalledTimes(1)
        expect(supabase.updateEq).not.toHaveBeenCalled()
        expect(result.ok).toBe(false)
        expect(result.details.stopped_reason).toBe('lastfm_rate_limited')
    })

    it('stops immediately with stopped_reason "deadline" and makes no calls when the budget is already spent', async () => {
        const supabase = makeSupabase({
            pendingGeocode: [{ user_id: 'has-city', created_at: '2026-01-01T00:00:00.000Z' }],
            profilesById: { 'has-city': 'Rosario' },
            importCandidates: [{ user_id: 'u1', lastfm_username: 'martin' }],
        })
        const now = vi.fn(() => RUN_START.getTime() + 240_000)

        const result = await refreshLastfmImports(supabase as never, { runStart: RUN_START, throttle: vi.fn(), now })

        expect(syncCityCoordinates).not.toHaveBeenCalled()
        expect(importLastfmForUser).not.toHaveBeenCalled()
        expect(result.ok).toBe(true)
        expect(result.details.stopped_reason).toBe('deadline')
    })
})
