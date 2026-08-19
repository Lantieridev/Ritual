/**
 * Daily importance refresh: 4 Last.fm `geo.getTopArtists` pages (Argentina)
 * blended with in-app "went" counts into `artist_importance.peso`, then a
 * tag-refresh pass that feeds `artist_genres` (source='lastfm').
 */
import 'server-only'
import { isLastFmConfigured } from '@/src/core/lib/lastfm'
import { getLastFmGeoTopArtists, getLastFmArtistTags } from '@/src/domains/taste/clients/lastfm'
import { createThrottle, type Throttle } from '@/src/core/lib/throttle'
import { normalizeGenre } from '@/src/domains/taste/normalizeGenre'
import { computeArtistImportance } from '@/src/domains/taste/importance'
import { RUN_BUDGET_MS, type CronSupabaseClient } from '@/src/core/lib/cron'

const GEO_PAGES = 4
const GEO_PAGE_LIMIT = 50
const TAG_REFRESH_LIMIT = 150
const THROTTLE_MIN_MS = 1000
const THROTTLE_JITTER_MS = 250
const WENT_PRIVACY_THRESHOLD = 3

export type StoppedReason = 'deadline' | 'lastfm_rate_limited' | 'lastfm_unconfigured'

export interface RefreshArtistImportanceDetails {
    geo_pages_processed: number
    geo_artists_matched: number
    tag_artists_processed: number
    unmapped_tags: number
    stopped_reason?: StoppedReason
}

export interface RefreshArtistImportanceResult {
    ok: boolean
    details: RefreshArtistImportanceDetails
}

export interface RefreshArtistImportanceOptions {
    runStart?: Date
    throttle?: Throttle
    budgetMs?: number
    now?: () => number // injectable clock for deadline tests — defaults to Date.now
    geoPages?: number
    tagRefreshLimit?: number
}

interface GeoArtist {
    rank: number
    listeners: number | null
}

