/**
 * Pure per-signal weight formulas shared by every taste source and the blend
 * step. Isolated from decay/aggregation logic (blend.ts) so each source's
 * weighting rule is testable and changeable on its own.
 */

/**
 * A "went" rating of 0 means unrated, not "worst show" — it must weigh more
 * than an explicit 1/5 and less than a 5/5.
 */
export function wentWeight(rating: number): number {
    return 3 * (rating ? rating / 3 : 1)
}

export const GOING_WEIGHT = 2
export const WISHLIST_WEIGHT = 2
export const INTERESTED_WEIGHT = 1

/** Half-life, in days, applied to "went" signals from their event date. */
export const WENT_HALF_LIFE_DAYS = 365

const LASTFM_MAX_RANK = 50
const LASTFM_WEIGHT_SCALE = 2

/** Last.fm rank 1 (most-played) weighs the full scale; rank 50 weighs near zero. */
export function lastfmWeight(rank: number): number {
    return LASTFM_WEIGHT_SCALE * (1 - (rank - 1) / LASTFM_MAX_RANK)
}

const PRIOR_BASE_WEIGHT = 1
const PRIOR_FADE_SCALE = 10

/**
 * Declared-genre priors fade out as real behavior accumulates: at
 * realSignalCount = 0 they carry their full base weight, at 10 they're
 * already halved.
 */
export function priorFade(realSignalCount: number): number {
    return PRIOR_BASE_WEIGHT / (1 + realSignalCount / PRIOR_FADE_SCALE)
}
