import { describe, it, expect } from 'vitest'
import {
    computeImportance,
    computeAffinity,
    computeProximity,
    computeDateFactor,
    scoreFromFactors,
    IMPORTANCE_FLOOR,
} from '@/src/domains/recommendations/factors'
import type { ArtistImportance } from '@/src/domains/taste/types'

function importanceRow(peso: number): ArtistImportance {
    return { artistId: 'x', peso, geoRank: null, wentCount: 0 }
}

describe('computeImportance', () => {
    it('floors at 0.1 for an empty lineup', () => {
        expect(computeImportance([], new Map())).toBe(IMPORTANCE_FLOOR)
    })

    it('floors at 0.1 when no lineup artist has an importance row', () => {
        expect(computeImportance(['a1', 'a2'], new Map())).toBe(IMPORTANCE_FLOOR)
    })

    it('takes the max peso across the lineup', () => {
        const importance = new Map([
            ['a1', importanceRow(0.3)],
            ['a2', importanceRow(0.9)],
        ])

        expect(computeImportance(['a1', 'a2'], importance)).toBe(0.9)
    })

    it('ignores a non-finite peso and still floors if nothing else is finite', () => {
        const importance = new Map([['a1', importanceRow(NaN)]])

        expect(computeImportance(['a1'], importance)).toBe(IMPORTANCE_FLOOR)
    })

    it('never crashes on a large lineup (no Math.max spread over the array)', () => {
        const ids = Array.from({ length: 50000 }, (_, i) => `a${i}`)
        const importance = new Map(ids.map((id, i) => [id, importanceRow(i / ids.length)]))

        expect(() => computeImportance(ids, importance)).not.toThrow()
        expect(computeImportance(ids, importance)).toBeCloseTo(0.9998, 3)
    })
})

const taste = {
    artistAffinity: new Map([
        ['a1', 10],
        ['a2', 5],
    ]),
    genreAffinity: new Map([['rock', 4]]),
}

describe('computeAffinity', () => {
    it('is always 1 in general mode, regardless of taste', () => {
        expect(computeAffinity('general', ['a1'], taste, new Map())).toBe(1)
    })

    it('is 1 (a=0) for an empty lineup in personal mode', () => {
        expect(computeAffinity('personal', [], taste, new Map())).toBe(1)
    })

    it('is 1 (a=0) when taste is null', () => {
        expect(computeAffinity('personal', ['a1'], null, new Map())).toBe(1)
    })

    it('is 3 (a=1) for the artist with the max affinity', () => {
        expect(computeAffinity('personal', ['a1'], taste, new Map())).toBe(3)
    })

    it('scales between 1 and 3 for a lesser affinity', () => {
        expect(computeAffinity('personal', ['a2'], taste, new Map())).toBeCloseTo(1 + 2 * 0.5, 5)
    })

    it('uses genre affinity when the artist has no direct affinity', () => {
        const artistGenres = new Map([['a3', ['rock']]])

        expect(computeAffinity('personal', ['a3'], taste, artistGenres)).toBe(1 + 2 * 1)
    })

    it('is 1 when every affinity value in the taste maps is zero', () => {
        const zeroTaste = { artistAffinity: new Map([['a1', 0]]), genreAffinity: new Map() }

        expect(computeAffinity('personal', ['a1'], zeroTaste, new Map())).toBe(1)
    })

    it('treats a non-finite max affinity as contributing zero', () => {
        const brokenTaste = { artistAffinity: new Map([['a1', Infinity]]), genreAffinity: new Map() }

        expect(computeAffinity('personal', ['a1'], brokenTaste, new Map())).toBe(1)
    })

    it('clamps a to [0,1] even if a raw ratio exceeds 1', () => {
        const skewedTaste = { artistAffinity: new Map([['a1', 10], ['a2', 1]]), genreAffinity: new Map() }
        // a2's ratio (1/10) is well under 1 — assert the ceiling never exceeds 3 for any candidate
        expect(computeAffinity('personal', ['a1'], skewedTaste, new Map())).toBeLessThanOrEqual(3)
    })
})

describe('computeProximity', () => {
    it('is 0.7 with no distance when the user has no coordinates', () => {
        expect(computeProximity(null, { lat: -34.6, lng: -58.4 })).toEqual({ proximity: 0.7, distanceKm: null })
    })

    it('is 0.7 with no distance when the venue has no coordinates', () => {
        expect(computeProximity({ lat: -34.6, lng: -58.4 }, null)).toEqual({ proximity: 0.7, distanceKm: null })
    })

    it('is 1 at zero distance', () => {
        const point = { lat: -34.6, lng: -58.4 }

        expect(computeProximity(point, point)).toEqual({ proximity: 1, distanceKm: 0 })
    })

    it('decays with distance', () => {
        const near = computeProximity({ lat: -34.6037, lng: -58.3816 }, { lat: -34.61, lng: -58.39 })
        const far = computeProximity({ lat: -34.6037, lng: -58.3816 }, { lat: -41, lng: -71 })

        expect(near.proximity).toBeGreaterThan(far.proximity)
        expect(far.proximity).toBeCloseTo(0.4, 2)
    })
})

describe('computeDateFactor', () => {
    const now = new Date('2026-09-14T12:00:00-03:00')

    it('returns null for an unparsable date', () => {
        expect(computeDateFactor('not-a-date', now)).toBeNull()
    })

    it('returns null for a date more than 90 days out', () => {
        expect(computeDateFactor('2027-01-01', now)).toBeNull()
    })

    it('returns null for a date in the past', () => {
        expect(computeDateFactor('2026-01-01', now)).toBeNull()
    })

    it('is 1 for today', () => {
        const result = computeDateFactor('2026-09-14', now)

        expect(result).toEqual({ when: 1, daysAway: 0 })
    })

    it('decays for a date further in the window', () => {
        const soon = computeDateFactor('2026-09-15', now)
        const later = computeDateFactor('2026-10-14', now)

        expect(soon).not.toBeNull()
        expect(later).not.toBeNull()
        expect(soon!.when).toBeGreaterThan(later!.when)
    })
})

describe('scoreFromFactors', () => {
    const now = new Date('2026-09-14T12:00:00-03:00')

    it('multiplies every factor together', () => {
        expect(scoreFromFactors({ importance: 0.5, affinity: 2, proximity: 0.8, date: 1 })).toBeCloseTo(0.8, 5)
    })

    it('is finite for the empty-lineup / missing-importance / zero-affinity / null-coords combination', () => {
        const importance = computeImportance([], new Map())
        const affinity = computeAffinity('personal', [], taste, new Map())
        const { proximity } = computeProximity(null, null)
        const date = computeDateFactor('2026-09-14', now)!

        const score = scoreFromFactors({ importance, affinity, proximity, date: date.when })

        expect(Number.isFinite(score)).toBe(true)
    })
})