export async function refreshArtistImportance(
    supabase: CronSupabaseClient,
    options: RefreshArtistImportanceOptions = {}
): Promise<RefreshArtistImportanceResult> {
    const details: RefreshArtistImportanceDetails = {
        geo_pages_processed: 0,
        geo_artists_matched: 0,
        tag_artists_processed: 0,
        unmapped_tags: 0,
    }
    if (!isLastFmConfigured()) return { ok: true, details: { ...details, stopped_reason: 'lastfm_unconfigured' } }

    const runStart = options.runStart ?? new Date()
    const budgetMs = options.budgetMs ?? RUN_BUDGET_MS
    const now = options.now ?? Date.now
    const throttle = options.throttle ?? createThrottle(THROTTLE_MIN_MS, { jitterMs: THROTTLE_JITTER_MS })
    const geoPages = options.geoPages ?? GEO_PAGES
    const tagRefreshLimit = options.tagRefreshLimit ?? TAG_REFRESH_LIMIT
    const deadlineExceeded = () => now() - runStart.getTime() >= budgetMs

    let stoppedReason: StoppedReason | undefined
    let rateLimited = false

    // Phase A: geo top artists, matched against the catalog by name_key.
    const geoByNameKey = new Map<string, GeoArtist>()
    for (let page = 1; page <= geoPages; page++) {
        if (deadlineExceeded()) { stoppedReason = 'deadline'; break }
        await throttle()
        const result = await getLastFmGeoTopArtists({ country: 'Argentina', limit: GEO_PAGE_LIMIT, page })
        if (result.rateLimited) { stoppedReason = 'lastfm_rate_limited'; rateLimited = true; break }
        details.geo_pages_processed += 1
        if (!result.artists) continue // best-effort: skip a failed page instead of aborting the run

        for (const artist of result.artists) {
            const nameKey = artist.name.toLowerCase()
            if (!geoByNameKey.has(nameKey)) {
                geoByNameKey.set(nameKey, { rank: (page - 1) * GEO_PAGE_LIMIT + artist.rank, listeners: artist.listeners ?? null })
            }
        }
    }
    const geoTotal = details.geo_pages_processed * GEO_PAGE_LIMIT

    const geoByArtistId = new Map<string, GeoArtist>()
    if (geoByNameKey.size > 0) {
        const { data: matched } = await supabase.from('artists').select('id, name_key').in('name_key', [...geoByNameKey.keys()])
        for (const row of (matched ?? []) as Array<{ id: string; name_key: string }>) {
            const geo = geoByNameKey.get(row.name_key)
            if (geo) geoByArtistId.set(row.id, geo)
        }
    }
    details.geo_artists_matched = geoByArtistId.size

    // In-app "went" counts, clamped to 0 below the privacy threshold (JD-008).
    const { data: wentRows } = await supabase.rpc('artist_went_counts')
    const wentByArtistId = new Map<string, number>()
    let maxWent = 0
    for (const row of (wentRows ?? []) as Array<{ artist_id: string; went_count: number }>) {
        const clamped = row.went_count >= WENT_PRIVACY_THRESHOLD ? row.went_count : 0
        if (clamped > 0) {
            wentByArtistId.set(row.artist_id, clamped)
            maxWent = Math.max(maxWent, clamped)
        }
    }

    const importanceArtistIds = new Set([...geoByArtistId.keys(), ...wentByArtistId.keys()])
    if (importanceArtistIds.size > 0) {
        const rows = [...importanceArtistIds].map((artistId) => {
            const geo = geoByArtistId.get(artistId)
            const wentCount = wentByArtistId.get(artistId) ?? 0
            const peso = computeArtistImportance({ geoRank: geo?.rank ?? null, geoTotal, wentCount, maxWent })
            return {
                artist_id: artistId,
                geo_rank: geo?.rank ?? null,
                geo_listeners: geo?.listeners ?? null,
                went_count: wentCount,
                peso,
                refreshed_at: runStart.toISOString(),
            }
        })
        const { error } = await supabase.from('artist_importance').upsert(rows, { onConflict: 'artist_id' })
        if (error) console.error('Error guardando artist_importance:', error)
    }

    // Phase B: tag refresh for the stalest catalog artists — skipped if phase A already stopped.
    if (!stoppedReason) {
        const staleArtists = await selectStaleArtistsForTagRefresh(supabase, tagRefreshLimit)
        const { aliasMap, genreKeys } = await loadGenreVocabulary(supabase)

        for (const artist of staleArtists) {
            if (deadlineExceeded()) { stoppedReason = 'deadline'; break }
            await throttle()
            const result = await getLastFmArtistTags(artist.name)
            if (result.rateLimited) { stoppedReason = 'lastfm_rate_limited'; rateLimited = true; break }
            details.tag_artists_processed += 1
            if (!result.tags) continue

            const matchedGenres = new Set<string>()
            for (const tag of result.tags) {
                const genreKey = normalizeGenre(tag, aliasMap, genreKeys)
                if (genreKey) matchedGenres.add(genreKey)
                else details.unmapped_tags += 1
            }
            if (matchedGenres.size === 0) continue

            const rows = [...matchedGenres].map((genreKey) => ({
                artist_id: artist.id, genre_key: genreKey, source: 'lastfm', weight: 1, refreshed_at: runStart.toISOString(),
            }))
            const { error } = await supabase.from('artist_genres').upsert(rows, { onConflict: 'artist_id,genre_key,source' })
            if (error) console.error('Error guardando géneros de Last.fm:', error)
        }
    }

    if (stoppedReason) details.stopped_reason = stoppedReason
    return { ok: !rateLimited, details }
}

/** Up to `limit` catalog artists: never lastfm-tagged first, then oldest `artist_genres` (source='lastfm') refresh first. No dedicated migration backs this — PostgREST can't order by a joined aggregate — so it's computed in JS from two full-table reads, fine at this project's catalog size. */
async function selectStaleArtistsForTagRefresh(
    supabase: CronSupabaseClient,
    limit: number
): Promise<Array<{ id: string; name: string }>> {
    const { data: artists } = await supabase.from('artists').select('id, name')
    const { data: genreRows } = await supabase.from('artist_genres').select('artist_id, refreshed_at').eq('source', 'lastfm')

    const lastRefreshByArtist = new Map<string, string>()
    for (const row of (genreRows ?? []) as Array<{ artist_id: string; refreshed_at: string }>) {
        const existing = lastRefreshByArtist.get(row.artist_id)
        if (!existing || row.refreshed_at > existing) lastRefreshByArtist.set(row.artist_id, row.refreshed_at)
    }

    return [...((artists ?? []) as Array<{ id: string; name: string }>)]
        .sort((a, b) => (lastRefreshByArtist.get(a.id) ?? '').localeCompare(lastRefreshByArtist.get(b.id) ?? ''))
        .slice(0, limit)
}

async function loadGenreVocabulary(
    supabase: CronSupabaseClient
): Promise<{ aliasMap: Map<string, string | null>; genreKeys: Set<string> }> {
    const { data: aliasRows } = await supabase.from('genre_aliases').select('alias, genre_key')
    const { data: genreRows } = await supabase.from('genres').select('key')
    return {
        aliasMap: new Map(((aliasRows ?? []) as Array<{ alias: string; genre_key: string | null }>).map((row) => [row.alias, row.genre_key])),
        genreKeys: new Set(((genreRows ?? []) as Array<{ key: string }>).map((row) => row.key)),
    }
}
