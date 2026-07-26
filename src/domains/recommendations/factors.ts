/**
 * Pure per-candidate score factors (JD-004 hardening): each function is
 * total on its inputs — an empty lineup, a missing importance row, a null
 * taste profile or a missing coordinate all degrade to a neutral value
 * instead of throwing or producing NaN/Infinity. `rank.ts` composes these
 * into `score = importance × affinity × proximity × date`.
 */
import { haversineKm } from '@/src/core/lib/geo'
import { daysUntil } from '@/src/core/lib/dates'
import type { LatLng } from '@/src/core/lib/geo'
import type { ArtistImportance } from '@/src/domains/taste/types'
import type { RankingInput, ScoreFactors, StripMode } from './types'

/** Floor applied when a candidate's lineup is empty or has no finite peso — never `Math.max(...[])`. */
export const IMPORTANCE_FLOOR = 0.1

export const PROXIMITY_NEUTRAL = 0.7
const PROXIMITY_BASE = 0.4
const PROXIMITY_SCALE = 0.6
const PROXIMITY_DECAY_KM = 25

const DATE_BASE = 0.5
const DATE_SCALE = 0.5
const DATE_DECAY_DAYS = 45
const DATE_WINDOW_DAYS = 90

/** Max `peso` over the lineup's artists with a finite value; floors at 0.1 for an empty lineup or no match. */
export function computeImportance(
    artistIds: readonly string[],
    importance: ReadonlyMap<string, ArtistImportance>
): number {
    return artistIds.reduce((max, id) => {
        const peso = importance.get(id)?.peso
        return Number.isFinite(peso) && (peso as number) > max ? (peso as number) : max
    }, IMPORTANCE_FLOOR)
}

/** Max of a map's values, treating an empty map or a non-finite max as 0 (never `Math.max(...[])`). */
function maxFiniteValue(values: Iterable<number>): number {
    let max = 0
    for (const value of values) {
        if (Number.isFinite(value) && value > max) max = value
    }
    return max
}

/**
 * `afin = 1 + 2a` in personal mode, `a` clamped to [0,1]. `a` is the best
 * relative match across the lineup: each artist's own affinity ratio, or its
 * best genre's affinity ratio, whichever is higher. General mode ignores
 * taste entirely (afin = 1, per spec).
 */
export function computeAffinity(
    mode: StripMode,
    artistIds: readonly string[],
    taste: RankingInput['taste'],
    artistGenres: ReadonlyMap<string, readonly string[]>
): number {
    if (mode === 'general' || !taste || artistIds.length === 0) return 1

    const maxArtist = maxFiniteValue(taste.artistAffinity.values())
    const maxGenre = maxFiniteValue(taste.genreAffinity.values())

    let a = 0
    for (const id of artistIds) {
        const artistRatio = maxArtist > 0 ? (taste.artistAffinity.get(id) ?? 0) / maxArtist : 0
        let genreRatio = 0
        if (maxGenre > 0) {
            for (const genre of artistGenres.get(id) ?? []) {
                const ratio = (taste.genreAffinity.get(genre) ?? 0) / maxGenre
                if (ratio > genreRatio) genreRatio = ratio
            }
        }
        a = Math.max(a, artistRatio, genreRatio)
    }

    const clamped = Math.min(1, Math.max(0, a))
    return 1 + 2 * clamped
}

/** `prox = 0.4 + 0.6·e^(−km/25)`. Either coordinate missing → 0.7 neutral, no distance. */
export function computeProximity(
    userCoords: LatLng | null,
    venueCoords: LatLng | null
): { proximity: number; distanceKm: number | null } {
    if (!userCoords || !venueCoords) return { proximity: PROXIMITY_NEUTRAL, distanceKm: null }

    const distanceKm = haversineKm(userCoords, venueCoords)
    return { proximity: PROXIMITY_BASE + PROXIMITY_SCALE * Math.exp(-distanceKm / PROXIMITY_DECAY_KM), distanceKm }
}

/**
 * `when = 0.5 + 0.5·e^(−days/45)` for a candidate 0–90 days out. `null` for
 * an unparsable date or one outside the window — the caller excludes it from
 * ranking entirely rather than scoring it with a made-up neutral.
 */
export function computeDateFactor(startsAt: string, now: Date): { when: number; daysAway: number } | null {
    if (Number.isNaN(new Date(startsAt).getTime())) return null

    const daysAway = daysUntil(startsAt, now)
    if (daysAway < 0 || daysAway > DATE_WINDOW_DAYS) return null

    return { when: DATE_BASE + DATE_SCALE * Math.exp(-daysAway / DATE_DECAY_DAYS), daysAway }
}

export function scoreFromFactors(factors: ScoreFactors): number {
    return factors.importance * factors.affinity * factors.proximity * factors.date
}
