/**
 * Picks and formats the one-line reason a candidate is suggested — always
 * derived from real evidence (spec "Honest, evidence-only reasons"), never a
 * guess. An empty lineup has no artist to point evidence at, so it always
 * yields no reason, in either mode.
 */
import type { ArtistImportance } from '@/src/domains/taste/types'
import type { Reason, ReasonFacts, StripMode } from './types'

/** N≥3 threshold for a general-mode "loaded by" reason (mirrors the taste domain's attendance floor). */
const LOADED_BY_MIN = 3

export interface ReasonContext {
    facts: ReasonFacts
    artistGenres: ReadonlyMap<string, readonly string[]>
    importance: ReadonlyMap<string, ArtistImportance>
}

/**
 * Personal priority: seen > wishlist > declared-genre. General priority:
 * country-top > loaded-by. First match across the whole lineup wins; with
 * none, the caller falls back to the distance alone (see `formatReason`).
 */
export function deriveReason(mode: StripMode, artistIds: readonly string[], ctx: ReasonContext): Reason | null {
    if (artistIds.length === 0) return null

    return mode === 'personal' ? derivePersonalReason(artistIds, ctx) : deriveGeneralReason(artistIds, ctx)
}

function derivePersonalReason(artistIds: readonly string[], ctx: ReasonContext): Reason | null {
    let seenTimes = 0
    for (const id of artistIds) {
        const times = ctx.facts.seenCounts.get(id) ?? 0
        if (times > seenTimes) seenTimes = times
    }
    if (seenTimes > 0) return { kind: 'seen', times: seenTimes }

    if (artistIds.some((id) => ctx.facts.wishlist.has(id))) return { kind: 'wishlist' }

    const hasDeclaredGenreMatch = artistIds.some((id) =>
        (ctx.artistGenres.get(id) ?? []).some((genre) => ctx.facts.declaredGenres.has(genre))
    )
    if (hasDeclaredGenreMatch) return { kind: 'declared-genre' }

    return null
}

function deriveGeneralReason(artistIds: readonly string[], ctx: ReasonContext): Reason | null {
    const hasCountryTop = artistIds.some((id) => ctx.importance.get(id)?.geoRank != null)
    if (hasCountryTop) return { kind: 'country-top' }

    let maxWentCount = 0
    for (const id of artistIds) {
        const wentCount = ctx.importance.get(id)?.wentCount ?? 0
        if (wentCount > maxWentCount) maxWentCount = wentCount
    }
    if (maxWentCount >= LOADED_BY_MIN) return { kind: 'loaded-by', people: maxWentCount }

    return null
}

function reasonText(reason: Reason | null): string | null {
    if (!reason) return null
    switch (reason.kind) {
        case 'seen':
            return reason.times === 1 ? 'lo viste una vez' : `lo viste ${reason.times} veces`
        case 'wishlist':
            return 'está en tu wishlist'
        case 'declared-genre':
            return 'por los géneros que elegiste'
        case 'country-top':
            return 'de los más escuchados del país'
        case 'loaded-by':
            return `lo cargaron ${reason.people} personas`
    }
}

/**
 * One display line. The "· a N km" suffix appears only when a distance was
 * actually computed (both coordinates known) — never a guessed distance.
 * With no reason and no distance, the whole line is omitted.
 */
export function formatReason(reason: Reason | null, km: number | null): string | null {
    const text = reasonText(reason)
    const distance = km !== null ? `a ${Math.max(1, Math.round(km))} km` : null

    if (text && distance) return `${text} · ${distance}`
    return text ?? distance
}
