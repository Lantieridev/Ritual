/**
 * Shared types for the taste domain: the pure read model (blend, importance)
 * and the `TasteSource` port that unit 7's adapters implement. Kept in their
 * own file (no logic) so the pure core and the I/O layer can both import them
 * without a circular dependency.
 */
import type { createClient } from '@/src/core/lib/supabase/server'

type SupabaseClient = Awaited<ReturnType<typeof createClient>>

/**
 * Known adapters get literal autocomplete; `(string & {})` still allows a
 * 5th/Nth source id without a type change — see spec "Source-pluggable read
 * model".
 */
export type TasteSourceId = 'profile-prior' | 'attendance' | 'wishlist' | 'lastfm' | (string & {})

/**
 * One signal contributed by a source. `prior: true` marks declared-genre
 * priors, which decay by `realSignalCount` (see weights.priorFade) instead of
 * by `halfLifeDays`/`observedAt`.
 */
export interface TasteSignal {
    source: TasteSourceId
    kind: 'artist' | 'genre'
    ref: string
    weight: number
    observedAt: string | null
    halfLifeDays: number | null
    prior: boolean
}

/** The only contract a taste source implements — see spec "New source requires no consumer change". */
export interface TasteSource {
    id: TasteSourceId
    collect(ctx: { userId: string; supabase: SupabaseClient }): Promise<TasteSignal[]>
}

/**
 * `'behavior'` when at least one real (non-prior) signal exists,
 * `'declared-genres'` when only declared genres exist, `'none'` otherwise.
 */
export type TasteBasis = 'none' | 'declared-genres' | 'behavior'

export interface TasteProfile {
    artistAffinity: ReadonlyMap<string, number>
    genreAffinity: ReadonlyMap<string, number>
    /** Non-prior signal count. Used ONLY for the prior fade, never for label gating. */
    realSignalCount: number
    /** False only when basis is 'none'. */
    hasAnySignal: boolean
    basis: TasteBasis
    sources: TasteSourceId[]
}

export interface ArtistImportance {
    artistId: string
    peso: number
    geoRank: number | null
    /** Always 0 or >= 3 — see spec "Attendance counts never identify individuals". */
    wentCount: number
}
