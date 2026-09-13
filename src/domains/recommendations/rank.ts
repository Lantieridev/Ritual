/**
 * Composes the pure factors into one total-ordered, deterministic ranking.
 * No I/O — `getHomeSuggestions` (service.ts) is the only caller that touches
 * a database or an external API.
 */
import { computeAffinity, computeDateFactor, computeImportance, computeProximity, scoreFromFactors } from './factors'
import { deriveReason } from './reasons'
import type { RankedCandidate, RankingInput, SuggestionCandidate } from './types'

/**
 * Total order: score descending, then nearest date ascending, then key by
 * code-unit comparison — locale-independent, so the order never depends on
 * the runtime's `Intl` locale.
 */
export function compareRanked(a: RankedCandidate, b: RankedCandidate): number {
    if (a.score !== b.score) return b.score - a.score
    if (a.daysAway !== b.daysAway) return a.daysAway - b.daysAway
    if (a.key < b.key) return -1
    if (a.key > b.key) return 1
    return 0
}

/**
 * Pure: identical `candidates` + `ctx` always produce identical output. A
 * candidate outside the 0–90 day window, or with an unparsable date, is
 * excluded entirely rather than scored with a made-up date factor.
 */
export function rankSuggestions(candidates: readonly SuggestionCandidate[], ctx: RankingInput): RankedCandidate[] {
    const ranked: RankedCandidate[] = []

    for (const candidate of candidates) {
        const dateFactor = computeDateFactor(candidate.startsAt, ctx.now)
        if (!dateFactor) continue

        const importance = computeImportance(candidate.artistIds, ctx.importance)
        const affinity = computeAffinity(ctx.mode, candidate.artistIds, ctx.taste, ctx.artistGenres)
        const { proximity, distanceKm } = computeProximity(ctx.userCoords, candidate.venueCoords)
        const reason = deriveReason(ctx.mode, candidate.artistIds, {
            facts: ctx.facts,
            artistGenres: ctx.artistGenres,
            importance: ctx.importance,
        })

        ranked.push({
            ...candidate,
            score: scoreFromFactors({ importance, affinity, proximity, date: dateFactor.when }),
            factors: { importance, affinity, proximity, date: dateFactor.when },
            daysAway: dateFactor.daysAway,
            distanceKm,
            reason,
        })
    }

    return ranked.sort(compareRanked)
}
