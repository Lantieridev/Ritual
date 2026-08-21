/**
 * Daily Last.fm refresh: backfills city coordinates for taste_profiles rows
 * still missing them (≤30 Nominatim calls), then re-imports the
 * least-recently-synced connected users through the shared
 * `importLastfmForUser` — never a second fetch/match/upsert implementation.
 */
import 'server-only'
import { isLastFmConfigured } from '@/src/core/lib/lastfm'
import { importLastfmForUser } from '@/src/domains/taste/importLastfmForUser'
import { syncCityCoordinates } from '@/src/domains/taste/syncCityCoordinates'
import { createThrottle, type Throttle } from '@/src/core/lib/throttle'
import { RUN_BUDGET_MS, type CronSupabaseClient } from '@/src/core/lib/cron'

const GEOCODE_BACKFILL_LIMIT = 30
const IMPORTS_QUERY_LIMIT = 200
const THROTTLE_MIN_MS = 1000
const THROTTLE_JITTER_MS = 250

export type StoppedReason = 'deadline' | 'lastfm_rate_limited' | 'lastfm_unconfigured'

export interface RefreshLastfmImportsDetails {
    geocode_backfill_processed: number
    imports_processed: number
    imports_failed: number
    stopped_reason?: StoppedReason
}

export interface RefreshLastfmImportsResult {
    ok: boolean
    details: RefreshLastfmImportsDetails
}

export interface RefreshLastfmImportsOptions {
    runStart?: Date
    throttle?: Throttle
    budgetMs?: number
    now?: () => number // injectable clock for deadline tests — defaults to Date.now
    geocodeBackfillLimit?: number
    usersLimit?: number
}

export async function refreshLastfmImports(
    supabase: CronSupabaseClient,
    options: RefreshLastfmImportsOptions = {}
): Promise<RefreshLastfmImportsResult> {
    const details: RefreshLastfmImportsDetails = { geocode_backfill_processed: 0, imports_processed: 0, imports_failed: 0 }
    if (!isLastFmConfigured()) return { ok: true, details: { ...details, stopped_reason: 'lastfm_unconfigured' } }

    const runStart = options.runStart ?? new Date()
    const budgetMs = options.budgetMs ?? RUN_BUDGET_MS
    const now = options.now ?? Date.now
    const throttle = options.throttle ?? createThrottle(THROTTLE_MIN_MS, { jitterMs: THROTTLE_JITTER_MS })
    const geocodeBackfillLimit = options.geocodeBackfillLimit ?? GEOCODE_BACKFILL_LIMIT
    const usersLimit = options.usersLimit ?? IMPORTS_QUERY_LIMIT
    const deadlineExceeded = () => now() - runStart.getTime() >= budgetMs

    let stoppedReason: StoppedReason | undefined
    let rateLimited = false

    // Phase A: geocode backfill, before any Last.fm call — Nominatim has no rate-limit signal of its own, only the deadline stops it.
    const geocodeCandidates = await selectGeocodeBackfillCandidates(supabase, geocodeBackfillLimit)
    for (const candidate of geocodeCandidates) {
        if (deadlineExceeded()) {
            stoppedReason = 'deadline'
            break
        }
        await throttle()
        await syncCityCoordinates(supabase, candidate.userId, candidate.location)
        details.geocode_backfill_processed += 1
    }

    // Phase B: Last.fm refresh, least-recently-synced first, through the shared importLastfmForUser.
    if (!stoppedReason) {
        const users = await selectUsersForImportRefresh(supabase, usersLimit)
        for (const user of users) {
            if (deadlineExceeded()) {
                stoppedReason = 'deadline'
                break
            }
            const result = await importLastfmForUser(supabase, user.userId, user.username, {
                runStart: runStart.toISOString(),
                throttle,
            })
            if (result.rateLimited) {
                stoppedReason = 'lastfm_rate_limited'
                rateLimited = true
                break
            }
            details.imports_processed += 1
            if (result.error || result.notFound) details.imports_failed += 1

            const { error } = await supabase.from('taste_profiles').update({ lastfm_synced_at: runStart.toISOString() }).eq('user_id', user.userId)
            if (error) console.error('Error actualizando lastfm_synced_at:', error)
        }
    }

    if (stoppedReason) details.stopped_reason = stoppedReason
    return { ok: !rateLimited, details }
}

/** Pending `taste_profiles` rows (no city yet) that also have a free-text city on `profiles`, oldest-created first, capped at `limit`. */
async function selectGeocodeBackfillCandidates(
    supabase: CronSupabaseClient,
    limit: number
): Promise<Array<{ userId: string; location: string }>> {
    const { data: pending } = await supabase.from('taste_profiles').select('user_id, created_at').is('city_lat', null)
    const rows = ((pending ?? []) as Array<{ user_id: string; created_at: string }>).sort((a, b) =>
        a.created_at.localeCompare(b.created_at)
    )
    if (rows.length === 0) return []

    const { data: profiles } = await supabase.from('profiles').select('id, location').in('id', rows.map((r) => r.user_id))
    const locationById = new Map(
        ((profiles ?? []) as Array<{ id: string; location: string | null }>)
            .filter((p) => p.location)
            .map((p) => [p.id, p.location as string])
    )

    const candidates: Array<{ userId: string; location: string }> = []
    for (const row of rows) {
        const location = locationById.get(row.user_id)
        if (location) candidates.push({ userId: row.user_id, location })
        if (candidates.length >= limit) break
    }
    return candidates
}

/** Connected users, least-recently-synced first — same ordering the `taste_profiles_lastfm_sync_idx` partial index backs. */
async function selectUsersForImportRefresh(
    supabase: CronSupabaseClient,
    limit: number
): Promise<Array<{ userId: string; username: string }>> {
    const { data } = await supabase
        .from('taste_profiles')
        .select('user_id, lastfm_username')
        .not('lastfm_username', 'is', null)
        .order('lastfm_synced_at', { ascending: true, nullsFirst: true })
        .limit(limit)

    return ((data ?? []) as Array<{ user_id: string; lastfm_username: string }>).map((row) => ({
        userId: row.user_id,
        username: row.lastfm_username,
    }))
}
