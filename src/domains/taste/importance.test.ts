import { describe, it, expect } from 'vitest'
import { computeArtistImportance } from '@/src/domains/taste/importance'

describe('computeArtistImportance — went_count privacy threshold', () => {
    it('produces identical peso for went=2 and went=0 (both hidden below 3)', () => {
        const base = { geoRank: null, geoTotal: 0, maxWent: 10 }

        const withTwo = computeArtistImportance({ ...base, wentCount: 2 })
        const withZero = computeArtistImportance({ ...base, wentCount: 0 })

        expect(withTwo).toBe(withZero)
    })

    it('gives a strictly higher peso once went reaches the 3-attendee threshold', () => {
        const base = { geoRank: null, geoTotal: 0, maxWent: 10 }

        const hidden = computeArtistImportance({ ...base, wentCount: 2 })
        const counted = computeArtistImportance({ ...base, wentCount: 3 })

        expect(counted).toBeGreaterThan(hidden)
    })
})

describe('computeArtistImportance — geo rank contribution', () => {
    it('ranks the #1 geo artist above one with no geo data at all', () => {
        const topRanked = computeArtistImportance({ geoRank: 1, geoTotal: 200, wentCount: 0, maxWent: 0 })
        const noGeoData = computeArtistImportance({ geoRank: null, geoTotal: 200, wentCount: 0, maxWent: 0 })

        expect(topRanked).toBeGreaterThan(noGeoData)
    })

    it('stays within the [0, 1] range for the best possible inputs', () => {
        const best = computeArtistImportance({ geoRank: 1, geoTotal: 200, wentCount: 500, maxWent: 500 })

        expect(best).toBeLessThanOrEqual(1)
        expect(best).toBeGreaterThanOrEqual(0)
    })
})
