import { describe, it, expect } from 'vitest'
import { deriveReason, formatReason } from '@/src/domains/recommendations/reasons'
import type { ArtistImportance } from '@/src/domains/taste/types'

function importanceRow(overrides: Partial<ArtistImportance> = {}): ArtistImportance {
    return { artistId: 'a1', peso: 0.5, geoRank: null, wentCount: 0, ...overrides }
}

const emptyFacts = { seenCounts: new Map(), wishlist: new Set<string>(), declaredGenres: new Set<string>() }

describe('deriveReason — personal mode priority', () => {
    it('prefers seen (singular) over wishlist and declared-genre', () => {
        const ctx = {
            facts: {
                seenCounts: new Map([['a1', 1]]),
                wishlist: new Set(['a1']),
                declaredGenres: new Set(['rock']),
            },
            artistGenres: new Map([['a1', ['rock']]]),
            importance: new Map(),
        }

        expect(deriveReason('personal', ['a1'], ctx)).toEqual({ kind: 'seen', times: 1 })
    })

    it('reports the plural seen count', () => {
        const ctx = { facts: { ...emptyFacts, seenCounts: new Map([['a1', 4]]) }, artistGenres: new Map(), importance: new Map() }

        expect(deriveReason('personal', ['a1'], ctx)).toEqual({ kind: 'seen', times: 4 })
    })

    it('falls back to wishlist when there is no seen count', () => {
        const ctx = { facts: { ...emptyFacts, wishlist: new Set(['a1']) }, artistGenres: new Map(), importance: new Map() }

        expect(deriveReason('personal', ['a1'], ctx)).toEqual({ kind: 'wishlist' })
    })

    it('falls back to declared-genre when there is no seen count or wishlist match', () => {
        const ctx = {
            facts: { ...emptyFacts, declaredGenres: new Set(['rock']) },
            artistGenres: new Map([['a1', ['rock']]]),
            importance: new Map(),
        }

        expect(deriveReason('personal', ['a1'], ctx)).toEqual({ kind: 'declared-genre' })
    })

    it('is null with no matching evidence', () => {
        const ctx = { facts: emptyFacts, artistGenres: new Map(), importance: new Map() }

        expect(deriveReason('personal', ['a1'], ctx)).toBeNull()
    })

    it('is null for an empty lineup even with matching facts', () => {
        const ctx = { facts: { ...emptyFacts, wishlist: new Set(['a1']) }, artistGenres: new Map(), importance: new Map() }

        expect(deriveReason('personal', [], ctx)).toBeNull()
    })
})

describe('deriveReason — general mode priority', () => {
    it('prefers country-top over loaded-by', () => {
        const ctx = {
            facts: emptyFacts,
            artistGenres: new Map(),
            importance: new Map([['a1', importanceRow({ geoRank: 3, wentCount: 10 })]]),
        }

        expect(deriveReason('general', ['a1'], ctx)).toEqual({ kind: 'country-top' })
    })

    it('falls back to loaded-by when wentCount is at least 3 and there is no geo rank', () => {
        const ctx = { facts: emptyFacts, artistGenres: new Map(), importance: new Map([['a1', importanceRow({ wentCount: 5 })]]) }

        expect(deriveReason('general', ['a1'], ctx)).toEqual({ kind: 'loaded-by', people: 5 })
    })

    it('does not use loaded-by below the N=3 threshold', () => {
        const ctx = { facts: emptyFacts, artistGenres: new Map(), importance: new Map([['a1', importanceRow({ wentCount: 2 })]]) }

        expect(deriveReason('general', ['a1'], ctx)).toBeNull()
    })

    it('is null for an empty lineup', () => {
        const ctx = { facts: emptyFacts, artistGenres: new Map(), importance: new Map([['a1', importanceRow({ geoRank: 1 })]]) }

        expect(deriveReason('general', [], ctx)).toBeNull()
    })
})

describe('formatReason', () => {
    it('is null with no reason and no distance', () => {
        expect(formatReason(null, null)).toBeNull()
    })

    it('shows the distance alone when there is no reason', () => {
        expect(formatReason(null, 12.6)).toBe('a 13 km')
    })

    it('floors a sub-1km distance to 1', () => {
        expect(formatReason(null, 0.3)).toBe('a 1 km')
    })

    it('formats a singular seen reason with no distance', () => {
        expect(formatReason({ kind: 'seen', times: 1 }, null)).toBe('lo viste una vez')
    })

    it('formats a plural seen reason', () => {
        expect(formatReason({ kind: 'seen', times: 4 }, null)).toBe('lo viste 4 veces')
    })

    it('appends the km suffix only when a distance is given', () => {
        expect(formatReason({ kind: 'wishlist' }, null)).toBe('está en tu wishlist')
        expect(formatReason({ kind: 'wishlist' }, 12.6)).toBe('está en tu wishlist · a 13 km')
    })

    it('formats declared-genre, country-top and loaded-by', () => {
        expect(formatReason({ kind: 'declared-genre' }, null)).toBe('por los géneros que elegiste')
        expect(formatReason({ kind: 'country-top' }, null)).toBe('de los más escuchados del país')
        expect(formatReason({ kind: 'loaded-by', people: 7 }, null)).toBe('lo cargaron 7 personas')
    })
})
