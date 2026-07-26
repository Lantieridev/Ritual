/**
 * Shared types for the recommendations domain: the pure core (factors, rank,
 * reasons, heading, seeds) and the I/O service both import these — no logic
 * here, so there's no risk of a circular dependency (mirrors
 * `src/domains/taste/types.ts`).
 */
import type { LatLng } from '@/src/core/lib/geo'
import type { ArtistImportance, TasteBasis, TasteProfile, TasteSourceId } from '@/src/domains/taste/types'

export type StripMode = 'personal' | 'general'

export interface SuggestionCandidate {
    key: string
    source: 'catalog' | 'ticketmaster'
    href: string
    headliner: string
    /** May be empty — a catalog event can be created without a lineup. */
    artistIds: string[]
    venueName: string
    startsAt: string
    venueCoords: LatLng | null
}

export type Reason =
    | { kind: 'seen'; times: number }
    | { kind: 'wishlist' }
    | { kind: 'declared-genre' }
    | { kind: 'country-top' }
    | { kind: 'loaded-by'; people: number }

export interface ScoreFactors {
    importance: number
    affinity: number
    proximity: number
    date: number
}

export interface RankedCandidate extends SuggestionCandidate {
    score: number
    factors: ScoreFactors
    daysAway: number
    distanceKm: number | null
    reason: Reason | null
}

export interface ReasonFacts {
    seenCounts: ReadonlyMap<string, number>
    wishlist: ReadonlySet<string>
    declaredGenres: ReadonlySet<string>
}

export interface RankingInput {
    now: Date
    mode: StripMode
    userCoords: LatLng | null
    importance: ReadonlyMap<string, ArtistImportance>
    taste: Pick<TasteProfile, 'artistAffinity' | 'genreAffinity'> | null
    artistGenres: ReadonlyMap<string, readonly string[]>
    facts: ReasonFacts
}

export interface StripHeadingInput {
    basis: TasteBasis
    hasCoords: boolean
    city: string | null
    sources: readonly TasteSourceId[]
    declaredGenreLabels: readonly string[]
}
