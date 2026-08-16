import { isLastFmConfigured } from '@/src/core/lib/lastfm'
import { getLastFmUserTopArtists } from '@/src/domains/taste/clients/lastfm'
import type { createClient } from '@/src/core/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

/**
 * Storage bound from the Last.fm ToS (JD-007): keep at most this many rows
 * per user for a single import, even if a caller passes a bigger `limit`.
 */
const MAX_STORED_ARTISTS = 50

export interface ImportLastfmOptions {
    /** Stamped onto every row's `fetched_at` — lets a cron batch treat "this run" as one instant. */
    runStart?: string
    /** Awaited right before the Last.fm call, so a caller looping over many users stays under 1 req/s. */
    throttle?: () => Promise<void>
}

export interface ImportLastfmResult {
    imported: number
    unmatched: number
    rateLimited?: boolean
    notFound?: boolean
    error?: string
}

const NOOP_RESULT: ImportLastfmResult = { imported: 0, unmatched: 0 }

function nameKeyOf(name: string): string {
    return name.toLowerCase()
}

/**
 * The single shared Last.fm import: signup/profile "connect" (unit 8) and
 * the daily refresh cron (unit 11) both call this instead of re-implementing
 * the fetch/match/upsert/stale-delete cycle — see design "Last.fm client".
 */
export async function importLastfmForUser(
    supabase: SupabaseClient,
    userId: string,
    username: string,
    options: ImportLastfmOptions = {}
): Promise<ImportLastfmResult> {
    if (!isLastFmConfigured()) return NOOP_RESULT

    if (options.throttle) await options.throttle()

    const result = await getLastFmUserTopArtists(username)
    if (result.notFound) return { ...NOOP_RESULT, notFound: true }
    if (result.rateLimited) return { ...NOOP_RESULT, rateLimited: true }
    if (!result.artists) return { ...NOOP_RESULT, error: result.error }

    const topArtists = result.artists.slice(0, MAX_STORED_ARTISTS)
    const nameKeys = topArtists.map((artist) => nameKeyOf(artist.name))

    const { data: matches, error: matchError } = await supabase
        .from('artists')
        .select('id, name_key')
        .in('name_key', nameKeys)
    if (matchError) console.error('Error resolviendo artistas de Last.fm contra el catálogo:', matchError)

    const idByNameKey = new Map((matches ?? []).map((row) => [row.name_key as string, row.id as string]))
    const fetchedAt = options.runStart ?? new Date().toISOString()

    let unmatched = 0
    const rows = topArtists.map((artist) => {
        const nameKey = nameKeyOf(artist.name)
        const artistId = idByNameKey.get(nameKey) ?? null
        if (!artistId) unmatched += 1
        return {
            user_id: userId,
            artist_name_key: nameKey,
            artist_name: artist.name,
            artist_id: artistId,
            rank: artist.rank,
            playcount: artist.playcount ?? null,
            fetched_at: fetchedAt,
        }
    })

    const { error: upsertError } = await supabase
        .from('lastfm_imports')
        .upsert(rows, { onConflict: 'user_id,artist_name_key' })
    if (upsertError) {
        console.error('Error guardando el import de Last.fm:', upsertError)
        return { ...NOOP_RESULT, error: 'No pudimos guardar tu Last.fm ahora.' }
    }

    await deleteStaleImports(supabase, userId, new Set(rows.map((r) => r.artist_name_key)))

    return { imported: rows.length, unmatched }
}

/** Enforces the top-50-per-user cap (JD-007): anything outside the fresh top set gets removed. */
async function deleteStaleImports(supabase: SupabaseClient, userId: string, keptKeys: ReadonlySet<string>): Promise<void> {
    const { data: existing, error } = await supabase
        .from('lastfm_imports')
        .select('artist_name_key')
        .eq('user_id', userId)
    if (error || !existing) return

    const staleKeys = existing.map((row) => row.artist_name_key as string).filter((key) => !keptKeys.has(key))
    if (staleKeys.length === 0) return

    const { error: deleteError } = await supabase
        .from('lastfm_imports')
        .delete()
        .eq('user_id', userId)
        .in('artist_name_key', staleKeys)
    if (deleteError) console.error('Error limpiando imports viejos de Last.fm:', deleteError)
}
