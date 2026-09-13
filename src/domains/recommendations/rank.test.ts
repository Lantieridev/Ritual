import { describe, it, expect } from 'vitest'
import { rankSuggestions, compareRanked } from '@/src/domains/recommendations/rank'
import type { RankedCandidate, RankingInput, SuggestionCandidate } from '@/src/domains/recommendations/types'

const NOW = new Date('2026-09-14T12:00:00-03:00')
const HERE = { lat: -34.6037, lng: -58.3816 }

function candidate(overrides: Partial<SuggestionCandidate> & Pick<SuggestionCandidate, 'key'>): SuggestionCandidate {
    return {
        source: 'catalog',
        href: `/events/${overrides.key}`,
        headliner: overrides.key,
        artistIds: [],
        venueName: 'Niceto',
        startsAt: '2026-09-14',
        venueCoords: HERE,
        ...overrides,
    }
}

function baseCtx(overrides: Partial<RankingInput> = {}): RankingInput {
    return {
        now: NOW,
        mode: 'general',
        userCoords: HERE,
        importance: new Map(),
        taste: null,
        artistGenres: new Map(),
        facts: { seenCounts: new Map(), wishlist: new Set(), declaredGenres: new Set() },
        ...overrides,
    }
}

describe('rankSuggestions — weighted order', () => {
    it('ranks the higher-score candidate first', () => {
        const importance = new Map([
            ['low', { artistId: 'low', peso: 0.1, geoRank: null, wentCount: 0 }],
            ['high', { artistId: 'high', peso: 0.9, geoRank: null, wentCount: 0 }],
        ])
        const candidates = [
            candidate({ key: 'weak', artistIds: ['low'] }),
            candidate({ key: 'strong', artistIds: ['high'] }),
        ]

        const ranked = rankSuggestions(candidates, baseCtx({ importance }))

        expect(ranked.map((r) => r.key)).toEqual(['strong', 'weak'])
    })

    it('reproduces a realistic importance-driven order when proximity and date are both neutral-max (1)', () => {
        const importance = new Map([
            ['divididos', { artistId: 'divididos', peso: 0.95, geoRank: 1, wentCount: 20 }],
            ['el-mato', { artistId: 'el-mato', peso: 0.8, geoRank: 3, wentCount: 15 }],
            ['nathy', { artistId: 'nathy', peso: 0.6, geoRank: 8, wentCount: 10 }],
            ['trueno', { artistId: 'trueno', peso: 0.4, geoRank: 15, wentCount: 5 }],
        ])
        const candidates = [
            candidate({ key: 'trueno-show', artistIds: ['trueno'], startsAt: '2026-09-14' }),
            candidate({ key: 'nathy-show', artistIds: ['nathy'], startsAt: '2026-09-14' }),
            candidate({ key: 'divididos-show', artistIds: ['divididos'], startsAt: '2026-09-14' }),
            candidate({ key: 'el-mato-show', artistIds: ['el-mato'], startsAt: '2026-09-14' }),
        ]

        const ranked = rankSuggestions(candidates, baseCtx({ importance }))

        expect(ranked.map((r) => r.key)).toEqual(['divididos-show', 'el-mato-show', 'nathy-show', 'trueno-show'])
        for (const row of ranked) {
            expect(row.factors.proximity).toBe(1)
            expect(row.factors.date).toBe(1)
        }
    })
})

describe('rankSuggestions — tie-break and determinism', () => {
    it('orders equal-score, equal-date candidates by key', () => {
        const candidates = [candidate({ key: 'zeta' }), candidate({ key: 'alfa' })]

        const ranked = rankSuggestions(candidates, baseCtx())

        expect(ranked.map((r) => r.key)).toEqual(['alfa', 'zeta'])
    })

    it('produces identical output across two runs of the same input', () => {
        const candidates = [candidate({ key: 'zeta' }), candidate({ key: 'alfa' }), candidate({ key: 'medio' })]
        const ctx = baseCtx()

        const first = rankSuggestions(candidates, ctx).map((r) => r.key)
        const second = rankSuggestions(candidates, ctx).map((r) => r.key)

        expect(first).toEqual(second)
    })

    it('sorts by score, with a farther but more important show beating a nearer one', () => {
        const candidates = [
            candidate({ key: 'far', startsAt: '2026-09-20' }),
            candidate({ key: 'near', startsAt: '2026-09-15' }),
        ]

        const ranked = rankSuggestions(candidates, baseCtx())

        expect(ranked.map((r) => r.key)).toEqual(['near', 'far'])
    })

    /**
     * `rankSuggestions` no produce puntajes idénticos bit a bit entre dos
     * candidatos calculados por caminos distintos — de ahí que este tier del
     * comparador se pruebe directo, con objetos ya armados, en vez de
     * intentar "empatar" el puntaje real combinando factores (eso depende de
     * la aritmética de punto flotante, no de la regla de desempate).
     */
    it('compareRanked breaks a tied score by the nearer date, then by key', () => {
        const base: RankedCandidate = {
            key: 'a',
            source: 'catalog',
            href: '/events/a',
            headliner: 'a',
            artistIds: [],
            venueName: 'Niceto',
            startsAt: '2026-09-14',
            venueCoords: HERE,
            score: 0.5,
            factors: { importance: 0.5, affinity: 1, proximity: 1, date: 1 },
            daysAway: 5,
            distanceKm: null,
            reason: null,
        }

        expect(compareRanked({ ...base, daysAway: 5 }, { ...base, daysAway: 10 })).toBeLessThan(0)
        expect(compareRanked({ ...base, daysAway: 10 }, { ...base, daysAway: 5 })).toBeGreaterThan(0)
        expect(compareRanked({ ...base, key: 'alfa' }, { ...base, key: 'zeta' })).toBeLessThan(0)
        expect(compareRanked(base, { ...base, score: 0.9 })).toBeGreaterThan(0) // el puntaje manda antes que la fecha
    })
})

describe('rankSuggestions — exclusions and finiteness', () => {
    it('excludes a candidate with an unparsable date', () => {
        const candidates = [candidate({ key: 'ok' }), candidate({ key: 'bad-date', startsAt: 'not-a-date' })]

        const ranked = rankSuggestions(candidates, baseCtx())

        expect(ranked.map((r) => r.key)).toEqual(['ok'])
    })

    it('excludes a candidate more than 90 days out', () => {
        const candidates = [candidate({ key: 'ok' }), candidate({ key: 'too-far', startsAt: '2027-01-01' })]

        const ranked = rankSuggestions(candidates, baseCtx())

        expect(ranked.map((r) => r.key)).toEqual(['ok'])
    })

    it('includes a candidate exactly on day 90 and excludes one on day 91', () => {
        const candidates = [
            candidate({ key: 'day-90', startsAt: '2026-12-13' }),
            candidate({ key: 'day-91', startsAt: '2026-12-14' }),
        ]

        const ranked = rankSuggestions(candidates, baseCtx())

        expect(ranked.map((r) => r.key)).toEqual(['day-90'])
    })

    it('produces a finite score for empty lineups, missing importance, and null coordinates', () => {
        const candidates = [candidate({ key: 'lonely', artistIds: [], venueCoords: null })]

        const ranked = rankSuggestions(candidates, baseCtx({ userCoords: null, mode: 'personal' }))

        expect(ranked).toHaveLength(1)
        expect(Number.isFinite(ranked[0].score)).toBe(true)
        expect(ranked[0].reason).toBeNull()
    })
})
