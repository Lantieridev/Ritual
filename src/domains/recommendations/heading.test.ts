import { describe, it, expect } from 'vitest'
import { stripHeading } from '@/src/domains/recommendations/heading'
import type { StripHeadingInput } from '@/src/domains/recommendations/types'

function input(overrides: Partial<StripHeadingInput>): StripHeadingInput {
    return {
        basis: 'none',
        hasCoords: false,
        city: null,
        sources: [],
        declaredGenreLabels: [],
        ...overrides,
    }
}

describe('stripHeading — truth table', () => {
    it('G1: basis none, city null → guest wording, missing-city note', () => {
        const result = stripHeading(input({ basis: 'none', city: null }))

        expect(result.title).toBe('Los más escuchados y vistos del país')
        expect(result.note).toBe('Sin personalizar · falta tu ciudad')
    })

    it('G2: basis none, city text present (no coords) → never the missing-city variant', () => {
        const result = stripHeading(input({ basis: 'none', city: 'La Plata', hasCoords: false }))

        expect(result.title).toBe('Los más escuchados y vistos del país')
        expect(result.note).toBe('Sin personalizar · cargá shows o elegí géneros')
    })

    it('G2: basis none, city text present, with coords → same as without coords', () => {
        const result = stripHeading(input({ basis: 'none', city: 'La Plata', hasCoords: true }))

        expect(result.note).toBe('Sin personalizar · cargá shows o elegí géneros')
    })

    it('P1: behavior, lastfm contributed, coords + city → reproduces the mock exactly', () => {
        const result = stripHeading(
            input({ basis: 'behavior', hasCoords: true, city: 'La Plata', sources: ['lastfm', 'attendance'] })
        )

        expect(result.title).toBe('Cerca tuyo, de lo que escuchás')
        expect(result.note).toBe('Ordenado por artista + lo que escuchás + fecha · La Plata')
    })

    it('P1: without coords → "Para vos" prefix, no city tail, no km, no missing-city copy (JD-003)', () => {
        const result = stripHeading(input({ basis: 'behavior', hasCoords: false, city: 'La Plata', sources: ['lastfm'] }))

        expect(result.title).toBe('Para vos, de lo que escuchás')
        expect(result.note).toBe('Ordenado por artista + lo que escuchás + fecha')
    })

    it('P2: behavior, no lastfm, attendance + wishlist', () => {
        const result = stripHeading(input({ basis: 'behavior', hasCoords: true, city: 'CABA', sources: ['attendance', 'wishlist'] }))

        expect(result.title).toBe('Cerca tuyo, de tus shows y tu wishlist')
        expect(result.note).toBe('Ordenado por artista + tus shows + tu wishlist + fecha · CABA')
    })

    it('P3: behavior, no lastfm, attendance only', () => {
        const result = stripHeading(input({ basis: 'behavior', hasCoords: false, sources: ['attendance'] }))

        expect(result.title).toBe('Para vos, de tus shows')
        expect(result.note).toBe('Ordenado por artista + tus shows + fecha')
    })

    it('P4: behavior, no lastfm, wishlist only', () => {
        const result = stripHeading(input({ basis: 'behavior', hasCoords: false, sources: ['wishlist'] }))

        expect(result.title).toBe('Para vos, de tu wishlist')
        expect(result.note).toBe('Ordenado por artista + tu wishlist + fecha')
    })

    it('P5: declared-genres, labels joined with ", "', () => {
        const result = stripHeading(
            input({ basis: 'declared-genres', hasCoords: true, city: 'CABA', declaredGenreLabels: ['Rock', 'Indie'] })
        )

        expect(result.title).toBe('Cerca tuyo, de tus géneros')
        expect(result.note).toBe('Ordenado por artista + Rock, Indie + fecha · CABA')
    })

    it('P5: declared-genres, labels unavailable falls back to "tus géneros"', () => {
        const result = stripHeading(input({ basis: 'declared-genres', declaredGenreLabels: [] }))

        expect(result.note).toContain('tus géneros')
    })

    it('unknown-source edge: behavior with only an unrecognized future source falls back to generic wording', () => {
        const result = stripHeading(input({ basis: 'behavior', sources: ['some-future-source'] }))

        expect(result.title).toBe('Para vos, de lo que cargaste')
        expect(result.note).toBe('Ordenado por artista + lo que cargaste + fecha')
    })
})
