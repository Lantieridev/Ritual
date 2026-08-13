import { describe, it, expect } from 'vitest'
import {
    wentWeight,
    lastfmWeight,
    priorFade,
    GOING_WEIGHT,
    WISHLIST_WEIGHT,
    INTERESTED_WEIGHT,
    WENT_HALF_LIFE_DAYS,
} from '@/src/domains/taste/weights'

describe('wentWeight', () => {
    it('weighs an unrated went strictly between a 1/5 and a 5/5 rating', () => {
        const oneStar = wentWeight(1)
        const unrated = wentWeight(0)
        const fiveStars = wentWeight(5)

        expect(oneStar).toBeLessThan(unrated)
        expect(unrated).toBeLessThan(fiveStars)
    })

    it('follows the exact formula: 3 * (rating ? rating/3 : 1)', () => {
        expect(wentWeight(0)).toBe(3)
        expect(wentWeight(1)).toBe(1)
        expect(wentWeight(3)).toBe(3)
        expect(wentWeight(5)).toBe(5)
    })
})

describe('status constants', () => {
    it('matches the design weights for going/wishlist/interested', () => {
        expect(GOING_WEIGHT).toBe(2)
        expect(WISHLIST_WEIGHT).toBe(2)
        expect(INTERESTED_WEIGHT).toBe(1)
    })

    it('decays a went signal over a year', () => {
        expect(WENT_HALF_LIFE_DAYS).toBe(365)
    })
})

describe('lastfmWeight', () => {
    it('weighs the #1 most-played artist at the full scale', () => {
        expect(lastfmWeight(1)).toBe(2)
    })

    it('weighs rank 50 (the storage cap) near zero', () => {
        expect(lastfmWeight(50)).toBeCloseTo(0.04, 5)
    })
})

describe('priorFade', () => {
    it('keeps the full prior weight when there is no real behavior yet', () => {
        expect(priorFade(0)).toBe(1)
    })

    it('halves the prior weight once 10 real signals accumulated', () => {
        expect(priorFade(10)).toBe(0.5)
    })
})
